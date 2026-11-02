from __future__ import annotations

import pickle
import re
from pathlib import Path
from typing import Any

import numpy as np
import wfdb

from losti.types import ECGRecord

MITDB_DIR = "mitdb"
NSTDB_DIR = "nstdb"
WESAD_DIR = "wesad"

# Codigos de anotacion MIT-BIH que corresponden a latidos (excluye ritmo, ruido, comentarios).
BEAT_SYMBOLS: frozenset[str] = frozenset("NLRBAaJSVrFejnE/fQ?")

_LEAD = "MLII"


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


def list_wesad_subjects(data_dir: Path) -> list[str]:
    """Lista los sujetos WESAD (S2..S17) con su pickle presente."""
    root = Path(data_dir) / WESAD_DIR
    if not root.is_dir():
        raise FileNotFoundError(f"No existe el directorio WESAD: {root}")
    subjects = [
        p.name
        for p in root.iterdir()
        if p.is_dir() and re.fullmatch(r"S\d+", p.name) and (p / f"{p.name}.pkl").exists()
    ]
    return sorted(subjects, key=lambda s: int(s[1:]))


def load_wesad_subject(subject_id: str, data_dir: Path) -> dict[str, Any]:
    """Carga el pickle de un sujeto WESAD.

    Devuelve un dict con "chest" (dict de senales), "wrist" (dict) y "label" (np.ndarray, 700 Hz).
    """
    pkl = Path(data_dir) / WESAD_DIR / subject_id / f"{subject_id}.pkl"
    if not pkl.exists():
        raise FileNotFoundError(f"No existe el pickle de WESAD para {subject_id}: {pkl}")
    with pkl.open("rb") as fh:
        obj = pickle.load(fh, encoding="latin1")  # noqa: S301 - dataset oficial local
    try:
        signal = obj["signal"]
        return {
            "chest": dict(signal["chest"]),
            "wrist": dict(signal["wrist"]),
            "label": np.asarray(obj["label"]),
        }
    except (KeyError, TypeError) as exc:
        raise ValueError(f"Estructura inesperada en el pickle de {subject_id}: {exc}") from exc
