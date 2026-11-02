from __future__ import annotations

import math
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd
import wfdb
from numpy.typing import NDArray

from losti.data_loader import list_mitdb_records, load_ecg_record
from losti.ecg import detect_r_peaks, signal_quality_index
from losti.types import BeatMetrics

NSTDB_NOISE_RECORDS = ("em", "ma")
SQI_WINDOW_S = 5.0
SQI_ACCEPT_THRESHOLD = 0.5  # una ventana se acepta si su SQI >= este valor


def match_beats(
    ref: np.ndarray, det: np.ndarray, fs: float, tol_ms: float = 150.0
) -> tuple[int, int, int]:
    """Empareja latidos de referencia y detectados (uno a uno, por cercania). Devuelve tp, fp, fn."""
    ref_s = np.sort(np.asarray(ref, dtype=np.float64))
    det_s = np.sort(np.asarray(det, dtype=np.float64))
    tol = tol_ms / 1000.0 * fs

    pairs: list[tuple[float, int, int]] = []
    if ref_s.size and det_s.size:
        lo = np.searchsorted(det_s, ref_s - tol, side="left")
        hi = np.searchsorted(det_s, ref_s + tol, side="right")
        for r_idx in range(ref_s.size):
            for d_idx in range(int(lo[r_idx]), int(hi[r_idx])):
                pairs.append((abs(det_s[d_idx] - ref_s[r_idx]), r_idx, d_idx))
    pairs.sort()

    used_ref: set[int] = set()
    used_det: set[int] = set()
    tp = 0
    for _, r_idx, d_idx in pairs:
        if r_idx in used_ref or d_idx in used_det:
            continue
        used_ref.add(r_idx)
        used_det.add(d_idx)
        tp += 1
    fp = int(det_s.size) - tp
    fn = int(ref_s.size) - tp
    return tp, fp, fn


def beat_metrics(
    ref: np.ndarray, det: np.ndarray, fs: float, tol_ms: float = 150.0
) -> BeatMetrics:
    tp, fp, fn = match_beats(ref, det, fs, tol_ms)
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    ppv = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    f1 = 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) > 0 else 0.0
    return BeatMetrics(tp=tp, fp=fp, fn=fn, sensitivity=sensitivity, ppv=ppv, f1=f1)


def evaluate_record(record_id: str, data_dir: Path) -> BeatMetrics:
    rec = load_ecg_record(record_id, data_dir)
    det = detect_r_peaks(rec.signal, rec.fs)
    return beat_metrics(rec.ref_beats, det, rec.fs)


def evaluate_all(data_dir: Path) -> pd.DataFrame:
    """Una fila por registro MIT-BIH con las metricas de latidos."""
    rows: list[dict[str, object]] = []
    for record_id in list_mitdb_records(data_dir):
        row: dict[str, object] = {"record_id": record_id}
        row.update(asdict(evaluate_record(record_id, data_dir)))
        rows.append(row)
    columns = ["record_id", "tp", "fp", "fn", "sensitivity", "ppv", "f1"]
    return pd.DataFrame(rows, columns=columns)


def _load_noise(data_dir: Path, noise: str, n_samples: int) -> NDArray[np.float64]:
    if noise not in NSTDB_NOISE_RECORDS:
        raise ValueError(f"noise debe ser uno de {NSTDB_NOISE_RECORDS}, recibido {noise!r}")
    base = Path(data_dir) / "nstdb" / noise
    if not base.with_suffix(".hea").exists():
        raise FileNotFoundError(f"No existe el registro de ruido NSTDB {noise!r} en {base.parent}")
    rec = wfdb.rdrecord(str(base))
    if rec.p_signal is None:
        raise ValueError(f"El registro de ruido {noise!r} no tiene senal fisica")
    values = np.asarray(rec.p_signal[:, 0], dtype=np.float64)
    if values.size < n_samples:
        raise ValueError(f"El ruido {noise!r} es mas corto que la senal ({values.size} < {n_samples})")
    return values[:n_samples]


def noise_robustness(
    record_id: str, data_dir: Path, snr_db: list[float], noise: str = "em"
) -> pd.DataFrame:
    """F1 de deteccion con ruido real de NSTDB mezclado a cada SNR, con y sin abstencion por SQI.

    kept_fraction es la fraccion de ventanas de SQI_WINDOW_S segundos que el SQI acepta.
    Con abstencion, solo se cuentan los latidos situados en ventanas aceptadas.
    """
    rec = load_ecg_record(record_id, data_dir)
    clean = rec.signal
    fs = rec.fs
    noise_raw = _load_noise(data_dir, noise, clean.size)
    noise_centered = noise_raw - float(np.mean(noise_raw))
    p_noise = float(np.mean(noise_centered**2))
    clean_centered = clean - float(np.mean(clean))
    p_clean = float(np.mean(clean_centered**2))
    if p_noise <= 0 or p_clean <= 0:
        raise ValueError("Senal o ruido sin potencia")

    win = round(SQI_WINDOW_S * fs)
    rows: list[dict[str, float]] = []
    for snr in snr_db:
        scale = math.sqrt(p_clean / (p_noise * 10.0 ** (snr / 10.0)))
        noisy = clean + scale * noise_centered

        det = detect_r_peaks(noisy, fs)
        f1_plain = beat_metrics(rec.ref_beats, det, fs).f1

        sqi = signal_quality_index(noisy, fs, window_s=SQI_WINDOW_S)
        accepted = sqi >= SQI_ACCEPT_THRESHOLD
        kept_fraction = float(np.mean(accepted)) if accepted.size else 0.0

        if accepted.any():
            last_win = accepted.size - 1
            ref_win = np.minimum(rec.ref_beats // win, last_win)
            det_win = np.minimum(det // win, last_win)
            ref_kept = rec.ref_beats[accepted[ref_win]]
            det_kept = det[accepted[det_win]]
            f1_abstain = beat_metrics(ref_kept, det_kept, fs).f1
        else:
            f1_abstain = float("nan")

        rows.append(
            {
                "snr_db": float(snr),
                "f1_no_abstention": float(f1_plain),
                "f1_with_abstention": float(f1_abstain),
                "kept_fraction": kept_fraction,
            }
        )
    return pd.DataFrame(rows, columns=["snr_db", "f1_no_abstention", "f1_with_abstention", "kept_fraction"])
