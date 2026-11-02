from __future__ import annotations

import numpy as np

from losti.types import Alert, HRVMetrics

RR_DEVIATION_FRAC = 0.20
RR_MEDIAN_WINDOW = 9
MIN_RUN_BEATS = 5


def time_domain_hrv(rr_ms: np.ndarray) -> HRVMetrics:
    """Metricas HRV en el dominio del tiempo a partir de intervalos RR en ms."""
    rr = np.asarray(rr_ms, dtype=np.float64)
    if rr.size < 2:
        raise ValueError("Se necesitan al menos 2 intervalos RR para calcular HRV")
    diffs = np.diff(rr)
    return HRVMetrics(
        mean_hr_bpm=60000.0 / float(np.mean(rr)),
        rmssd_ms=float(np.sqrt(np.mean(diffs**2))),
        sdnn_ms=float(np.std(rr, ddof=1)),
        pnn50_pct=float(100.0 * np.mean(np.abs(diffs) > 50.0)),
    )


def _rolling_median(rr: np.ndarray, window: int) -> np.ndarray:
    half = window // 2
    out = np.empty_like(rr)
    for i in range(rr.size):
        lo = max(0, i - half)
        hi = min(rr.size, i + half + 1)
        out[i] = np.median(rr[lo:hi])
    return out


def irregularity_alerts(rr_ms: np.ndarray, beat_times_s: np.ndarray) -> list[Alert]:
    """Cribado (no diagnostico): RR fuera de +-20% de la mediana movil durante >= 5 latidos seguidos.

    `beat_times_s` tiene un tiempo por latido, asi que su longitud es len(rr_ms) + 1.
    """
    rr = np.asarray(rr_ms, dtype=np.float64)
    times = np.asarray(beat_times_s, dtype=np.float64)
    if times.size != rr.size + 1:
        raise ValueError(
            f"beat_times_s debe tener len(rr_ms)+1 elementos ({rr.size + 1}), recibido {times.size}"
        )
    if rr.size == 0:
        return []

    med = _rolling_median(rr, RR_MEDIAN_WINDOW)
    deviant = np.abs(rr - med) > RR_DEVIATION_FRAC * med

    alerts: list[Alert] = []
    i = 0
    while i < rr.size:
        if not deviant[i]:
            i += 1
            continue
        j = i
        while j + 1 < rr.size and deviant[j + 1]:
            j += 1
        n_run = j - i + 1
        if n_run >= MIN_RUN_BEATS:
            mean_med = float(np.mean(med[i : j + 1]))
            alerts.append(
                Alert(
                    kind="irregular_rhythm",
                    start_s=float(times[i]),
                    end_s=float(times[j + 1]),
                    reasons=[
                        f"{n_run} consecutive RR intervals deviate more than 20% from the "
                        f"local median (about {mean_med:.0f} ms)",
                        "Screening flag only, not a diagnosis",
                    ],
                )
            )
        i = j + 1
    return alerts


def cusum_shift(series: np.ndarray, k: float, h: float) -> np.ndarray:
    """CUSUM bilateral sobre la serie frente a su mediana. Devuelve los indices de alarma.

    Tras cada alarma los acumuladores se reinician. `k` es la holgura y `h` el umbral de
    decision, en las mismas unidades que la serie.
    """
    x = np.asarray(series, dtype=np.float64)
    if x.ndim != 1:
        raise ValueError("series debe ser 1-D")
    if k < 0 or h <= 0:
        raise ValueError("Se requiere k >= 0 y h > 0")
    if x.size == 0:
        return np.empty(0, dtype=np.int64)

    target = float(np.median(x))
    s_hi = 0.0
    s_lo = 0.0
    alarms: list[int] = []
    for t, value in enumerate(x):
        s_hi = max(0.0, s_hi + (value - target - k))
        s_lo = max(0.0, s_lo + (target - value - k))
        if s_hi > h or s_lo > h:
            alarms.append(t)
            s_hi = 0.0
            s_lo = 0.0
    return np.asarray(alarms, dtype=np.int64)
