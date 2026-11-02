"""Full-screen splash shown on first load and on every section change."""
from __future__ import annotations

import base64
from functools import lru_cache
from pathlib import Path

import streamlit as st

LOGO = Path(__file__).resolve().parent.parent / "assets" / "logo.png"
TOTAL_S = 0.9

_CSS = f"""
<style>
.ltv-splash {{
  position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center;
  background: var(--bg, #0B1A33); pointer-events: none; opacity: 0; visibility: hidden;
  animation: ltv-splash-bg {TOTAL_S}s ease-in-out both;
}}
.ltv-splash img {{
  width: min(40vw, 240px); min-width: 144px; height: auto; border-radius: 50%;
  animation: ltv-splash-logo {TOTAL_S}s cubic-bezier(.2,.7,.2,1) both;
}}
@keyframes ltv-splash-bg {{
  0% {{ opacity: 0; visibility: visible; }}
  25% {{ opacity: 1; }}
  70% {{ opacity: 1; }}
  99% {{ opacity: 0; visibility: visible; }}
  100% {{ opacity: 0; visibility: hidden; }}
}}
@keyframes ltv-splash-logo {{
  0% {{ opacity: 0; transform: scale(.92); }}
  35% {{ opacity: 1; transform: scale(1); }}
  70% {{ opacity: 1; transform: scale(1); }}
  100% {{ opacity: 0; transform: scale(1.04); }}
}}
@media (prefers-reduced-motion: reduce) {{
  .ltv-splash {{ animation: ltv-splash-bg-rm .3s linear both; }}
  .ltv-splash img {{ animation: none; opacity: 1; transform: none; }}
  @keyframes ltv-splash-bg-rm {{
    0% {{ opacity: 1; visibility: visible; }}
    99% {{ opacity: 0; visibility: visible; }}
    100% {{ opacity: 0; visibility: hidden; }}
  }}
}}
</style>
"""


@lru_cache(maxsize=1)
def logo_data_uri() -> str:
    return "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode()


def show_if_section_changed(section: str) -> None:
    """Render the splash when `section` differs from the one last shown (session_state)."""
    if st.session_state.get("_shown_section") != section:
        st.session_state["_shown_section"] = section
        st.session_state["_splash_n"] = st.session_state.get("_splash_n", 0) + 1
        st.markdown(
            f'{_CSS}<div class="ltv-splash" data-n="{st.session_state["_splash_n"]}" role="img" '
            f'aria-label="LosTiraVida"><img src="{logo_data_uri()}" alt=""></div>',
            unsafe_allow_html=True,
        )
