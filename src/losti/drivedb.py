"""Perfil fisiologico exploratorio sobre DriveDB (PhysioNet, ODC-By v1.0).

Este modulo NO es un clasificador de estres y no devuelve etiquetas. DriveDB no trae
anotaciones de estres en la fuente oficial, asi que todo lo que sale de aqui son metricas
descriptivas por ventana (HR, GSR, frecuencia respiratoria, pendiente del SCL) y un indice
de carga fisiologica relativo a cada registro (z-score). Ese indice no permite afirmar que
un tramo corresponda a estres.

Frecuencias: cada senal tiene su propia frecuencia de muestreo (base del registro multiplicada
por las muestras por frame). El llamador debe pasar fs_hr, fs_gsr y fs_resp reales del registro.
"""

from __future__ import annotations

from collections.abc import Mapping

import numpy as np
import pandas as pd
from scipy import signal as sps

# Ventanas con mas de esta fraccion de muestras invalidas (NaN o fuera de rango) se descartan.
MAX_INVALID_FRAC = 0.2
# Rango fisiologico de HR; fuera de el se considera artefacto o perdida (p. ej. 0 bpm).
HR_MIN_BPM = 20.0
HR_MAX_BPM = 250.0
# Distancia minima entre picos respiratorios: 1.5 s (~40 respiraciones/min como maximo).
RESP_MIN_PEAK_DISTANCE_S = 1.5
# Filtro pasa-bajos para el componente lento (SCL) del GSR.
SCL_CUTOFF_HZ = 0.05
SCL_FILTER_ORDER = 2

PROFILE_COLUMNS: tuple[str, ...] = (
    "t_start_s",
    "hr_mean_bpm",
    "gsr_hand_mean",
    "gsr_foot_mean",
    "resp_rate_bpm",
    "gsr_hand_scl_slope",
)


def _mean_valid(seg: np.ndarray) -> float:
    """Media de las muestras finitas; NaN si la ventana es inválida."""
    if seg.size == 0:
        return np.nan
    finite = seg[np.isfinite(seg)]
    if finite.size == 0 or 1.0 - finite.size / seg.size > MAX_INVALID_FRAC:
        return np.nan
    return float(finite.mean())


def _interpolated_valid(seg: np.ndarray) -> np.ndarray | None:
    """Ventana con NaN interpolados linealmente, o None si es inválida."""
    if seg.size < 2:
        return None
    finite = np.isfinite(seg)
    if 1.0 - finite.mean() > MAX_INVALID_FRAC:
        return None
    if finite.all():
        return seg
    idx = np.arange(seg.size)
    return np.interp(idx, idx[finite], seg[finite])


def _resp_rate_bpm(seg: np.ndarray, fs: float) -> float:
    """Frecuencia respiratoria por conteo de picos de RESP en la ventana."""
    values = _interpolated_valid(seg)
    if values is None or np.std(values) == 0.0:
        return np.nan
    distance = max(1, int(round(RESP_MIN_PEAK_DISTANCE_S * fs)))
    peaks, _ = sps.find_peaks(values, distance=distance)
    duration_s = values.size / fs
    return float(peaks.size / duration_s * 60.0)


def _scl_slope(seg: np.ndarray, fs: float) -> float:
    """Pendiente lineal (unidades de GSR por segundo) del componente lento del GSR."""
    values = _interpolated_valid(seg)
    if values is None:
        return np.nan
    sos = sps.butter(SCL_FILTER_ORDER, SCL_CUTOFF_HZ, btype="low", fs=fs, output="sos")
    smooth = sps.sosfiltfilt(sos, values)
    t = np.arange(values.size) / fs
    slope, _ = np.polyfit(t, smooth, 1)
    return float(slope)


def _segment(arr: np.ndarray, fs: float, t0: float, t1: float) -> np.ndarray:
    """Muestras de arr entre t0 y t1 (segundos)."""
    a = int(round(t0 * fs))
    b = int(round(t1 * fs))
    return arr[a:b]


def physiological_profile(
    record: Mapping[str, np.ndarray | float | None],
    window_s: float = 60.0,
) -> pd.DataFrame:
    """Calcula metricas fisiologicas por ventana no solapada de `window_s` segundos.

    `record` contiene arrays "hr" (bpm), "gsr_foot", "gsr_hand" y "resp", y las frecuencias
    reales "fs_hr", "fs_gsr" y "fs_resp" (Hz). Un array None o ausente produce una columna NaN.

    Columnas: t_start_s, hr_mean_bpm, gsr_hand_mean, gsr_foot_mean, resp_rate_bpm,
    gsr_hand_scl_slope (pendiente en unidades de GSR por segundo).
    El numero de ventanas es el minimo entre las senales presentes.
    """
    if window_s <= 0:
        raise ValueError("window_s debe ser positivo")

    sources: dict[str, tuple[np.ndarray, float]] = {}
    fs_keys = {"hr": "fs_hr", "gsr_hand": "fs_gsr", "gsr_foot": "fs_gsr", "resp": "fs_resp"}
    for name, fs_key in fs_keys.items():
        arr = record.get(name)
        if arr is None:
            continue
        fs_value = record.get(fs_key)
        if fs_value is None:
            raise ValueError(f"Falta la frecuencia {fs_key!r} para la senal {name!r}")
        fs = float(fs_value)
        if fs <= 0:
            raise ValueError(f"{fs_key} debe ser positivo")
        sources[name] = (np.asarray(arr, dtype=np.float64).ravel(), fs)

    if not sources:
        raise ValueError("El registro no tiene senales fisiologicas")

    duration_s = min(arr.size / fs for arr, fs in sources.values())
    n_windows = int(np.floor(duration_s / window_s + 1e-9))

    rows: list[dict[str, float]] = []
    for i in range(n_windows):
        t0 = i * window_s
        t1 = t0 + window_s
        row: dict[str, float] = {col: np.nan for col in PROFILE_COLUMNS}
        row["t_start_s"] = t0

        if "hr" in sources:
            arr, fs = sources["hr"]
            hr = _segment(arr, fs, t0, t1)
            hr = np.where((hr >= HR_MIN_BPM) & (hr <= HR_MAX_BPM), hr, np.nan)
            row["hr_mean_bpm"] = _mean_valid(hr)

        if "gsr_hand" in sources:
            arr, fs = sources["gsr_hand"]
            seg = _segment(arr, fs, t0, t1)
            row["gsr_hand_mean"] = _mean_valid(seg)
            interp = _interpolated_valid(seg)
            if interp is not None:
                row["gsr_hand_scl_slope"] = _scl_slope(seg, fs)

        if "gsr_foot" in sources:
            arr, fs = sources["gsr_foot"]
            row["gsr_foot_mean"] = _mean_valid(_segment(arr, fs, t0, t1))

        if "resp" in sources:
            arr, fs = sources["resp"]
            row["resp_rate_bpm"] = _resp_rate_bpm(_segment(arr, fs, t0, t1), fs)

        rows.append(row)

    return pd.DataFrame(rows, columns=list(PROFILE_COLUMNS))


def _zscore(values: pd.Series) -> pd.Series:
    """Z-score con ddof=0; una serie constante da ceros, los NaN se mantienen."""
    mean = values.mean()
    std = values.std(ddof=0)
    if pd.isna(mean):
        return pd.Series(np.nan, index=values.index, dtype=np.float64)
    if std == 0 or pd.isna(std):
        return (values * 0.0).astype(np.float64)
    return ((values - mean) / std).astype(np.float64)


def load_index(profile: pd.DataFrame) -> pd.Series:
    """Indice de carga fisiologica relativo al registro (NO es una clasificacion de estres).

    Z-score por registro de hr_mean_bpm y gsr_hand_mean, promediados por ventana y
    normalizados de nuevo, de modo que el resultado tiene media ~0 y desvio ~1 por construccion.
    Las ventanas sin ninguna de las dos metricas quedan en NaN.
    """
    name = "load_index"
    if profile.empty:
        return pd.Series(dtype=np.float64, index=profile.index, name=name)

    parts = [
        _zscore(profile[col].astype(np.float64))
        for col in ("hr_mean_bpm", "gsr_hand_mean")
        if col in profile.columns
    ]
    if not parts:
        raise ValueError("El perfil no tiene columnas hr_mean_bpm ni gsr_hand_mean")

    combined = pd.concat(parts, axis=1).mean(axis=1, skipna=True)
    result = _zscore(combined)
    result.name = name
    return result
