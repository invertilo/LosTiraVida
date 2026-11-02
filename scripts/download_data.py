"""Descarga y verifica los datasets de LosTiraVida en data/raw/.

- MIT-BIH y NSTDB: se verifican; si faltan, se descargan con wfdb.dl_database.
- WESAD: se descarga el archivo oficial de UCI (si no esta ya completo), se extrae
  en data/raw/wesad/S<n>/S<n>.pkl y se verifica que existan los 15 sujetos.

Uso:
    python scripts/download_data.py [--data-dir data/raw] [--wesad-zip RUTA.zip]

--wesad-zip permite usar un zip de WESAD ya descargado a mano (p. ej. si la URL oficial no responde).
Idempotente: lo que ya esta completo no se vuelve a descargar.
"""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
import zipfile
from pathlib import Path

import requests
import wfdb

WESAD_URL = (
    "https://archive.ics.uci.edu/static/public/465/"
    "wesad+wearable+stress+and+affect+detection.zip"
)
# WESAD tiene 15 sujetos: S2..S17 sin S12.
WESAD_SUBJECTS: tuple[str, ...] = (
    "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11",
    "S13", "S14", "S15", "S16", "S17",
)
# MIT-BIH tiene 48 registros: 100-124 y 200-234, sin 110, 120, 204, 206, 211, 216, 218, 224-227, 229.
MITDB_RECORDS: tuple[str, ...] = tuple(
    [str(i) for i in range(100, 125) if i not in (110, 120)]
    + [str(i) for i in range(200, 235) if i not in (204, 206, 211, 216, 218, 224, 225, 226, 227, 229)]
)
NSTDB_REQUIRED: tuple[str, ...] = ("em", "ma", "bw")
_SUBJECT_PKL = re.compile(r"(?:^|/)(S\d+)/\1\.pkl$")
_CHUNK = 1 << 20


def _missing_mitdb(mitdb: Path) -> list[str]:
    return [r for r in MITDB_RECORDS if not all((mitdb / f"{r}.{e}").exists() for e in ("hea", "dat", "atr"))]


def _missing_nstdb(nstdb: Path) -> list[str]:
    return [r for r in NSTDB_REQUIRED if not (nstdb / f"{r}.hea").exists()]


def _missing_wesad(wesad: Path) -> list[str]:
    return [s for s in WESAD_SUBJECTS if not (wesad / s / f"{s}.pkl").exists()]


def ensure_mitdb(data_dir: Path) -> None:
    mitdb = data_dir / "mitdb"
    missing = _missing_mitdb(mitdb)
    if not missing:
        print(f"MIT-BIH completo: {len(MITDB_RECORDS)} registros en {mitdb}")
        return
    print(f"MIT-BIH incompleto ({len(missing)} registros faltan). Descargando con wfdb...")
    mitdb.mkdir(parents=True, exist_ok=True)
    wfdb.dl_database("mitdb", dl_dir=str(mitdb))
    still = _missing_mitdb(mitdb)
    if still:
        raise RuntimeError(f"MIT-BIH sigue incompleto tras descargar: {still}")


def ensure_nstdb(data_dir: Path) -> None:
    nstdb = data_dir / "nstdb"
    missing = _missing_nstdb(nstdb)
    if not missing:
        print(f"NSTDB presente en {nstdb}")
        return
    print(f"NSTDB incompleta (faltan {missing}). Descargando con wfdb...")
    nstdb.mkdir(parents=True, exist_ok=True)
    wfdb.dl_database("nstdb", dl_dir=str(nstdb))
    still = _missing_nstdb(nstdb)
    if still:
        raise RuntimeError(f"NSTDB sigue incompleta tras descargar: {still}")


def _download(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        with dest.open("wb") as fh:
            for chunk in resp.iter_content(chunk_size=_CHUNK):
                fh.write(chunk)


def _extract_wesad(zip_path: Path, wesad: Path) -> None:
    if not zipfile.is_zipfile(zip_path):
        raise ValueError(f"El archivo no es un zip valido: {zip_path}")
    with zipfile.ZipFile(zip_path) as zf:
        members = [
            (name, hit.group(1))
            for name in zf.namelist()
            if (hit := _SUBJECT_PKL.search(name))
        ]
        if not members:
            raise ValueError(
                "El zip no contiene archivos SXX/SXX.pkl. Puede ser el puntero de UCI "
                "(WESAD.txt) en lugar del dataset completo."
            )
        for member, subject in members:
            target = wesad / subject / f"{subject}.pkl"
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member) as src, target.open("wb") as dst:
                dst.write(src.read())


def ensure_wesad(data_dir: Path, wesad_zip: Path | None) -> None:
    wesad = data_dir / "wesad"
    missing = _missing_wesad(wesad)
    if not missing:
        print(f"WESAD completo: {len(WESAD_SUBJECTS)} sujetos en {wesad}")
        return
    print(f"WESAD incompleto (faltan {len(missing)} sujetos). Preparando descarga...")
    if wesad_zip is not None:
        if not wesad_zip.is_file():
            raise FileNotFoundError(f"No existe el zip indicado: {wesad_zip}")
        _extract_wesad(wesad_zip, wesad)
    else:
        with tempfile.TemporaryDirectory(prefix="losti_wesad_") as tmp:
            zip_path = Path(tmp) / "wesad.zip"
            print(f"Descargando {WESAD_URL}")
            _download(WESAD_URL, zip_path)
            _extract_wesad(zip_path, wesad)
    still = _missing_wesad(wesad)
    if still:
        raise RuntimeError(f"WESAD incompleto tras extraer, faltan: {still}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Descarga y verifica MIT-BIH, NSTDB y WESAD.")
    parser.add_argument("--data-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--wesad-zip", type=Path, default=None,
                        help="zip de WESAD ya descargado (opcional)")
    args = parser.parse_args(argv)
    data_dir: Path = args.data_dir
    data_dir.mkdir(parents=True, exist_ok=True)
    try:
        ensure_mitdb(data_dir)
        ensure_nstdb(data_dir)
        ensure_wesad(data_dir, args.wesad_zip)
    except (requests.RequestException, OSError, ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print("Datasets verificados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
