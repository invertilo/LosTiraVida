from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class ECGRecord:
    record_id: str
    fs: float  # Hz (MIT-BIH = 360)
    signal: np.ndarray  # mV, lead MLII
    ref_beats: np.ndarray  # indices de muestra de latidos anotados
    ref_symbols: list[str]  # simbolos de anotacion (N, V, A, ...)


@dataclass(frozen=True)
class HRVMetrics:
    mean_hr_bpm: float
    rmssd_ms: float
    sdnn_ms: float
    pnn50_pct: float


@dataclass(frozen=True)
class BeatMetrics:
    tp: int
    fp: int
    fn: int
    sensitivity: float
    ppv: float
    f1: float


@dataclass(frozen=True)
class Alert:
    kind: str  # "irregular_rhythm", "low_signal_quality", "sensor_disagreement", "hr_shift"
    start_s: float
    end_s: float
    reasons: list[str]  # frases en ingles, legibles para la UI
