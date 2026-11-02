"""Clasificador de actividad (PAMAP2) con validacion leave-one-subject-out."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

META_COLUMNS: tuple[str, ...] = ("subject_id", "t_start_s")
RANDOM_STATE = 0


def _make_model() -> Pipeline:
    return Pipeline(
        [
            ("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
            ("scale", StandardScaler()),
            (
                "clf",
                RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE),
            ),
        ]
    )


def _feature_columns(features: pd.DataFrame, label_col: str) -> list[str]:
    excluded = {*META_COLUMNS, label_col}
    cols = [
        c
        for c in features.columns
        if c not in excluded and pd.api.types.is_numeric_dtype(features[c])
    ]
    if not cols:
        raise ValueError("El DataFrame no tiene columnas numericas de features")
    return cols


def _subject_key(subject: object) -> tuple[int, str]:
    text = str(subject)
    digits = "".join(ch for ch in text if ch.isdigit())
    return (int(digits) if digits else 0, text)


def train_loso(features: pd.DataFrame, label_col: str = "label") -> tuple[object, pd.DataFrame]:
    """Leave-one-subject-out sobre subject_id.

    features: columnas numericas de features (excepto subject_id, t_start_s y label_col).
    Los NaN de features se imputan con la mediana dentro del pipeline (ajustada solo con
    los sujetos de entrenamiento). Filas sin etiqueta se descartan.
    Devuelve (modelo final entrenado con todas las filas, DataFrame con una fila por sujeto:
    subject_id, accuracy, f1_macro, n_windows).
    """
    missing = [c for c in ("subject_id", label_col) if c not in features.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias: {missing}")
    feat_cols = _feature_columns(features, label_col)
    data = features.dropna(subset=[label_col]).reset_index(drop=True)
    if data.empty:
        raise ValueError("No hay filas etiquetadas para entrenar")

    subjects = sorted(data["subject_id"].unique().tolist(), key=_subject_key)
    if len(subjects) < 2:
        raise ValueError("LOSO necesita al menos 2 sujetos")

    x_all = data[feat_cols].to_numpy(dtype=np.float64)
    y_all = data[label_col].to_numpy()
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
                "n_windows": int(test.sum()),
            }
        )

    final = _make_model()
    final.fit(x_all, y_all)
    per_subject = pd.DataFrame(rows, columns=["subject_id", "accuracy", "f1_macro", "n_windows"])
    return final, per_subject
