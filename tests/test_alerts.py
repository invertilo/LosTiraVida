from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from losti.alerts import explain

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
SUBJECT = "S2"


def _wesad_available() -> bool:
    # WESAD fue retirado del proyecto (ver docs/CONTRACT.md); estos tests quedan saltados.
    return False


needs_wesad = pytest.mark.skipif(
    not _wesad_available(),
    reason="WESAD retirado del proyecto; test pendiente de adaptar a PAMAP2",
)


def test_explain_formats_heart_rate_phrase():
    phrases = explain({"hr_chest": 112.0}, {"hr_chest": 74.0})
    assert phrases == ["Heart rate 112 bpm, 51% above your baseline (74 bpm)"]


def test_explain_reports_below_baseline_and_skips_small_changes():
    phrases = explain({"resp_rate": 10.0, "temp_mean": 33.0}, {"resp_rate": 20.0, "temp_mean": 33.1})
    assert phrases == ["Breathing rate 10 breaths/min, 50% below your baseline (20 breaths/min)"]


def test_explain_skips_missing_or_zero_baseline():
    assert explain({"hr_chest": 90.0}, {}) == []
    assert explain({"hr_chest": 90.0}, {"hr_chest": 0.0}) == []
    assert explain({"hr_chest": float("nan")}, {"hr_chest": 70.0}) == []


@needs_wesad
def test_explain_on_real_windows_returns_english_phrases():
    subject = load_wesad_subject(SUBJECT, DATA_DIR)
    windows = extract_windows(subject, subject_id=SUBJECT)
    baseline_rows = windows[windows["label"] == 1]
    assert len(baseline_rows) > 0
    baseline = {k: float(baseline_rows[k].mean()) for k in ("hr_chest", "eda_mean", "resp_rate")}
    stress_row = windows[windows["label"] == 2].iloc[0]
    features = {k: float(stress_row[k]) for k in baseline}
    if not all(np.isfinite(list(features.values()))):
        pytest.skip("La primera ventana de estres no tiene todas las features")
    for phrase in explain(features, baseline):
        assert isinstance(phrase, str)
        assert "baseline" in phrase
