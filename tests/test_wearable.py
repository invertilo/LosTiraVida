from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from losti.data_loader import list_wesad_subjects, load_wesad_subject
from losti.types import Alert
from losti.wearable import FEATURE_COLUMNS, cross_sensor_check, extract_windows

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
SUBJECT = "S2"


def _wesad_available() -> bool:
    try:
        return SUBJECT in list_wesad_subjects(DATA_DIR)
    except FileNotFoundError:
        return False


pytestmark = pytest.mark.skipif(
    not _wesad_available(),
    reason=f"Falta el sujeto {SUBJECT} de WESAD en {DATA_DIR / 'wesad'} (ver scripts/download_data.py)",
)


@pytest.fixture(scope="module")
def windows():
    subject = load_wesad_subject(SUBJECT, DATA_DIR)
    return extract_windows(subject, window_s=60.0, step_s=30.0, subject_id=SUBJECT)


def test_extract_windows_columns_and_labels(windows):
    assert list(windows.columns) == ["subject_id", "t_start_s", "label", *FEATURE_COLUMNS]
    assert len(windows) > 0
    assert set(windows["label"].unique()) <= {1, 2, 3}
    assert set(windows["subject_id"]) == {SUBJECT}


def test_extract_windows_step_spacing(windows):
    starts = np.sort(windows["t_start_s"].to_numpy())
    assert np.allclose(np.diff(starts), 30.0)


def test_extract_windows_features_are_plausible(windows):
    hr_chest = windows["hr_chest"].dropna()
    assert len(hr_chest) > 0.9 * len(windows)
    assert hr_chest.between(30, 220).all()
    assert windows["temp_mean"].dropna().between(20, 45).all()
    assert (windows["resp_rate"].dropna() >= 0).all()


def test_extract_windows_requires_subject_id():
    subject = load_wesad_subject(SUBJECT, DATA_DIR)
    with pytest.raises(ValueError):
        extract_windows(subject)


def test_cross_sensor_check_matches_run_rule_on_real_features(windows):
    chest = windows["hr_chest"].to_numpy()
    wrist = windows["hr_wrist"].to_numpy()
    starts = windows["t_start_s"].to_numpy()
    tol = 0.0
    alerts = cross_sensor_check(chest, wrist, tol_bpm=tol, t_start_s=starts, window_s=60.0)

    # Recuento independiente de rachas de al menos 3 ventanas con diferencia > tol.
    diff = np.abs(chest - wrist)
    bad = np.isfinite(diff) & (diff > tol)
    expected, i = 0, 0
    while i < len(bad):
        if not bad[i]:
            i += 1
            continue
        j = i
        while j + 1 < len(bad) and bad[j + 1]:
            j += 1
        if j - i + 1 >= 3:
            expected += 1
        i = j + 1

    assert len(alerts) == expected
    for alert in alerts:
        assert isinstance(alert, Alert)
        assert alert.kind == "sensor_disagreement"
        assert alert.end_s > alert.start_s
        assert alert.reasons
