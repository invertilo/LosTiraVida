from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pytest

from losti.data_loader import load_ecg_record
from losti.ecg import (
    bandpass,
    detect_r_peaks,
    heart_rate_bpm,
    rr_intervals_ms,
    signal_quality_index,
)
from losti.validation import beat_metrics

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
RECORD_100 = DATA_DIR / "mitdb" / "100.dat"


def _record_100():
    if not RECORD_100.exists():
        pytest.skip(f"Falta el registro MIT-BIH 100 en {RECORD_100}; ejecute scripts/download_data.py")
    return load_ecg_record("100", DATA_DIR)


def test_bandpass_rejects_invalid_band() -> None:
    x = np.zeros(1000)
    with pytest.raises(ValueError):
        bandpass(x, fs=360.0, low=15.0, high=5.0)
    with pytest.raises(ValueError):
        bandpass(x, fs=360.0, low=5.0, high=200.0)


def test_detect_r_peaks_record_100_f1() -> None:
    rec = _record_100()
    peaks = detect_r_peaks(rec.signal, rec.fs)
    assert peaks.dtype.kind == "i"
    assert np.all(np.diff(peaks) > 0)
    metrics = beat_metrics(rec.ref_beats, peaks, rec.fs)
    assert metrics.f1 > 0.99, metrics


def test_rr_and_heart_rate_record_100() -> None:
    rec = _record_100()
    peaks = detect_r_peaks(rec.signal, rec.fs)
    rr = rr_intervals_ms(peaks, rec.fs)
    assert rr.size == peaks.size - 1
    assert np.all(rr > 0)
    hr = heart_rate_bpm(rr)
    assert 60.0 < hr < 90.0  # el registro 100 es ritmo sinusal normal


def test_rr_and_heart_rate_edge_cases() -> None:
    assert rr_intervals_ms(np.array([10]), 360.0).size == 0
    assert math.isnan(heart_rate_bpm(np.empty(0)))


def test_signal_quality_index_range_and_length() -> None:
    rec = _record_100()
    sqi = signal_quality_index(rec.signal, rec.fs, window_s=5.0)
    expected_windows = math.ceil(rec.signal.size / round(5.0 * rec.fs))
    assert sqi.shape == (expected_windows,)
    assert np.all((sqi >= 0.0) & (sqi <= 1.0))
