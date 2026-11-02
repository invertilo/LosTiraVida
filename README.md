# LosTiraVida

Monitoreo de salud para tripulación, con análisis real sobre datos abiertos de PhysioNet y UCI.

> **Aviso:** es un prototipo para demostración. No es un dispositivo médico, no está validado para diagnóstico ni para uso en vuelo, y no usa datos de astronautas.

## Qué hace
- **ECG (MIT-BIH):** filtro pasa-banda y detección de latidos (Pan-Tompkins), HRV (RMSSD, SDNN, pNN50) y alertas de irregularidad como cribado.
- **Validación:** compara los latidos detectados con las anotaciones de cardiólogos (sensibilidad, precisión, F1) en los 48 registros.
- **Robustez al ruido (NSTDB):** F1 con y sin abstención por índice de calidad de señal.
- **Wearable (WESAD):** clasificación de estado (reposo, estrés, diversión) con validación leave-one-subject-out, y detección de desacuerdo entre sensores de pecho y muñeca.
- **Privacidad:** solo se exportan métricas agregadas; nunca arrays de señal.
- **Reporte HTML** autocontenido por registro.

## Instalación
Requiere Python 3.12.

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/download_data.py   # descarga MIT-BIH y NSTDB (y WESAD si está disponible)
```

## Ejecutar
```bash
.venv/bin/streamlit run app/streamlit_app.py
```

## Tests
```bash
.venv/bin/pytest
```
Los tests usan datos reales. Los que dependen de WESAD se saltan si el dataset no está descargado.

## Fuentes de datos
- MIT-BIH Arrhythmia Database — PhysioNet (https://physionet.org/content/mitdb/1.0.0/)
- MIT-BIH Noise Stress Test Database — PhysioNet (https://physionet.org/content/nstdb/1.0.0/)
- WESAD — UCI Machine Learning Repository (https://archive.ics.uci.edu/dataset/465)

## Estructura
- `src/losti/` — librería de análisis (contrato en `docs/CONTRACT.md`)
- `app/` — interfaz Streamlit
- `scripts/` — descarga de datos
- `tests/` — tests sobre datos reales
- `assets/` — logo
