from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from losti.data_loader import load_pamap2_subject
from losti.wearable import FEATURE_COLUMNS, extract_pamap2_windows

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
SUBJECT = "1"


def _pamap2_available() -> bool:
    return (DATA_DIR / "pamap2" / "Protocol" / "subject101.dat").exists()


pytestmark = pytest.mark.skipif(
    not _pamap2_available(),
    reason=f"Falta PAMAP2 en {DATA_DIR / 'pamap2'} (ver scripts/download_data.py)",
)


@pytest.fixture(scope="module")
def windows() -> pd.DataFrame:
    df = load_pamap2_subject(SUBJECT, DATA_DIR)
    return extract_pamap2_windows(df, SUBJECT)


def test_windows_columns_and_labels(windows: pd.DataFrame):
    assert list(windows.columns) == ["subject_id", "t_start_s", "label", *FEATURE_COLUMNS]
    assert len(windows) > 100
    assert set(windows["subject_id"]) == {SUBJECT}
    assert (windows["label"] != 0).all()


def test_windows_step_spacing(windows: pd.DataFrame):
    # Las ventanas caen en la rejilla de 5 s; las descartadas (transitorio) dejan huecos.
    starts = windows["t_start_s"].to_numpy()
    assert np.allclose(np.mod(starts, 5.0), 0.0)
    assert np.all(np.diff(np.sort(starts)) >= 5.0 - 1e-9)


def test_windows_features_are_plausible(windows: pd.DataFrame):
    acc_cols = [c for c in FEATURE_COLUMNS if c.startswith("acc_mag_mean")]
    for col in acc_cols:
        # magnitud del acelerometro en g: en reposo ~1 g, en movimiento algunas unidades
        assert windows[col].between(0.0, 30.0).all()
    assert windows[acc_cols].notna().all().all()
    hr = windows["hr_mean"].dropna()
    assert len(hr) > 0
    assert hr.between(30, 220).all()


def test_transient_label_is_dropped():
    df = load_pamap2_subject(SUBJECT, DATA_DIR).iloc[:20000].copy()
    df.loc[:, "activity_id"] = 0
    out = extract_pamap2_windows(df, SUBJECT)
    assert out.empty


def test_invalid_window_raises():
    df = load_pamap2_subject(SUBJECT, DATA_DIR).iloc[:1000]
    with pytest.raises(ValueError):
        extract_pamap2_windows(df, SUBJECT, window_s=0.0)
