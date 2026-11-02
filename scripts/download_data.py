"""Descarga y verifica los datasets de LosTiraVida en data/raw/.

- MIT-BIH y NSTDB: se verifican; si faltan, se descargan con wfdb.dl_database.
- DriveDB (PhysioNet): se verifica (drive01..drive16, drive17a, drive17b); si falta, wfdb.dl_database.
- PAMAP2 (UCI, id 231): se descarga el zip oficial a un directorio temporal (fuera de data/),
  se extrae el zip interno y se copian Protocol/subject101.dat..subject109.dat a
  data/raw/pamap2/Protocol/. Se verifican los 9 sujetos.

Uso:
    python scripts/download_data.py [--data-dir data/raw] [--pamap2-zip RUTA.zip]

--pamap2-zip permite usar un zip de PAMAP2 ya descargado a mano (p. ej. si la URL no responde).
Idempotente: lo que ya esta completo no se vuelve a descargar.
"""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

import requests
import wfdb

PAMAP2_URL = (
    "https://archive.ics.uci.edu/static/public/231/pamap2+physical+activity+monitoring.zip"
)
PAMAP2_INNER_ZIP = "PAMAP2_Dataset.zip"
PAMAP2_PROTOCOL_DIR = "PAMAP2_Dataset/Protocol/"
# PAMAP2 tiene 9 sujetos: subject101..subject109 (ids "1".."9").
PAMAP2_SUBJECT_FILES: tuple[str, ...] = tuple(f"subject{100 + i}.dat" for i in range(1, 10))
# MIT-BIH tiene 48 registros: 100-124 y 200-234, sin 110, 120, 204, 206, 211, 216, 218, 224-227, 229.
MITDB_RECORDS: tuple[str, ...] = tuple(
    [str(i) for i in range(100, 125) if i not in (110, 120)]
    + [str(i) for i in range(200, 235) if i not in (204, 206, 211, 216, 218, 224, 225, 226, 227, 229)]
)
NSTDB_REQUIRED: tuple[str, ...] = ("em", "ma", "bw")
DRIVEDB_RECORDS: tuple[str, ...] = tuple(
    [f"drive{i:02d}" for i in range(1, 17)] + ["drive17a", "drive17b"]
)
_CHUNK = 1 << 20


def _missing_mitdb(mitdb: Path) -> list[str]:
    return [r for r in MITDB_RECORDS if not all((mitdb / f"{r}.{e}").exists() for e in ("hea", "dat", "atr"))]


def _missing_nstdb(nstdb: Path) -> list[str]:
    return [r for r in NSTDB_REQUIRED if not (nstdb / f"{r}.hea").exists()]


def _missing_drivedb(drivedb: Path) -> list[str]:
    return [r for r in DRIVEDB_RECORDS if not all((drivedb / f"{r}.{e}").exists() for e in ("hea", "dat"))]


def _missing_pamap2(pamap2: Path) -> list[str]:
    protocol = pamap2 / "Protocol"
    return [f for f in PAMAP2_SUBJECT_FILES if not (protocol / f).exists()]


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


def ensure_drivedb(data_dir: Path) -> None:
    drivedb = data_dir / "drivedb"
    missing = _missing_drivedb(drivedb)
    if not missing:
        print(f"DriveDB completo: {len(DRIVEDB_RECORDS)} registros en {drivedb}")
        return
    print(f"DriveDB incompleto (faltan {len(missing)} registros). Descargando con wfdb...")
    drivedb.mkdir(parents=True, exist_ok=True)
    wfdb.dl_database("drivedb", dl_dir=str(drivedb))
    still = _missing_drivedb(drivedb)
    if still:
        raise RuntimeError(f"DriveDB sigue incompleto tras descargar: {still}")


def _download(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        with dest.open("wb") as fh:
            for chunk in resp.iter_content(chunk_size=_CHUNK):
                fh.write(chunk)


def _extract_pamap2(zip_path: Path, pamap2: Path, work: Path) -> None:
    """Extrae Protocol/*.dat del zip oficial de UCI (que contiene un zip interno)."""
    if not zipfile.is_zipfile(zip_path):
        raise ValueError(f"El archivo no es un zip valido (puede ser un puntero de UCI): {zip_path}")
    with zipfile.ZipFile(zip_path) as outer:
        if PAMAP2_INNER_ZIP not in outer.namelist():
            raise ValueError(f"El zip no contiene {PAMAP2_INNER_ZIP}; contenido: {outer.namelist()[:5]}")
        outer.extract(PAMAP2_INNER_ZIP, path=work)
    inner_path = work / PAMAP2_INNER_ZIP
    if not zipfile.is_zipfile(inner_path):
        raise ValueError("El zip interno de PAMAP2 no es un zip valido")
    protocol = pamap2 / "Protocol"
    protocol.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(inner_path) as zf:
        members = [n for n in zf.namelist() if n.startswith(PAMAP2_PROTOCOL_DIR) and n.endswith(".dat")]
        if not members:
            raise ValueError("El zip de PAMAP2 no contiene Protocol/*.dat")
        for member in members:
            target = protocol / Path(member).name
            with zf.open(member) as src, target.open("wb") as dst:
                shutil.copyfileobj(src, dst, _CHUNK)


def ensure_pamap2(data_dir: Path, pamap2_zip: Path | None) -> None:
    pamap2 = data_dir / "pamap2"
    missing = _missing_pamap2(pamap2)
    if not missing:
        print(f"PAMAP2 completo: {len(PAMAP2_SUBJECT_FILES)} sujetos en {pamap2 / 'Protocol'}")
        return
    print(f"PAMAP2 incompleto (faltan {len(missing)} sujetos). Preparando descarga...")
    pamap2.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="losti_pamap2_") as tmp:
        work = Path(tmp)
        if pamap2_zip is not None:
            if not pamap2_zip.is_file():
                raise FileNotFoundError(f"No existe el zip indicado: {pamap2_zip}")
            _extract_pamap2(pamap2_zip, pamap2, work)
        else:
            zip_path = work / "pamap2.zip"
            print(f"Descargando {PAMAP2_URL}")
            _download(PAMAP2_URL, zip_path)
            _extract_pamap2(zip_path, pamap2, work)
    still = _missing_pamap2(pamap2)
    if still:
        raise RuntimeError(f"PAMAP2 incompleto tras extraer, faltan: {still}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Descarga y verifica MIT-BIH, NSTDB, DriveDB y PAMAP2.")
    parser.add_argument("--data-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--pamap2-zip", type=Path, default=None,
                        help="zip oficial de PAMAP2 ya descargado (opcional)")
    args = parser.parse_args(argv)
    data_dir: Path = args.data_dir
    data_dir.mkdir(parents=True, exist_ok=True)
    try:
        ensure_mitdb(data_dir)
        ensure_nstdb(data_dir)
        ensure_drivedb(data_dir)
        ensure_pamap2(data_dir, args.pamap2_zip)
    except (requests.RequestException, OSError, ValueError, RuntimeError, zipfile.BadZipFile) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print("Datasets verificados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
