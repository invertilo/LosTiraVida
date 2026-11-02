"""Frases legibles en ingles que explican por que una ventana difiere del baseline del usuario."""

from __future__ import annotations

import math

# nombre legible, unidad, decimales
FEATURE_LABELS: dict[str, tuple[str, str, int]] = {
    "hr_chest": ("Heart rate", "bpm", 0),
    "hr_wrist": ("Wrist heart rate", "bpm", 0),
    "resp_rate": ("Breathing rate", "breaths/min", 0),
    "eda_mean": ("Skin conductance", "uS", 2),
    "eda_slope": ("Skin conductance trend", "uS/s", 4),
    "temp_mean": ("Skin temperature", "C", 2),
    "acc_mag_std": ("Movement variability", "", 3),
}

MIN_CHANGE_PCT = 10.0


def explain(features: dict[str, float], baseline: dict[str, float]) -> list[str]:
    """Devuelve frases como 'Heart rate 112 bpm, 35% above your baseline (74 bpm)'.

    Solo se incluyen las features con cambio relativo de al menos MIN_CHANGE_PCT
    frente al baseline. Las features sin baseline utilizable (ausente, cero o no finito) se omiten.
    """
    phrases: list[str] = []
    for key, value in features.items():
        if key not in baseline:
            continue
        base = float(baseline[key])
        val = float(value)
        if not (math.isfinite(base) and math.isfinite(val)) or base == 0.0:
            continue
        change_pct = (val - base) / abs(base) * 100.0
        if abs(change_pct) < MIN_CHANGE_PCT:
            continue
        label, unit, decimals = FEATURE_LABELS.get(
            key, (key.replace("_", " ").capitalize(), "", 2)
        )
        direction = "above" if change_pct > 0 else "below"
        unit_txt = f" {unit}" if unit else ""
        phrases.append(
            f"{label} {val:.{decimals}f}{unit_txt}, "
            f"{abs(change_pct):.0f}% {direction} your baseline "
            f"({base:.{decimals}f}{unit_txt})"
        )
    return phrases
