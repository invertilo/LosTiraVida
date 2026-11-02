from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from losti.data_loader import list_mitdb_records, load_ecg_record
from losti.validation import (
    beat_metrics,
    evaluate_all,
    evaluate_record,
    match_beats,
    noise_robustness,
)

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
RECORD_100 = DATA_DIR / "mitdb" / "100.dat"
EM_NOISE = DATA_DIR / "nstdb" / "em.dat"


def _require(path: Path) -> None:
    if not path.exists():
        pytest.skip(f"Falta {path}; ejecute scripts/download_data.py")


def test_match_beats_tolerance_on_real_beats() -> None:
    _require(RECORD_100)
    rec = load_ecg_record("100", DATA_DIR)
    ref = rec.ref_beats[:500]
    n = ref.size
    assert match_beats(ref, ref + 10, rec.fs) == (n, 0, 0)  # 10 ms < 150 ms
    assert match_beats(ref, ref + int(0.2 * rec.fs), rec.fs) == (0, n, n)  # 200 ms > 150 ms


def test_beat_metrics_formulas() -> None:
    m = beat_metrics(np.array([10, 400, 800, 1200]), np.array([12, 405, 2000]), fs=360.0)
    assert (m.tp, m.fp, m.fn) == (2, 1, 2)
    assert m.sensitivity == pytest.approx(0.5)
    assert m.ppv == pytest.approx(2 / 3)
    assert m.f1 == pytest.approx(2 * 2 / (2 * 2 + 1 + 2))


def test_evaluate_record_100_f1() -> None:
    _require(RECORD_100)
    m = evaluate_record("100", DATA_DIR)
    assert m.f1 > 0.99, m


def test_evaluate_all_one_row_per_record() -> None:
    _require(RECORD_100)
    df = evaluate_all(DATA_DIR)
    assert list(df.columns) == ["record_id", "tp", "fp", "fn", "sensitivity", "ppv", "f1"]
    assert len(df) == len(list_mitdb_records(DATA_DIR))
    assert df["f1"].between(0.0, 1.0).all()


def test_noise_robustness_columns_and_kept_fraction() -> None:
    _require(RECORD_100)
    _require(EM_NOISE)
    df = noise_robustness("100", DATA_DIR, snr_db=[24.0, -6.0], noise="em")
    assert list(df.columns) == ["snr_db", "f1_no_abstention", "f1_with_abstention", "kept_fraction"]
    assert df["kept_fraction"].between(0.0, 1.0).all()
    clean_row = df[df["snr_db"] == 24.0].iloc[0]
    noisy_row = df[df["snr_db"] == -6.0].iloc[0]
    assert clean_row["f1_no_abstention"] > 0.99
    assert noisy_row["kept_fraction"] < clean_row["kept_fraction"]


def test_noise_robustness_rejects_unknown_noise() -> None:
    _require(RECORD_100)
    with pytest.raises(ValueError):
        noise_robustness("100", DATA_DIR, snr_db=[0.0], noise="xx")
