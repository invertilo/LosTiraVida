"""Exportacion de features agregadas. El payload nunca contiene arrays de senal."""

from __future__ import annotations

import json
import math
from typing import Any

MAX_LIST_LEN = 50


def export_feature_payload(features: dict[str, float], record_id: str) -> dict[str, Any]:
    """Construye el payload a exportar: solo escalares numericos agregados.

    Lanza ValueError si algun valor no es un escalar numerico finito.
    """
    if not isinstance(record_id, str) or not record_id:
        raise ValueError("record_id debe ser un string no vacio")
    clean: dict[str, float] = {}
    for name, value in features.items():
        if isinstance(value, (str, bytes)):
            raise ValueError(f"La feature {name!r} no es un escalar numerico")
        try:
            number = float(value)  # acepta int, float y escalares numpy
        except (TypeError, ValueError) as exc:
            raise ValueError(f"La feature {name!r} no es un escalar numerico") from exc
        if not math.isfinite(number):
            raise ValueError(f"La feature {name!r} no es finita")
        clean[str(name)] = round(number, 4)
    payload: dict[str, Any] = {"record_id": record_id, "features": clean}
    assert_no_raw_signal(payload)
    return payload


def payload_size_bytes(payload: dict[str, Any]) -> int:
    """Tamano en bytes del payload serializado como JSON (UTF-8)."""
    return len(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))


def assert_no_raw_signal(payload: dict[str, Any]) -> None:
    """Lanza ValueError si el payload contiene arrays o listas largas (posible senal cruda)."""
    _check(payload, path="payload")


def _check(obj: Any, path: str) -> None:
    if hasattr(obj, "__array__") or type(obj).__module__ == "numpy":
        if getattr(obj, "ndim", 0) != 0:
            raise ValueError(f"{path} es un array numpy; el payload solo admite escalares")
        return
    if isinstance(obj, dict):
        for key, value in obj.items():
            _check(value, f"{path}.{key}")
        return
    if isinstance(obj, (list, tuple)):
        if len(obj) > MAX_LIST_LEN:
            raise ValueError(
                f"{path} tiene {len(obj)} elementos (> {MAX_LIST_LEN}); posible senal cruda"
            )
        for i, value in enumerate(obj):
            _check(value, f"{path}[{i}]")
