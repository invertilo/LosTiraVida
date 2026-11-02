from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from losti.data_loader import load_ecg_record
from losti.ecg import detect_r_peaks, heart_rate_bpm, rr_intervals_ms
from losti.hrv import cusum_shift, irregularity_alerts, time_domain_hrv

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
RECORD_100 = DATA_DIR / "mitdb" / "100.dat"
RECORD_119 = DATA_DIR / "mitdb" / "119.dat"


def _rr_and_times(record_id: str, path: Path) -> tuple[np.ndarray, np.ndarray]:
    if not path.exists():
        pytest.skip(f"Falta el registro MIT-BIH {record_id} en {path}; ejecute scripts/download_data.py")
    rec = load_ecg_record(record_id, DATA_DIR)
    peaks = detect_r_peaks(rec.signal, rec.fs)
    rr = rr_intervals_ms(peaks, rec.fs)
    beat_times = peaks / rec.fs
    return rr, beat_times


def test_time_domain_hrv_record_100() -> None:
    rr, _ = _rr_and_times("100", RECORD_100)
    m = time_domain_hrv(rr)
    assert m.mean_hr_bpm == pytest.approx(heart_rate_bpm(rr))
    assert m.rmssd_ms > 0
    assert m.sdnn_ms > 0
    assert 0.0 <= m.pnn50_pct <= 100.0


def test_time_domain_hrv_needs_two_intervals() -> None:
    with pytest.raises(ValueError):
        time_domain_hrv(np.array([800.0]))


def test_irregularity_alerts_normal_vs_ectopic() -> None:
    rr100, t100 = _rr_and_times("100", RECORD_100)
    assert irregularity_alerts(rr100, t100) == []  # ritmo sinusal normal

    rr119, t119 = _rr_and_times("119", RECORD_119)
    alerts = irregularity_alerts(rr119, t119)
    assert len(alerts) > 0  # el registro 119 tiene muchos latidos ventriculares prematuros
    for a in alerts:
        assert a.kind == "irregular_rhythm"
        assert a.end_s > a.start_s
        assert a.reasons


def test_irregularity_alerts_checks_beat_times_length() -> None:
    rr = np.full(10, 800.0)
    with pytest.raises(ValueError):
        irregularity_alerts(rr, np.arange(10, dtype=float))


def test_cusum_shift_indices_and_no_alarm_with_huge_threshold() -> None:
    rr, _ = _rr_and_times("100", RECORD_100)
    hr = 60000.0 / rr
    alarms = cusum_shift(hr, k=2.0, h=20.0)
    assert alarms.dtype.kind == "i"
    assert np.all((alarms >= 0) & (alarms < hr.size))
    assert cusum_shift(hr, k=2.0, h=1e12).size == 0
