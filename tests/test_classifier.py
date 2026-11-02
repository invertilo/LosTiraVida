from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from losti.classifier import train_loso
from losti.data_loader import list_pamap2_subjects, load_pamap2_subject
from losti.wearable import extract_pamap2_windows

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"


def _pamap2_available() -> bool:
    try:
        return len(list_pamap2_subjects(DATA_DIR)) == 9
    except FileNotFoundError:
        return False


pytestmark = pytest.mark.skipif(
    not _pamap2_available(),
    reason=f"Faltan los 9 sujetos PAMAP2 en {DATA_DIR / 'pamap2'} (ver scripts/download_data.py)",
)


@pytest.fixture(scope="module")
def features() -> pd.DataFrame:
    frames = [
        extract_pamap2_windows(load_pamap2_subject(s, DATA_DIR), s)
        for s in list_pamap2_subjects(DATA_DIR)
    ]
    return pd.concat(frames, ignore_index=True)


def test_train_loso_one_row_per_subject(features: pd.DataFrame):
    model, per_subject = train_loso(features)
    assert list(per_subject.columns) == ["subject_id", "accuracy", "f1_macro", "n_windows"]
    assert len(per_subject) == 9
    assert per_subject["accuracy"].between(0, 1).all()
    assert per_subject["f1_macro"].between(0, 1).all()
    assert per_subject["n_windows"].sum() == len(features.dropna(subset=["label"]))
    assert hasattr(model, "predict")


def test_train_loso_custom_label_col(features: pd.DataFrame):
    renamed = features.rename(columns={"label": "activity"})
    _, per_subject = train_loso(renamed, label_col="activity")
    assert len(per_subject) == 9


def test_train_loso_imputes_nan(features: pd.DataFrame):
    with_nan = features.copy()
    with_nan.loc[with_nan.index[::7], "hr_mean"] = np.nan
    _, per_subject = train_loso(with_nan)
    assert per_subject["accuracy"].notna().all()


def test_train_loso_requires_two_subjects(features: pd.DataFrame):
    one = features[features["subject_id"] == "1"]
    with pytest.raises(ValueError):
        train_loso(one)
