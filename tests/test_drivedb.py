from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from losti.drivedb import PROFILE_COLUMNS, load_index, physiological_profile

DRIVEDB_DIR = Path(__file__).resolve().parents[1] / "data" / "raw" / "drivedb"
DRIVE01 = DRIVEDB_DIR / "drive01.hea"


def _drive01_record() -> dict[str, np.ndarray | float | None]:
    """Lee drive01 con wfdb a la frecuencia nativa de cada senal (las frecuencias del .hea
    son ganancias, no muestreo: fs = base * muestras_por_frame)."""
    wfdb = pytest.importorskip("wfdb")
    rec = wfdb.rdrecord(str(DRIVE01.with_suffix("")), smooth_frames=False)
    by_name = {
        name: (np.asarray(x, dtype=np.float64).ravel(), float(rec.fs) * spf)
        for name, x, spf in zip(rec.sig_name, rec.e_p_signal, rec.samps_per_frame, strict=True)
    }
    hr, fs_hr = by_name["HR"]
    gsr_foot, fs_gsr = by_name["foot GSR"]
    gsr_hand, _ = by_name["hand GSR"]
    resp, fs_resp = by_name["RESP"]
    return {
        "hr": hr,
        "fs_hr": fs_hr,
        "gsr_foot": gsr_foot,
        "gsr_hand": gsr_hand,
        "fs_gsr": fs_gsr,
        "resp": resp,
        "fs_resp": fs_resp,
    }


@pytest.fixture(scope="module")
def drive01_profile() -> pd.DataFrame:
    if not DRIVE01.exists():
        pytest.skip(f"Falta el registro DriveDB drive01 en {DRIVE01}; ejecute scripts/download_data.py")
    return physiological_profile(_drive01_record())


def test_profile_shape_and_columns(drive01_profile: pd.DataFrame) -> None:
    # drive01 dura 61499 / 15.5 Hz = 3967 s -> 66 ventanas completas de 60 s.
    assert list(drive01_profile.columns) == list(PROFILE_COLUMNS)
    assert len(drive01_profile) == 66
    assert drive01_profile["t_start_s"].to_list() == [60.0 * i for i in range(66)]


def test_profile_has_no_label_columns(drive01_profile: pd.DataFrame) -> None:
    # DriveDB no tiene etiquetas de estres: el perfil no debe traer columnas de clase.
    banned = ("label", "stress", "estres", "class")
    for col in drive01_profile.columns:
        assert not any(word in col.lower() for word in banned)


def test_hr_is_physiological_in_most_windows(drive01_profile: pd.DataFrame) -> None:
    hr = drive01_profile["hr_mean_bpm"].dropna()
    assert len(hr) == len(drive01_profile)
    in_range = hr.between(30.0, 200.0)
    assert in_range.mean() >= 0.9


def test_resp_rate_and_gsr_are_finite_on_clean_record(drive01_profile: pd.DataFrame) -> None:
    for col in ("resp_rate_bpm", "gsr_hand_mean", "gsr_foot_mean", "gsr_hand_scl_slope"):
        assert np.isfinite(drive01_profile[col]).all(), col
    assert drive01_profile["resp_rate_bpm"].between(5.0, 60.0).all()


def test_invalid_window_gives_nan_only_for_that_window() -> None:
    if not DRIVE01.exists():
        pytest.skip(f"Falta el registro DriveDB drive01 en {DRIVE01}; ejecute scripts/download_data.py")
    record = _drive01_record()
    resp = np.asarray(record["resp"], dtype=np.float64).copy()
    fs_resp = float(record["fs_resp"])  # type: ignore[arg-type]
    resp[: int(round(60.0 * fs_resp))] = np.nan  # primera ventana completamente invalida
    record["resp"] = resp
    profile = physiological_profile(record)
    assert np.isnan(profile.loc[0, "resp_rate_bpm"])
    assert np.isfinite(profile.loc[1:, "resp_rate_bpm"]).all()


def test_missing_signal_gives_nan_column() -> None:
    if not DRIVE01.exists():
        pytest.skip(f"Falta el registro DriveDB drive01 en {DRIVE01}; ejecute scripts/download_data.py")
    record = _drive01_record()
    record["hr"] = None
    profile = physiological_profile(record)
    assert profile["hr_mean_bpm"].isna().all()
    assert profile["gsr_hand_mean"].notna().all()


def test_load_index_is_standardized(drive01_profile: pd.DataFrame) -> None:
    index = load_index(drive01_profile)
    assert len(index) == len(drive01_profile)
    assert index.mean() == pytest.approx(0.0, abs=1e-9)
    assert index.std(ddof=0) == pytest.approx(1.0, abs=1e-9)


def test_load_index_empty_profile() -> None:
    empty = pd.DataFrame(columns=list(PROFILE_COLUMNS))
    assert load_index(empty).empty
