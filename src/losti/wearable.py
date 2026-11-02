"""Ventanas de features a partir de PAMAP2 (IMU de mano, pecho y tobillo, y frecuencia cardiaca).

Por ventana: media y desviacion de FC (ignorando NaN) y media/desviacion de la magnitud del
acelerometro (acc16) de cada IMU. Las ventanas con etiqueta mayoritaria 0 (transitorio) o con
mas de 20% de NaN en el acelerometro de algun IMU se descartan.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from numpy.typing import NDArray

SENSORS: tuple[str, ...] = ("hand", "chest", "ankle")
AXES: tuple[str, ...] = ("x", "y", "z")
TRANSIENT_LABEL = 0
MAX_NAN_FRACTION = 0.20
FEATURE_COLUMNS: tuple[str, ...] = (
    "hr_mean",
    "hr_std",
    *(f"acc_mag_mean_{s}" for s in SENSORS),
    *(f"acc_mag_std_{s}" for s in SENSORS),
)
_REQUIRED_COLUMNS: tuple[str, ...] = (
    "timestamp_s",
    "activity_id",
    "heart_rate",
    *(f"{s}_acc16_{a}" for s in SENSORS for a in AXES),
)

_FloatArray = NDArray[np.float64]


def _interp_nan(t: _FloatArray, values: _FloatArray) -> _FloatArray:
    """Interpola linealmente los NaN de una serie dentro de la ventana (extremos: valor mas cercano)."""
    valid = np.isfinite(values)
    if valid.all():
        return values
    return np.interp(t, t[valid], values[valid])


def _mean_std(values: _FloatArray) -> tuple[float, float]:
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return float("nan"), float("nan")
    return float(np.mean(finite)), float(np.std(finite))


def _window_label(activity: NDArray[np.int64]) -> int:
    values, counts = np.unique(activity, return_counts=True)
    return int(values[np.argmax(counts)])


def extract_pamap2_windows(
    df: pd.DataFrame,
    subject_id: str,
    window_s: float = 10.0,
    step_s: float = 5.0,
) -> pd.DataFrame:
    """Extrae features por ventana de un sujeto PAMAP2 cargado con load_pamap2_subject.

    Columnas: subject_id, t_start_s (relativo al primer timestamp), label (activity_id
    mayoritaria), hr_mean, hr_std, acc_mag_mean_{hand,chest,ankle}, acc_mag_std_{hand,chest,ankle}.
    Los NaN del acelerometro se interpolan dentro de cada ventana.
    """
    if not subject_id:
        raise ValueError("subject_id no puede estar vacio")
    if window_s <= 0 or step_s <= 0:
        raise ValueError("window_s y step_s deben ser positivos")
    missing = [c for c in _REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas PAMAP2: {missing}")

    data = df.sort_values("timestamp_s", kind="stable")
    ts = data["timestamp_s"].to_numpy(dtype=np.float64)
    if ts.size == 0:
        return pd.DataFrame(columns=["subject_id", "t_start_s", "label", *FEATURE_COLUMNS])
    rel = ts - ts[0]
    activity = data["activity_id"].to_numpy(dtype=np.int64)
    hr = data["heart_rate"].to_numpy(dtype=np.float64)
    acc = {
        (s, a): data[f"{s}_acc16_{a}"].to_numpy(dtype=np.float64)
        for s in SENSORS
        for a in AXES
    }
    span_s = float(rel[-1])

    rows: list[dict[str, object]] = []
    t0 = 0.0
    while t0 + window_s <= span_s + 1e-9:
        t1 = t0 + window_s
        i0 = int(np.searchsorted(rel, t0, side="left"))
        i1 = int(np.searchsorted(rel, t1, side="left"))
        t0_next = t0 + step_s
        if i1 > i0:
            seg_act = activity[i0:i1]
            label = _window_label(seg_act)
            nan_too_many = any(
                np.mean(~np.isfinite(acc[(s, a)][i0:i1])) > MAX_NAN_FRACTION
                for s in SENSORS
                for a in AXES
            )
            if label != TRANSIENT_LABEL and not nan_too_many:
                seg_t = rel[i0:i1]
                row: dict[str, object] = {
                    "subject_id": subject_id,
                    "t_start_s": t0,
                    "label": label,
                }
                hr_mean, hr_std = _mean_std(hr[i0:i1])
                row["hr_mean"] = hr_mean
                row["hr_std"] = hr_std
                mags: dict[str, _FloatArray] = {}
                for s in SENSORS:
                    xyz = [_interp_nan(seg_t, acc[(s, a)][i0:i1]) for a in AXES]
                    mags[s] = np.sqrt(xyz[0] ** 2 + xyz[1] ** 2 + xyz[2] ** 2)
                for s in SENSORS:
                    mean_s, std_s = _mean_std(mags[s])
                    row[f"acc_mag_mean_{s}"] = mean_s
                    row[f"acc_mag_std_{s}"] = std_s
                rows.append(row)
        t0 = t0_next

    columns = ["subject_id", "t_start_s", "label", *FEATURE_COLUMNS]
    return pd.DataFrame(rows, columns=columns)
