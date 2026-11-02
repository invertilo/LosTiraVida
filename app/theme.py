"""Design tokens and shared UI helpers (Apple HIG-inspired, palette from the logo)."""
from __future__ import annotations

import html

import streamlit as st

CSS = """
<style>
:root {
  --bg: #0B1A33;
  --surface: #12274A;
  --surface-2: #1A3360;
  --border: rgba(255,255,255,0.14);
  --text: #FFFFFF;
  --text-2: #B8C6DD;
  --accent: #4DA3FF;
  --on-accent: #0B1A33;
  --shadow: 0 1px 2px rgba(0,0,0,0.24);
  --s1: 8px; --s2: 16px; --s3: 24px; --s4: 32px; --s5: 48px;
  --r-card: 12px; --r-ctl: 8px;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #F4F7FC; --surface: #FFFFFF; --surface-2: #E8EEF8;
    --border: rgba(11,26,51,0.14); --text: #0B1A33; --text-2: #46577A;
    --accent: #0A63C9; --on-accent: #FFFFFF; --shadow: 0 1px 2px rgba(11,26,51,0.08);
  }
}
html, body, .stApp, [data-testid="stAppViewContainer"] {
  background: var(--bg) !important; color: var(--text); font-family: var(--font);
}
.stApp * { font-family: var(--font); }
[data-testid="stHeader"] { background: transparent; }
[data-testid="stToolbar"], [data-testid="stDecoration"], footer { display: none !important; }
.block-container { max-width: 1120px; padding: var(--s3) var(--s2) var(--s5) !important; }
@media (min-width: 768px) { .block-container { padding: var(--s4) var(--s4) var(--s5) !important; } }
html, body { overflow-x: hidden; }

h1, h2, h3 { font-weight: 700; letter-spacing: -0.01em; color: var(--text) !important; margin: 0 !important; padding: 0 !important; }
h1 { font-size: 32px !important; line-height: 40px !important; }
h2 { font-size: 24px !important; line-height: 32px !important; }
p, li, label, .stMarkdown, [data-testid="stMarkdownContainer"] { font-size: 16px; line-height: 24px; color: var(--text); }
a { color: var(--accent) !important; }
a:focus-visible, button:focus-visible, [role="radio"]:focus-visible, input:focus-visible {
  outline: 2px solid var(--accent) !important; outline-offset: 2px;
}

.ltv-brand { display: flex; align-items: center; gap: var(--s2); margin-bottom: var(--s2); }
.ltv-brand img { width: 48px; height: 48px; border-radius: 50%; }
.ltv-brand span { font-size: 24px; font-weight: 700; color: var(--text); }
.ltv-lead { color: var(--text-2); font-size: 16px; line-height: 24px; max-width: 720px; margin: var(--s1) 0 var(--s3); }
.ltv-section { margin: var(--s4) 0 var(--s2); font-size: 24px; line-height: 32px; font-weight: 700; color: var(--text); }
.ltv-grid { display: grid; gap: var(--s2); grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: var(--s2); }
.ltv-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card);
  box-shadow: var(--shadow); padding: var(--s2) var(--s3); box-sizing: border-box;
}
.ltv-card .k { font-size: 15px; line-height: 24px; color: var(--text-2); }
.ltv-card .v { font-size: 24px; line-height: 32px; font-weight: 700; color: var(--text); }
.ltv-card .v.accent { color: var(--accent); }
.ltv-card.body .k { font-size: 15px; }
.ltv-card h3 { font-size: 16px !important; line-height: 24px !important; margin-bottom: var(--s1) !important; }
.ltv-card p, .ltv-card li { font-size: 15px; line-height: 24px; color: var(--text-2); margin: 0; }
.ltv-card ul { margin: 0; padding-left: var(--s3); }
.ltv-alert { border-left: 3px solid var(--accent); }
.ltv-alert .v { font-size: 16px; line-height: 24px; font-weight: 600; }
.ltv-pair { display: grid; gap: var(--s2); grid-template-columns: 1fr; }
@media (min-width: 768px) { .ltv-pair { grid-template-columns: 1fr 1fr; } }
.ltv-note { color: var(--text-2); font-size: 15px; line-height: 24px; padding: var(--s2) var(--s3);
  border: 1px solid var(--border); border-radius: var(--r-card); background: var(--surface); }
.ltv-code { font-family: ui-monospace, "SF Mono", Menlo, monospace !important; font-size: 13px; line-height: 20px;
  white-space: pre-wrap; word-break: break-word; margin: 0; color: var(--text); }

/* Controls */
[data-testid="stButtonGroup"] { max-width: 100%; }
[data-testid="stButtonGroup"] > div, [data-testid="stButtonGroup"] [role="radiogroup"] { flex-wrap: wrap; gap: var(--s1); }
[data-testid="stButtonGroup"] button {
  min-height: 44px; min-width: 44px; border-radius: var(--r-ctl); font-size: 15px; font-weight: 600;
  background: var(--surface); color: var(--text); border: 1px solid var(--border);
}
[data-testid="stButtonGroup"] button[aria-checked="true"], [data-testid="stButtonGroup"] button[aria-pressed="true"],
[data-testid="stButtonGroup"] button[kind$="Active"] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.stButton > button {
  min-height: 44px; border-radius: var(--r-ctl); font-weight: 600; font-size: 15px;
  background: var(--accent); color: var(--on-accent); border: 0;
}
.stButton > button:hover { filter: brightness(1.08); color: var(--on-accent); }
[data-baseweb="select"] > div { min-height: 44px; border-radius: var(--r-ctl); }
[data-testid="stSlider"] { padding-top: var(--s1); }
[data-testid="stDataFrame"] { border: 1px solid var(--border); border-radius: var(--r-card); overflow: hidden; }
[data-testid="stPlotlyChart"] { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card);
  padding: var(--s1); box-sizing: border-box; overflow: hidden; }
[data-testid="stAlert"] { border-radius: var(--r-card); }
</style>
"""


def inject_css() -> None:
    st.markdown(CSS, unsafe_allow_html=True)


def is_dark() -> bool:
    try:
        return st.context.theme.type != "light"
    except Exception:
        return True


def chart_colors() -> dict[str, str]:
    if is_dark():
        return dict(text="#FFFFFF", muted="#B8C6DD", grid="rgba(255,255,255,0.10)",
                    signal="#B8C6DD", accent="#4DA3FF", ref="#FFFFFF")
    return dict(text="#0B1A33", muted="#46577A", grid="rgba(11,26,51,0.10)",
                signal="#46577A", accent="#0A63C9", ref="#0B1A33")


def style_figure(fig, height: int = 360):
    c = chart_colors()
    fig.update_layout(
        height=height, margin=dict(l=8, r=8, t=8, b=8), paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family='-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
                  size=14, color=c["text"]),
        legend=dict(orientation="h", y=-0.2, x=0, font=dict(size=14)),
        hoverlabel=dict(font_size=14),
    )
    fig.update_xaxes(gridcolor=c["grid"], zerolinecolor=c["grid"], linecolor=c["grid"])
    fig.update_yaxes(gridcolor=c["grid"], zerolinecolor=c["grid"], linecolor=c["grid"])
    return fig


def e(text: object) -> str:
    return html.escape(str(text))


def section(title: str) -> None:
    st.markdown(f'<div class="ltv-section">{e(title)}</div>', unsafe_allow_html=True)


def lead(text: str) -> None:
    st.markdown(f'<p class="ltv-lead">{e(text)}</p>', unsafe_allow_html=True)


def metric_grid(items: list[tuple[str, str]], accent_first: bool = False) -> None:
    cells = "".join(
        f'<div class="ltv-card"><div class="k">{e(k)}</div>'
        f'<div class="v{" accent" if accent_first and i == 0 else ""}">{e(v)}</div></div>'
        for i, (k, v) in enumerate(items)
    )
    st.markdown(f'<div class="ltv-grid">{cells}</div>', unsafe_allow_html=True)


def card(title: str, body_html: str, cls: str = "") -> str:
    return f'<div class="ltv-card body {cls}"><h3>{e(title)}</h3>{body_html}</div>'


def note(text: str) -> None:
    st.markdown(f'<div class="ltv-note">{e(text)}</div>', unsafe_allow_html=True)
