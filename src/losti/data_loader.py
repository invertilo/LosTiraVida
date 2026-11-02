from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd
import wfdb

from losti.types import ECGRecord

MITDB_DIR = "mitdb"
NSTDB_DIR = "nstdb"
PAMAP2_DIR = "pamap2"
DRIVEDB_DIR = "drivedb"

# Codigos de anotacion MIT-BIH que corresponden a latidos (excluye ritmo, ruido, comentarios).
BEAT_SYMBOLS: frozenset[str] = frozenset("NLRBAaJSVrFejnE/fQ?")

_LEAD = "MLII"
_PAMAP2_SUBJECT_OFFSET = 100  # id "1" -> Protocol/subject101.dat
_PAMAP2_IMU_SENSORS: tuple[str, ...] = ("hand", "chest", "ankle")
_PAMAP2_ACC16_AXES: tuple[str, ...] = ("x", "y", "z")
# Columnas 0-based del .dat: timestamp, activityID, heart rate; luego 17 columnas por IMU.
_PAMAP2_IMU_BASE = 3
_PAMAP2_IMU_WIDTH = 17
_PAMAP2_IMU_ACC16_OFFSET = 1  # temperatura, luego 3 acc16 (x, y, z)
_PAMAP2_NCOLS = 54
# Nombres de senal tal como aparecen en los .hea (drive07 trae "hand GSr", con typo).
_DRIVEDB_SIGNAL_NAMES: dict[str, str] = {
    "ECG": "ecg",
    "EMG": "emg",
    "foot GSR": "gsr_foot",
    "hand GSR": "gsr_hand",
    "hand GSr": "gsr_hand",
    "HR": "hr",
    "RESP": "resp",
}
_DRIVEDB_KEYS: tuple[str, ...] = ("ecg", "emg", "gsr_foot", "gsr_hand", "hr", "resp")


def _record_files_exist(mitdb: Path, record_id: str) -> bool:
    return all((mitdb / f"{record_id}.{ext}").exists() for ext in ("hea", "dat", "atr"))


def list_mitdb_records(data_dir: Path) -> list[str]:
    """Lista los registros MIT-BIH completos (.hea, .dat y .atr) ordenados numericamente."""
    mitdb = Path(data_dir) / MITDB_DIR
    if not mitdb.is_dir():
        raise FileNotFoundError(f"No existe el directorio MIT-BIH: {mitdb}")
    ids = {p.stem for p in mitdb.glob("*.hea") if _record_files_exist(mitdb, p.stem)}
    return sorted(ids, key=lambda r: (0, int(r), r) if r.isdigit() else (1, 0, r))


def load_ecg_record(record_id: str, data_dir: Path) -> ECGRecord:
    """Carga un registro MIT-BIH con wfdb: senal de MLII y latidos anotados."""
    mitdb = Path(data_dir) / MITDB_DIR
    if not _record_files_exist(mitdb, record_id):
        raise FileNotFoundError(f"Registro MIT-BIH {record_id!r} incompleto o ausente en {mitdb}")
    base = str(mitdb / record_id)

    rec = wfdb.rdrecord(base)
    if rec.p_signal is None:
        raise ValueError(f"El registro {record_id} no tiene senal fisica")
    names = list(rec.sig_name)
    col = names.index(_LEAD) if _LEAD in names else 0
    signal = np.asarray(rec.p_signal[:, col], dtype=np.float64)

    ann = wfdb.rdann(base, "atr")
    samples = np.asarray(ann.sample, dtype=np.int64)
    keep = np.array([s in BEAT_SYMBOLS for s in ann.symbol], dtype=bool)
    ref_beats = samples[keep]
    ref_symbols = [s for s, k in zip(ann.symbol, keep, strict=True) if k]

    return ECGRecord(
        record_id=record_id,
        fs=float(rec.fs),
        signal=signal,
        ref_beats=ref_beats,
        ref_symbols=ref_symbols,
    )


def _pamap2_file(subject_id: str, data_dir: Path) -> Path:
    if not re.fullmatch(r"[1-9]", subject_id):
        raise ValueError(f"Sujeto PAMAP2 invalido: {subject_id!r} (esperado '1'..'9')")
    return Path(data_dir) / PAMAP2_DIR / "Protocol" / f"subject{_PAMAP2_SUBJECT_OFFSET + int(subject_id)}.dat"


def list_pamap2_subjects(data_dir: Path) -> list[str]:
    """Lista los sujetos PAMAP2 ("1".."9") cuyo Protocol/subjectXXX.dat existe."""
    root = Path(data_dir) / PAMAP2_DIR
    if not root.is_dir():
        raise FileNotFoundError(f"No existe el directorio PAMAP2: {root}")
    subjects = [str(i) for i in range(1, 10) if _pamap2_file(str(i), data_dir).exists()]
    return subjects


def _pamap2_columns() -> list[str]:
    names = ["timestamp_s", "activity_id", "heart_rate"]
    for sensor in _PAMAP2_IMU_SENSORS:
        names.extend(f"{sensor}_acc16_{axis}" for axis in _PAMAP2_ACC16_AXES)
    return names


def _pamap2_acc16_indices() -> list[int]:
    indices: list[int] = []
    for i in range(len(_PAMAP2_IMU_SENSORS)):
        base = _PAMAP2_IMU_BASE + i * _PAMAP2_IMU_WIDTH + _PAMAP2_IMU_ACC16_OFFSET
        indices.extend(range(base, base + 3))
    return indices


def load_pamap2_subject(subject_id: str, data_dir: Path) -> pd.DataFrame:
    """Carga Protocol/subjectXXX.dat de PAMAP2 con las columnas de tiempo, actividad, HR y acc16.

    Los NaN se conservan (no se interpolan aqui); la interpolacion se hace por ventana en
    extract_pamap2_windows. Las filas sin timestamp se descartan.
    """
    path = _pamap2_file(subject_id, data_dir)
    if not path.exists():
        raise FileNotFoundError(f"No existe el archivo PAMAP2 del sujeto {subject_id}: {path}")
    raw = pd.read_csv(path, sep=r"\s+", header=None, na_values="NaN", dtype=np.float64)
    if raw.shape[1] != _PAMAP2_NCOLS:
        raise ValueError(f"PAMAP2 sujeto {subject_id}: se esperaban {_PAMAP2_NCOLS} columnas, hay {raw.shape[1]}")
    cols = [0, 1, 2, *_pamap2_acc16_indices()]
    out = raw.iloc[:, cols].copy()
    out.columns = _pamap2_columns()
    out = out.dropna(subset=["timestamp_s"]).sort_values("timestamp_s", kind="stable")
    return out.reset_index(drop=True)


def list_drivedb_records(data_dir: Path) -> list[str]:
    """Lista los registros DriveDB completos (.hea y .dat): drive01..drive16, drive17a, drive17b."""
    root = Path(data_dir) / DRIVEDB_DIR
    if not root.is_dir():
        raise FileNotFoundError(f"No existe el directorio DriveDB: {root}")
    ids = {
        p.stem
        for p in root.glob("drive*.hea")
        if (root / f"{p.stem}.dat").exists()
    }

    def _key(rid: str) -> tuple[int, str]:
        digits = re.match(r"drive(\d+)", rid)
        return (int(digits.group(1)) if digits else 0, rid)

    return sorted(ids, key=_key)


def load_drivedb_record(record_id: str, data_dir: Path) -> dict[str, np.ndarray | float | None]:
    """Carga un registro DriveDB con wfdb a su resolucion completa por senal.

    La frecuencia real de cada senal es fs base del registro * muestras por trama
    (wfdb, smooth_frames=False); no se usan las ganancias del encabezado. Varia por registro
    (p. ej. ECG 496 Hz, 480.5 en drive15, 356.5 en drive12).
    Claves: ecg, emg, gsr_foot, gsr_hand, hr, resp (arrays en unidades fisicas, None si la senal
    no existe en el registro) y fs_ecg, fs_emg, fs_gsr, fs_hr, fs_resp (Hz, None si falta la senal).
    fs_gsr es la frecuencia del GSR de pie (o de mano si no hay de pie).
    """
    root = Path(data_dir) / DRIVEDB_DIR
    if not (root / f"{record_id}.hea").exists() or not (root / f"{record_id}.dat").exists():
        raise FileNotFoundError(f"Registro DriveDB {record_id!r} incompleto o ausente en {root}")
    rec = wfdb.rdrecord(str(root / record_id), smooth_frames=False)
    if rec.e_p_signal is None or rec.samps_per_frame is None:
        raise ValueError(f"El registro DriveDB {record_id} no tiene senal fisica")

    arrays: dict[str, np.ndarray | None] = {key: None for key in _DRIVEDB_KEYS}
    rates: dict[str, float | None] = {key: None for key in _DRIVEDB_KEYS}
    for name, samples_per_frame, signal in zip(
        rec.sig_name, rec.samps_per_frame, rec.e_p_signal, strict=True
    ):
        key = _DRIVEDB_SIGNAL_NAMES.get(name)
        if key is None:
            continue  # p. ej. "marker": no es una senal fisiologica del modelo
        arrays[key] = np.asarray(signal, dtype=np.float64).ravel()
        rates[key] = float(rec.fs) * float(samples_per_frame)

    gsr_rate = rates["gsr_foot"] if rates["gsr_foot"] is not None else rates["gsr_hand"]
    out: dict[str, np.ndarray | float | None] = dict(arrays)
    out["fs_ecg"] = rates["ecg"]
    out["fs_emg"] = rates["emg"]
    out["fs_gsr"] = gsr_rate
    out["fs_hr"] = rates["hr"]
    out["fs_resp"] = rates["resp"]
    return out
