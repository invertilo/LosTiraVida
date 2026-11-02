"""Reporte HTML autocontenido (sin estilos ni scripts externos)."""

from __future__ import annotations

import html
import math

from losti.types import Alert, BeatMetrics, HRVMetrics

_CSS = """
:root { color-scheme: light dark; --fg:#1d1d1f; --bg:#ffffff; --muted:#6e6e73;
        --line:#d2d2d7; --accent:#0a6e5c; }
@media (prefers-color-scheme: dark) {
  :root { --fg:#f5f5f7; --bg:#1c1c1e; --muted:#a1a1a6; --line:#3a3a3c; --accent:#4fd1b5; }
}
body { margin:0; padding:24px 16px; font-family:-apple-system, Helvetica, Arial, sans-serif;
       background:var(--bg); color:var(--fg); line-height:1.45; }
main { max-width:720px; margin:0 auto; }
h1 { font-size:1.5rem; margin:0 0 4px; }
h2 { font-size:1.1rem; margin:24px 0 8px; color:var(--accent); }
p.muted { color:var(--muted); margin:0 0 12px; font-size:0.9rem; }
table { width:100%; border-collapse:collapse; }
th, td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); }
td.num { text-align:right; font-variant-numeric:tabular-nums; }
ul.alerts { padding-left:18px; margin:0; }
ul.alerts li { margin-bottom:10px; }
.kind { font-weight:600; }
.disclaimer { margin-top:28px; font-size:0.85rem; color:var(--muted);
              border-top:1px solid var(--line); padding-top:12px; }
"""


def _fmt(value: float, decimals: int = 2) -> str:
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        return "n/a"
    return f"{value:.{decimals}f}"


def _alert_html(alert: Alert) -> str:
    reasons = "".join(f"<li>{html.escape(r)}</li>" for r in alert.reasons)
    if not reasons:
        reasons = "<li>No details recorded.</li>"
    return (
        f'<li><span class="kind">{html.escape(alert.kind)}</span> '
        f"from {_fmt(alert.start_s, 1)} s to {_fmt(alert.end_s, 1)} s"
        f"<ul>{reasons}</ul></li>"
    )


def build_html_report(
    record_id: str,
    beat_metrics: BeatMetrics,
    hrv: HRVMetrics,
    alerts: list[Alert],
) -> str:
    """Construye el reporte HTML en ingles con metricas de latidos, HRV y alertas."""
    rid = html.escape(str(record_id))
    beat_rows = [
        ("True positives (TP)", str(beat_metrics.tp)),
        ("False positives (FP)", str(beat_metrics.fp)),
        ("False negatives (FN)", str(beat_metrics.fn)),
        ("Sensitivity", _fmt(beat_metrics.sensitivity, 4)),
        ("Positive predictive value", _fmt(beat_metrics.ppv, 4)),
        ("F1 score", _fmt(beat_metrics.f1, 4)),
    ]
    hrv_rows = [
        ("Mean heart rate (bpm)", _fmt(hrv.mean_hr_bpm, 1)),
        ("RMSSD (ms)", _fmt(hrv.rmssd_ms, 1)),
        ("SDNN (ms)", _fmt(hrv.sdnn_ms, 1)),
        ("pNN50 (%)", _fmt(hrv.pnn50_pct, 1)),
    ]

    def table(rows: list[tuple[str, str]]) -> str:
        body = "".join(
            f"<tr><td>{html.escape(k)}</td><td class=\"num\">{html.escape(v)}</td></tr>"
            for k, v in rows
        )
        return f"<table>{body}</table>"

    if alerts:
        alerts_html = f'<ul class="alerts">{"".join(_alert_html(a) for a in alerts)}</ul>'
    else:
        alerts_html = '<p class="muted">No alerts were raised for this record.</p>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LosTiraVida report: record {rid}</title>
<style>{_CSS}</style>
</head>
<body>
<main>
<h1>LosTiraVida report</h1>
<p class="muted">Record {rid}</p>
<h2>Beat detection against reference annotations</h2>
{table(beat_rows)}
<h2>Heart rate variability (time domain)</h2>
{table(hrv_rows)}
<h2>Alerts</h2>
{alerts_html}
<p class="disclaimer">This report is a screening aid. It is not a medical diagnosis.
Consult a clinician for any concern about heart rhythm.</p>
</main>
</body>
</html>
"""
