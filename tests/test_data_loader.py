from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from losti.data_loader import (
    list_drivedb_records,
    list_pamap2_subjects,
    load_drivedb_record,
    load_pamap2_subject,
)

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
DRIVEDB_EXPECTED = [f"drive{i:02d}" for i in range(1, 17)] + ["drive17a", "drive17b"]


def _drivedb_available() -> bool:
    return (DATA_DIR / "drivedb" / "drive01.dat").exists()


def _pamap2_available() -> bool:
    return (DATA_DIR / "pamap2" / "Protocol" / "subject101.dat").exists()


needs_drivedb = pytest.mark.skipif(
    not _drivedb_available(),
    reason=f"Falta DriveDB en {DATA_DIR / 'drivedb'} (ver scripts/download_data.py)",
)
needs_pamap2 = pytest.mark.skipif(
    not _pamap2_available(),
    reason=f"Falta PAMAP2 en {DATA_DIR / 'pamap2'} (ver scripts/download_data.py)",
)


@needs_drivedb
def test_list_drivedb_records_is_complete_and_ordered():
    assert list_drivedb_records(DATA_DIR) == DRIVEDB_EXPECTED


@needs_drivedb
def test_drivedb_drive01_keys_and_real_rates():
    rec = load_drivedb_record("drive01", DATA_DIR)
    assert set(rec) == {
        "ecg", "emg", "gsr_foot", "gsr_hand", "hr", "resp",
        "fs_ecg", "fs_emg", "fs_gsr", "fs_hr", "fs_resp",
    }
    assert rec["fs_ecg"] == pytest.approx(496.0)
    assert rec["fs_emg"] == pytest.approx(1984.0)
    assert rec["fs_gsr"] == pytest.approx(31.0)
    assert rec["fs_hr"] == pytest.approx(15.5)
    assert rec["fs_resp"] == pytest.approx(15.5)
    # 61499 tramas a 15.5 Hz * 32 muestras por trama de ECG
    assert rec["ecg"].shape == (61499 * 32,)
    assert rec["gsr_foot"].shape == (61499 * 2,)
    assert rec["hr"].shape == (61499,)
    assert np.isfinite(rec["ecg"]).all()


@needs_drivedb
def test_drivedb_missing_signals_are_none():
    no_hr = load_drivedb_record("drive03", DATA_DIR)
    assert no_hr["hr"] is None and no_hr["fs_hr"] is None
    no_hand = load_drivedb_record("drive02", DATA_DIR)
    assert no_hand["gsr_hand"] is None
    typo_name = load_drivedb_record("drive07", DATA_DIR)  # en el .hea aparece como "hand GSr"
    assert typo_name["gsr_hand"] is not None and typo_name["fs_gsr"] == pytest.approx(31.0)


@needs_drivedb
def test_drivedb_ecg_rate_varies_per_record():
    assert load_drivedb_record("drive12", DATA_DIR)["fs_ecg"] == pytest.approx(356.5)
    assert load_drivedb_record("drive15", DATA_DIR)["fs_ecg"] == pytest.approx(480.5)


def test_drivedb_unknown_record_raises(tmp_path: Path):
    (tmp_path / "drivedb").mkdir()
    with pytest.raises(FileNotFoundError):
        load_drivedb_record("drive99", tmp_path)


@needs_pamap2
def test_list_pamap2_subjects_has_nine():
    assert list_pamap2_subjects(DATA_DIR) == [str(i) for i in range(1, 10)]


@needs_pamap2
def test_load_pamap2_subject_columns_and_values():
    df = load_pamap2_subject("1", DATA_DIR)
    expected = ["timestamp_s", "activity_id", "heart_rate"] + [
        f"{s}_acc16_{a}" for s in ("hand", "chest", "ankle") for a in ("x", "y", "z")
    ]
    assert list(df.columns) == expected
    assert len(df) > 100_000
    assert df["timestamp_s"].is_monotonic_increasing
    assert np.isclose(np.median(np.diff(df["timestamp_s"].to_numpy()[:1000])), 0.01, atol=1e-3)
    assert set(df["activity_id"].unique()) >= {0, 1}
    # la frecuencia cardiaca viene muy incompleta (~9 Hz sobre 100 Hz)
    assert df["heart_rate"].isna().mean() > 0.5


def test_load_pamap2_rejects_bad_id(tmp_path: Path):
    with pytest.raises(ValueError):
        load_pamap2_subject("10", tmp_path)
