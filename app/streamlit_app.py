"""LosTiraVida entry point. Run: .venv/bin/streamlit run app/streamlit_app.py"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import streamlit as st  # noqa: E402

st.set_page_config(page_title="LosTiraVida", page_icon=str(Path(__file__).resolve().parent.parent / "assets" / "logo.png"),
                   layout="wide", initial_sidebar_state="collapsed")

import pages_content as pc  # noqa: E402
import splash  # noqa: E402
import theme  # noqa: E402

theme.inject_css()

st.markdown(f'<div class="ltv-brand"><img src="{splash.logo_data_uri()}" alt=""><span>LosTiraVida</span></div>',
            unsafe_allow_html=True)
choice = st.segmented_control("Section", pc.SECTIONS, default="Overview", key="section", label_visibility="collapsed")
choice = choice or st.session_state.get("_shown_section", "Overview")

splash.show_if_section_changed(choice)

{"Overview": pc.overview, "ECG": pc.ecg, "Validation": pc.validation,
 "Wearable": pc.wearable, "Privacy": pc.privacy, "About": pc.about}[choice]()
