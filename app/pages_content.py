"""Section renderers. The UI only calls the public functions in docs/CONTRACT.md."""
from __future__ import annotations

import json
import sys
from contextlib import contextmanager
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from theme import card, chart_colors, e, lead, metric_grid, note, section, style_figure

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
DATA_DIR = ROOT / "data" / "raw"

SECTIONS = ["Overview", "ECG", "Validation", "Wearable", "Privacy", "About"]


@contextmanager
def guard(what: str):
    """Show a plain message when a module or dataset is not available yet."""
    try:
        yield
    except ImportError as exc:
        note(f"{what} is not available yet: {exc}.")
    except FileNotFoundError as exc:
        note(f"Data not found for {what}. Run python scripts/download_data.py. ({exc})")


# ---------- cached access to the contract ----------
@st.cache_data(show_spinner="Evaluating all records")
def _evaluate_all() -> pd.DataFrame:
    from losti.validation import evaluate_all
    return evaluate_all(DATA_DIR)


@st.cache_data
def _records() -> list[str]:
    from losti.data_loader import list_mitdb_records
    return list_mitdb_records(DATA_DIR)


@st.cache_data(show_spinner="Analyzing record")
def _analyze(record_id: str):
    from losti.data_loader import load_ecg_record
    from losti.ecg import detect_r_peaks, rr_intervals_ms
    from losti.hrv import irregularity_alerts, time_domain_hrv
    from losti.validation import evaluate_record
    rec = load_ecg_record(record_id, DATA_DIR)
    peaks = detect_r_peaks(rec.signal, rec.fs)
    rr = rr_intervals_ms(peaks, rec.fs)
    hrv = time_domain_hrv(rr)
    alerts = irregularity_alerts(rr, peaks[1:] / rec.fs)
    return rec, peaks, hrv, alerts, evaluate_record(record_id, DATA_DIR)


@st.cache_data(show_spinner="Mixing real noise at each SNR")
def _noise(record_id: str, noise: str, snr: tuple[float, ...]) -> pd.DataFrame:
    from losti.validation import noise_robustness
    return noise_robustness(record_id, DATA_DIR, list(snr), noise)


def _pick_record(key: str) -> str | None:
    recs = _records()
    if not recs:
        note("No MIT-BIH records found in data/raw. Run python scripts/download_data.py.")
        return None
    default = recs.index("100") if "100" in recs else 0
    return st.selectbox("Record", recs, index=default, key=key)


def _fmt(df: pd.DataFrame) -> pd.DataFrame:
    return df.rename(columns={c: c.replace("_", " ") for c in df.columns})


# ---------- Overview ----------
def overview() -> None:
    st.markdown("# Heart signals you can trust, on the device")
    lead("LosTiraVida detects heartbeats in ECG, flags irregular rhythm, and abstains when the signal is too noisy "
         "to judge. It also reads wrist and chest sensors for stress, and shares only aggregate numbers, never the raw signal.")
    with guard("Aggregate metrics"):
        df = _evaluate_all()
        tp, fp, fn = int(df["tp"].sum()), int(df["fp"].sum()), int(df["fn"].sum())
        sens = tp / (tp + fn) if tp + fn else 0.0
        ppv = tp / (tp + fp) if tp + fp else 0.0
        f1 = 2 * sens * ppv / (sens + ppv) if sens + ppv else 0.0
        metric_grid([("Records", str(len(df))), ("Beats matched", f"{tp:,}"),
                     ("Sensitivity", f"{sens:.2%}"), ("Precision", f"{ppv:.2%}"), ("F1", f"{f1:.2%}")],
                    accent_first=False)
        section("Per record")
        st.dataframe(_fmt(df), hide_index=True, use_container_width=True)
    section("What it does")
    st.markdown(
        '<div class="ltv-pair">'
        + card("Detect", "<p>R-peak detection on MIT-BIH, scored against cardiologist annotations.</p>")
        + card("Abstain", "<p>A signal quality index skips noisy windows instead of guessing.</p>")
        + card("Keep private", "<p>Only aggregate features leave the device, with a check that no raw signal does.</p>")
        + card("Cross-check", "<p>Chest and wrist heart rate are compared and disagreements are flagged.</p>")
        + "</div>", unsafe_allow_html=True)


# ---------- ECG ----------
def ecg() -> None:
    st.markdown("# ECG")
    lead("Detected beats against annotated reference beats, with heart rate variability and rhythm alerts.")
    with guard("ECG analysis"):
        rid = _pick_record("ecg_rec")
        if rid is None:
            return
        rec, peaks, hrv, alerts, bm = _analyze(rid)
        dur = len(rec.signal) / rec.fs
        c1, c2 = st.columns([1, 2])
        win = c1.selectbox("Window", [10, 20, 30], index=1, format_func=lambda s: f"{s} seconds", key="ecg_win")
        start = c2.slider("Start (s)", 0.0, float(max(dur - win, 1.0)), 0.0, step=1.0, key="ecg_start")
        lo, hi = int(start * rec.fs), int((start + win) * rec.fs)
        t = np.arange(lo, min(hi, len(rec.signal))) / rec.fs
        sig = rec.signal[lo:hi]
        col = chart_colors()
        det = peaks[(peaks >= lo) & (peaks < hi)]
        ref = np.asarray(rec.ref_beats)
        ref = ref[(ref >= lo) & (ref < hi)]
        fig = go.Figure()
        fig.add_trace(go.Scattergl(x=t, y=sig, mode="lines", name="ECG (MLII)", line=dict(color=col["signal"], width=1.2)))
        fig.add_trace(go.Scatter(x=ref / rec.fs, y=rec.signal[ref], mode="markers", name="Annotated",
                                 marker=dict(symbol="circle-open", size=14, color=col["ref"], line=dict(width=2))))
        fig.add_trace(go.Scatter(x=det / rec.fs, y=rec.signal[det], mode="markers", name="Detected",
                                 marker=dict(symbol="triangle-down", size=9, color=col["accent"])))
        for a in alerts:
            if a.end_s >= start and a.start_s <= start + win:
                fig.add_vrect(x0=a.start_s, x1=a.end_s, fillcolor=col["accent"], opacity=0.15, line_width=0)
        fig.update_xaxes(title_text="Time (s)")
        fig.update_yaxes(title_text="mV")
        st.plotly_chart(style_figure(fig, 380), use_container_width=True, config={"displaylogo": False})

        section("Heart rate variability")
        metric_grid([("Mean heart rate", f"{hrv.mean_hr_bpm:.0f} bpm"), ("RMSSD", f"{hrv.rmssd_ms:.1f} ms"),
                     ("SDNN", f"{hrv.sdnn_ms:.1f} ms"), ("pNN50", f"{hrv.pnn50_pct:.1f} %"),
                     ("Detection F1", f"{bm.f1:.2%}")])
        section("Irregularity alerts")
        if not alerts:
            note("No irregular rhythm flagged in this record. This is a screening rule, not a diagnosis.")
        else:
            st.caption(f"{len(alerts)} alert(s). Screening rule, not a diagnosis.")
            for a in alerts[:50]:
                reasons = "".join(f"<li>{e(r)}</li>" for r in a.reasons)
                st.markdown(
                    f'<div class="ltv-card ltv-alert body" style="margin-bottom:8px"><div class="v">'
                    f'{e(a.kind.replace("_", " ").capitalize())}, {a.start_s:.1f} s to {a.end_s:.1f} s</div>'
                    f'<ul>{reasons}</ul></div>', unsafe_allow_html=True)


# ---------- Validation ----------
def validation() -> None:
    st.markdown("# Validation")
    lead("Beat detection scored against annotations, and how accuracy holds as real measured noise increases.")
    with guard("Validation"):
        section("All records")
        st.dataframe(_fmt(_evaluate_all()), hide_index=True, use_container_width=True)
        section("Noise robustness")
        c1, c2 = st.columns(2)
        with c1:
            rid = _pick_record("val_rec")
        noise = c2.selectbox("Noise type", ["em", "ma"], format_func=lambda n: {"em": "Electrode motion", "ma": "Muscle artifact"}[n], key="val_noise")
        if rid is None:
            return
        snr = (24.0, 18.0, 12.0, 6.0, 0.0, -6.0)
        df = _noise(rid, noise, snr).sort_values("snr_db")
        col = chart_colors()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=df["snr_db"], y=df["f1_no_abstention"], mode="lines+markers", name="Without abstention",
                                 line=dict(color=col["muted"], width=2, dash="dash"), marker=dict(symbol="square", size=8)))
        fig.add_trace(go.Scatter(x=df["snr_db"], y=df["f1_with_abstention"], mode="lines+markers", name="With SQI abstention",
                                 line=dict(color=col["accent"], width=2), marker=dict(symbol="circle", size=8)))
        fig.update_xaxes(title_text="SNR (dB)")
        fig.update_yaxes(title_text="F1", range=[0, 1.02])
        st.plotly_chart(style_figure(fig, 360), use_container_width=True, config={"displaylogo": False})
        if "kept_fraction" in df:
            st.dataframe(_fmt(df), hide_index=True, use_container_width=True)


# ---------- Wearable ----------
@st.cache_data(show_spinner="Extracting windows for all subjects")
def _wesad_features(subjects: tuple[str, ...]) -> pd.DataFrame:
    from losti.data_loader import load_wesad_subject
    from losti.wearable import extract_windows
    frames = [extract_windows(load_wesad_subject(s, DATA_DIR), 60.0, 30.0) for s in subjects]
    return pd.concat(frames, ignore_index=True)


@st.cache_data(show_spinner="Training with leave-one-subject-out")
def _loso(subjects: tuple[str, ...]) -> pd.DataFrame:
    from losti.classifier import train_loso
    _, per_subject = train_loso(_wesad_features(subjects))
    return per_subject


def wearable() -> None:
    st.markdown("# Wearable")
    lead("WESAD chest and wrist sensors. A stress classifier is tested on each subject it has never seen.")
    with guard("Wearable analysis"):
        from losti.data_loader import list_wesad_subjects
        subjects = tuple(list_wesad_subjects(DATA_DIR))
        if not subjects:
            note("No WESAD subjects found in data/raw. Run python scripts/download_data.py.")
            return
        metric_grid([("Subjects", str(len(subjects))), ("Labels", "Baseline, stress, amusement")])
        section("Leave-one-subject-out accuracy")
        if st.button("Run evaluation", key="loso_run") or st.session_state.get("loso_done"):
            st.session_state["loso_done"] = True
            res = _loso(subjects)
            col = chart_colors()
            fig = go.Figure(go.Bar(x=res["subject_id"], y=res["accuracy"], marker_color=col["accent"], name="Accuracy"))
            fig.update_yaxes(title_text="Accuracy", range=[0, 1])
            fig.update_xaxes(title_text="Held-out subject")
            st.plotly_chart(style_figure(fig, 320), use_container_width=True, config={"displaylogo": False})
            metric_grid([("Mean accuracy", f"{res['accuracy'].mean():.1%}"),
                         ("Mean macro F1", f"{res['f1_macro'].mean():.1%}")])
            st.dataframe(_fmt(res), hide_index=True, use_container_width=True)
        else:
            note("Training reads every subject file and can take a few minutes. It runs once and is cached.")
        section("Sensor disagreement")
        sub = st.selectbox("Subject", list(subjects), key="wear_sub")
        if st.button("Check chest against wrist", key="xcheck_run"):
            _disagreement(sub)


def _disagreement(sub: str) -> None:
    from losti.wearable import cross_sensor_check
    feats = _wesad_features((sub,))
    flat = pd.json_normalize(feats["features"]) if "features" in feats else feats
    chest = next((c for c in flat.columns if "hr_chest" in c.lower()), None)
    wrist = next((c for c in flat.columns if "hr_wrist" in c.lower()), None)
    if chest is None or wrist is None:
        note("Heart rate columns for chest and wrist were not found in the extracted features.")
        return
    alerts = cross_sensor_check(flat[chest].to_numpy(float), flat[wrist].to_numpy(float))
    if not alerts:
        note("Chest and wrist heart rate agree for this subject.")
    for a in alerts[:50]:
        reasons = "".join(f"<li>{e(r)}</li>" for r in a.reasons)
        st.markdown(f'<div class="ltv-card ltv-alert body" style="margin-bottom:8px"><div class="v">'
                    f'Sensor disagreement, windows {a.start_s:.0f} to {a.end_s:.0f}</div><ul>{reasons}</ul></div>',
                    unsafe_allow_html=True)


# ---------- Privacy ----------
def privacy() -> None:
    st.markdown("# Privacy")
    lead("Heart rate variability is computed on the device. Only the numbers below are exported.")
    with guard("Privacy export"):
        rid = _pick_record("priv_rec")
        if rid is None:
            return
        from losti.privacy import assert_no_raw_signal, export_feature_payload, payload_size_bytes
        rec, _, hrv, _, bm = _analyze(rid)
        feats = {"mean_hr_bpm": hrv.mean_hr_bpm, "rmssd_ms": hrv.rmssd_ms, "sdnn_ms": hrv.sdnn_ms,
                 "pnn50_pct": hrv.pnn50_pct}
        payload = export_feature_payload(feats, rid)
        size = payload_size_bytes(payload)
        try:
            assert_no_raw_signal(payload)
            proof = "Passed: no list longer than 50 elements"
        except ValueError as exc:
            proof = f"Failed: {exc}"
        raw_bytes = int(np.asarray(rec.signal).nbytes)
        metric_grid([("Leaves the device", f"{size:,} bytes"), ("Stays on the device", f"{raw_bytes:,} bytes"),
                     ("Raw signal check", proof.split(":")[0])])
        left = card("Leaves the device", f'<pre class="ltv-code">{e(json.dumps(payload, indent=2))}</pre>')
        right = card("Stays on the device",
                     f"<ul><li>{len(rec.signal):,} ECG samples at {rec.fs:.0f} Hz</li>"
                     f"<li>{len(rec.ref_beats):,} annotated beat positions</li><li>Beat-by-beat RR intervals</li></ul>")
        st.markdown(f'<div class="ltv-pair">{left}{right}</div>', unsafe_allow_html=True)
        note(proof + ". The export function rejects any payload containing a long array.")


# ---------- About ----------
def about() -> None:
    st.markdown("# About")
    lead("A research prototype for on-device cardiac screening, built on public datasets.")
    st.markdown(
        '<div class="ltv-pair">'
        + card("Scope", "<ul><li>ECG beat detection and heart rate variability</li><li>Signal quality abstention</li>"
               "<li>Wearable stress classification and chest-wrist cross-check</li><li>Aggregate-only data export</li></ul>")
        + card("Data sources",
               '<ul><li><a href="https://physionet.org/content/mitdb/1.0.0/">MIT-BIH Arrhythmia Database</a></li>'
               '<li><a href="https://physionet.org/content/nstdb/1.0.0/">MIT-BIH Noise Stress Test Database</a></li>'
               '<li><a href="https://archive.ics.uci.edu/dataset/465/wesad+wearable+stress+and+affect+detection">WESAD</a></li></ul>')
        + card("Limits", "<ul><li>Two-lead, 360 Hz ambulatory recordings, not spaceflight conditions</li>"
               "<li>Irregularity alerts are a screening rule, not a diagnosis</li>"
               "<li>WESAD has 15 subjects, so results carry wide uncertainty</li></ul>")
        + card("Disclaimer", "<p>This is not a medical device. It is not validated for use in flight or for diagnosis, "
               "and it uses no data from astronauts.</p>")
        + "</div>", unsafe_allow_html=True)
