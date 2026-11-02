"""Ventanas de features a partir de WESAD (pecho + muneca) y chequeo entre sensores.

Sensores usados (WESAD):
- Pecho (chest): ECG para FC de pecho (losti.ecg), Resp para tasa respiratoria.
- Muneca (wrist): EDA y TEMP para media/pendiente y temperatura, ACC para magnitud,
  BVP (PPG) para FC de muneca.
Etiquetas WESAD: 1=baseline, 2=stress, 3=amusement. Se descartan 0 y 4-7.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
from numpy.typing import NDArray
from scipy.signal import butter, find_peaks, sosfiltfilt

from losti.ecg import detect_r_peaks, heart_rate_bpm, rr_intervals_ms
from losti.types import Alert

LABEL_FS = 700.0  # Hz, frecuencia de la etiqueta y del pecho en WESAD
KEEP_LABELS: frozenset[int] = frozenset({1, 2, 3})
MIN_BEATS_FOR_HR = 3  # al menos 2 intervalos RR para estimar FC
FEATURE_COLUMNS: tuple[str, ...] = (
    "eda_mean",
    "eda_slope",
    "temp_mean",
    "acc_mag_std",
    "hr_chest",
    "hr_wrist",
    "resp_rate",
)

_FloatArray = NDArray[np.float64]


def _as_float(x: object) -> _FloatArray:
    return np.asarray(x, dtype=np.float64)


def _sos_bandpass(x: _FloatArray, fs: float, low: float, high: float, order: int) -> _FloatArray:
    sos = butter(order, [low, high], btype="bandpass", fs=fs, output="sos")
    return np.asarray(sosfiltfilt(sos, x), dtype=np.float64)


def _bvp_peak_times(bvp: _FloatArray, fs: float) -> _FloatArray:
    """Picos sistolicos de PPG (BVP de muneca) en segundos."""
    filt = _sos_bandpass(bvp, fs, 0.5, 4.0, order=3)
    spread = float(np.std(filt))
    if spread == 0.0 or not math.isfinite(spread):
        return np.empty(0, dtype=np.float64)
    peaks, _ = find_peaks(filt, distance=max(1, int(0.33 * fs)), prominence=0.5 * spread)
    return peaks.astype(np.float64) / fs


def _resp_peak_times(resp: _FloatArray, fs: float) -> _FloatArray:
    """Picos respiratorios del pecho (0.1-0.5 Hz) en segundos."""
    filt = _sos_bandpass(resp, fs, 0.1, 0.5, order=2)
    spread = float(np.std(filt))
    if spread == 0.0 or not math.isfinite(spread):
        return np.empty(0, dtype=np.float64)
    peaks, _ = find_peaks(filt, distance=max(1, int(1.5 * fs)), prominence=0.3 * spread)
    return peaks.astype(np.float64) / fs


def _hr_in_window(peak_times_s: _FloatArray, t0: float, t1: float) -> float:
    """FC (bpm) a partir de los picos dentro de [t0, t1). NaN si hay pocos latidos."""
    inside = peak_times_s[(peak_times_s >= t0) & (peak_times_s < t1)]
    if inside.size < MIN_BEATS_FOR_HR:
        return float("nan")
    rr = np.diff(inside) * 1000.0
    return heart_rate_bpm(rr)


def _segment(x: _FloatArray, fs: float, t0: float, t1: float) -> _FloatArray:
    i0 = max(0, int(round(t0 * fs)))
    i1 = min(x.shape[0], int(round(t1 * fs)))
    return x[i0:i1]


def _window_label(label: NDArray[np.int64], t0: float, t1: float) -> int:
    """Etiqueta mayoritaria de la ventana (la etiqueta esta a 700 Hz)."""
    seg = _segment(label, LABEL_FS, t0, t1)
    if seg.size == 0:
        return -1
    values, counts = np.unique(seg, return_counts=True)
    return int(values[np.argmax(counts)])


def _eda_slope(eda: _FloatArray, fs: float, t0: float, t1: float) -> float:
    seg = _segment(eda, fs, t0, t1)
    if seg.size < 2:
        return float("nan")
    t = np.arange(seg.size, dtype=np.float64) / fs
    return float(np.polyfit(t, seg, 1)[0])


def _signal_rate(x: _FloatArray, duration_s: float) -> float:
    """Frecuencia de muestreo real de una senal a partir de su duracion (la etiqueta marca la duracion)."""
    if duration_s <= 0:
        raise ValueError("Duracion de registro no valida")
    return x.shape[0] / duration_s


def extract_windows(
    subject: dict[str, Any],
    window_s: float = 60.0,
    step_s: float = 30.0,
    subject_id: str | None = None,
) -> pd.DataFrame:
    """Extrae features por ventana de un sujeto WESAD cargado con load_wesad_subject.

    Columnas: subject_id, t_start_s, label, eda_mean, eda_slope, temp_mean,
    acc_mag_std, hr_chest, hr_wrist, resp_rate. Las ventanas con etiqueta distinta de
    1, 2 o 3 se descartan. El id se toma de subject["subject_id"] o del argumento subject_id.
    """
    sid = subject.get("subject_id", subject_id)
    if not isinstance(sid, str) or not sid:
        raise ValueError("Falta el id del sujeto: pasa subject_id o incluye la clave 'subject_id'")
    if window_s <= 0 or step_s <= 0:
        raise ValueError("window_s y step_s deben ser positivos")

    label = np.asarray(subject["label"]).ravel().astype(np.int64)
    chest: dict[str, Any] = dict(subject["chest"])
    wrist: dict[str, Any] = dict(subject["wrist"])
    duration_s = label.shape[0] / LABEL_FS

    ecg = _as_float(chest["ECG"]).ravel()
    resp = _as_float(chest["Resp"]).ravel()
    ecg_fs = _signal_rate(ecg, duration_s)
    resp_fs = _signal_rate(resp, duration_s)
    chest_peaks = detect_r_peaks(ecg, ecg_fs).astype(np.float64) / ecg_fs
    resp_peaks = _resp_peak_times(resp, resp_fs)

    eda = _as_float(wrist["EDA"]).ravel()
    temp = _as_float(wrist["TEMP"]).ravel()
    acc = _as_float(wrist["ACC"])
    bvp = _as_float(wrist["BVP"]).ravel()
    eda_fs = _signal_rate(eda, duration_s)
    temp_fs = _signal_rate(temp, duration_s)
    acc_fs = _signal_rate(acc, duration_s)
    bvp_fs = _signal_rate(bvp, duration_s)
    acc_mag = np.sqrt(np.sum(acc**2, axis=1))
    wrist_peaks = _bvp_peak_times(bvp, bvp_fs)

    rows: list[dict[str, object]] = []
    t0 = 0.0
    while t0 + window_s <= duration_s + 1e-9:
        t1 = t0 + window_s
        lab = _window_label(label, t0, t1)
        if lab in KEEP_LABELS:
            eda_seg = _segment(eda, eda_fs, t0, t1)
            temp_seg = _segment(temp, temp_fs, t0, t1)
            acc_seg = _segment(acc_mag, acc_fs, t0, t1)
            resp_count = int(np.sum((resp_peaks >= t0) & (resp_peaks < t1)))
            rows.append(
                {
                    "subject_id": sid,
                    "t_start_s": t0,
                    "label": lab,
                    "eda_mean": float(np.mean(eda_seg)) if eda_seg.size else float("nan"),
                    "eda_slope": _eda_slope(eda, eda_fs, t0, t1),
                    "temp_mean": float(np.mean(temp_seg)) if temp_seg.size else float("nan"),
                    "acc_mag_std": float(np.std(acc_seg)) if acc_seg.size else float("nan"),
                    "hr_chest": _hr_in_window(chest_peaks, t0, t1),
                    "hr_wrist": _hr_in_window(wrist_peaks, t0, t1),
                    "resp_rate": resp_count * 60.0 / window_s,
                }
            )
        t0 += step_s

    columns = ["subject_id", "t_start_s", "label", *FEATURE_COLUMNS]
    return pd.DataFrame(rows, columns=columns)


def cross_sensor_check(
    hr_chest: np.ndarray,
    hr_wrist: np.ndarray,
    tol_bpm: float = 10.0,
    t_start_s: np.ndarray | None = None,
    window_s: float = 60.0,
) -> list[Alert]:
    """Idea 2: alerta 'sensor_disagreement' cuando |HR_pecho - HR_muneca| > tol_bpm
    durante al menos 3 ventanas seguidas. Ventanas con NaN cortan la racha.

    t_start_s: inicio de cada ventana en segundos (por defecto 30 s de paso, como extract_windows).
    """
    chest = _as_float(hr_chest).ravel()
    wrist = _as_float(hr_wrist).ravel()
    if chest.shape != wrist.shape:
        raise ValueError("hr_chest y hr_wrist deben tener la misma longitud")
    if tol_bpm < 0:
        raise ValueError("tol_bpm no puede ser negativo")
    n = chest.shape[0]
    starts = np.arange(n, dtype=np.float64) * 30.0 if t_start_s is None else _as_float(t_start_s).ravel()
    if starts.shape != chest.shape:
        raise ValueError("t_start_s debe tener la misma longitud que las frecuencias")

    diff = np.abs(chest - wrist)
    bad = np.isfinite(diff) & (diff > tol_bpm)

    alerts: list[Alert] = []
    i = 0
    while i < n:
        if not bad[i]:
            i += 1
            continue
        j = i
        while j + 1 < n and bad[j + 1]:
            j += 1
        run_len = j - i + 1
        if run_len >= 3:
            run_diff = diff[i : j + 1]
            alerts.append(
                Alert(
                    kind="sensor_disagreement",
                    start_s=float(starts[i]),
                    end_s=float(starts[j] + window_s),
                    reasons=[
                        f"Chest heart rate {chest[i]:.0f} bpm vs wrist {wrist[i]:.0f} bpm "
                        f"at the start of the run",
                        f"Chest and wrist heart rate differ by {float(np.mean(run_diff)):.0f} bpm "
                        f"on average over {run_len} consecutive windows "
                        f"(tolerance {tol_bpm:.0f} bpm)",
                    ],
                )
            )
        i = j + 1
    return alerts
