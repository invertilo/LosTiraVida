from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from losti.data_loader import load_ecg_record
from losti.privacy import assert_no_raw_signal, export_feature_payload, payload_size_bytes

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
SUBJECT = "S2"


def _wesad_available() -> bool:
    # WESAD fue retirado del proyecto (ver docs/CONTRACT.md); estos tests quedan saltados.
    return False


def _mitdb_available() -> bool:
    return (DATA_DIR / "mitdb" / "100.dat").exists()


needs_wesad = pytest.mark.skipif(
    not _wesad_available(),
    reason="WESAD retirado del proyecto; test pendiente de adaptar a PAMAP2",
)
needs_mitdb = pytest.mark.skipif(
    not _mitdb_available(),
    reason=f"Falta el registro MIT-BIH 100 en {DATA_DIR / 'mitdb'} (ver scripts/download_data.py)",
)


@needs_wesad
def test_payload_from_real_window_features_is_scalar_only():
    subject = load_wesad_subject(SUBJECT, DATA_DIR)
    windows = extract_windows(subject, subject_id=SUBJECT)
    row = windows.iloc[0]
    features = {k: float(row[k]) for k in ("eda_mean", "eda_slope", "temp_mean",
                                           "acc_mag_std", "hr_chest", "hr_wrist", "resp_rate")
                if np.isfinite(row[k])}
    payload = export_feature_payload(features, record_id=SUBJECT)

    assert payload["record_id"] == SUBJECT
    assert set(payload["features"]) == set(features)
    assert all(isinstance(v, float) for v in payload["features"].values())
    assert_no_raw_signal(payload)
    assert payload_size_bytes(payload) < 1024


@needs_mitdb
def test_export_rejects_real_raw_signal():
    record = load_ecg_record("100", DATA_DIR)
    with pytest.raises(ValueError):
        export_feature_payload({"raw": record.signal}, record_id="100")  # type: ignore[dict-item]
    with pytest.raises(ValueError):
        assert_no_raw_signal({"features": {"ecg": record.signal[:500].tolist()}})
    with pytest.raises(ValueError):
        assert_no_raw_signal({"features": {"ecg": record.signal[:500]}})


@needs_mitdb
def test_small_real_payload_passes_check():
    record = load_ecg_record("100", DATA_DIR)
    mean_mv = float(np.mean(record.signal))
    payload = export_feature_payload({"mean_ecg_mv": mean_mv}, record_id="100")
    assert_no_raw_signal(payload)
    assert payload_size_bytes(payload) > 0


def test_export_rejects_non_finite_and_string_values():
    with pytest.raises(ValueError):
        export_feature_payload({"hr": float("nan")}, record_id="x")
    with pytest.raises(ValueError):
        export_feature_payload({"hr": "70"}, record_id="x")  # type: ignore[dict-item]
