"""Clasificador de estres (WESAD) con validacion leave-one-subject-out."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

META_COLUMNS: tuple[str, ...] = ("subject_id", "t_start_s", "label")
RANDOM_STATE = 0


def _make_model() -> Pipeline:
    return Pipeline(
        [
            ("scale", StandardScaler()),
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=300,
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                    n_jobs=1,
                ),
            ),
        ]
    )


def _feature_columns(features: pd.DataFrame) -> list[str]:
    cols = [c for c in features.columns if c not in META_COLUMNS]
    if not cols:
        raise ValueError("El DataFrame no tiene columnas de features")
    return cols


def train_loso(features: pd.DataFrame) -> tuple[object, pd.DataFrame]:
    """Leave-one-subject-out sobre las ventanas de extract_windows.

    Filas con features NaN se descartan antes de entrenar. Devuelve el modelo final
    entrenado con todas las filas validas y un DataFrame con una fila por sujeto
    (subject_id, accuracy, f1_macro).
    """
    missing = [c for c in ("subject_id", "label") if c not in features.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias: {missing}")
    feat_cols = _feature_columns(features)
    data = features.dropna(subset=feat_cols).reset_index(drop=True)
    if data.empty:
        raise ValueError("No hay filas completas para entrenar")

    subjects = sorted(data["subject_id"].unique().tolist(), key=_subject_key)
    if len(subjects) < 2:
        raise ValueError("LOSO necesita al menos 2 sujetos")

    x_all = data[feat_cols].to_numpy(dtype=np.float64)
    y_all = data["label"].to_numpy()
    groups = data["subject_id"].to_numpy()

    rows: list[dict[str, object]] = []
    for subject in subjects:
        test = groups == subject
        train = ~test
        model = _make_model()
        model.fit(x_all[train], y_all[train])
        pred = model.predict(x_all[test])
        rows.append(
            {
                "subject_id": subject,
                "accuracy": float(accuracy_score(y_all[test], pred)),
                "f1_macro": float(f1_score(y_all[test], pred, average="macro", zero_division=0)),
            }
        )

    final = _make_model()
    final.fit(x_all, y_all)
    per_subject = pd.DataFrame(rows, columns=["subject_id", "accuracy", "f1_macro"])
    return final, per_subject


def _subject_key(subject: str) -> int:
    digits = "".join(ch for ch in str(subject) if ch.isdigit())
    return int(digits) if digits else 0
