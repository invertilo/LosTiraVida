# Contrato de módulos — LosTiraVida

Este documento fija las firmas públicas que usan los distintos agentes.
Si necesitás cambiar una firma, lo anotás acá y avisás al coordinador.

## Reglas generales
- Python 3.12, type hints completos, `from __future__ import annotations`.
- Sin datos simulados ni generados en ningún módulo. Los tests usan los registros reales de `data/`.
  El único ruido sintético permitido es el que se mezcla desde los registros reales de NSTDB (`em`, `ma`), que son ruido real medido.
- Paquete: `src/losti/`. Imports absolutos: `from losti.ecg import detect_r_peaks`.
- Datos en `data/raw/` (no versionados). Rutas siempre recibidas como parámetro, nunca hardcodeadas.
- Sin prints en la librería. Errores con excepciones claras (`FileNotFoundError`, `ValueError`).

## Dataclasses compartidas (`src/losti/types.py`)
```python
@dataclass(frozen=True)
class ECGRecord:
    record_id: str
    fs: float                      # Hz (MIT-BIH = 360)
    signal: np.ndarray             # mV, lead MLII (primera columna)
    ref_beats: np.ndarray          # índices de muestra de latidos anotados
    ref_symbols: list[str]         # símbolos de anotación (N, V, A, ...)

@dataclass(frozen=True)
class HRVMetrics:
    mean_hr_bpm: float
    rmssd_ms: float
    sdnn_ms: float
    pnn50_pct: float

@dataclass(frozen=True)
class BeatMetrics:
    tp: int
    fp: int
    fn: int
    sensitivity: float
    ppv: float
    f1: float

@dataclass(frozen=True)
class Alert:
    kind: str                      # "irregular_rhythm", "low_signal_quality", "sensor_disagreement", "hr_shift"
    start_s: float
    end_s: float
    reasons: list[str]             # frases en inglés, legibles para la UI
```

## `losti/data_loader.py`
```python
def list_mitdb_records(data_dir: Path) -> list[str]
def load_ecg_record(record_id: str, data_dir: Path) -> ECGRecord
def list_wesad_subjects(data_dir: Path) -> list[str]        # ["S2", ..., "S17"]
def load_wesad_subject(subject_id: str, data_dir: Path) -> dict   # claves: "chest" (dict de señales), "wrist" (dict), "label" (np.ndarray, 700 Hz)
```

## `losti/ecg.py`
```python
def bandpass(signal: np.ndarray, fs: float, low: float = 5.0, high: float = 15.0) -> np.ndarray
def detect_r_peaks(signal: np.ndarray, fs: float) -> np.ndarray       # Pan-Tompkins; índices de muestra
def rr_intervals_ms(r_peaks: np.ndarray, fs: float) -> np.ndarray
def heart_rate_bpm(rr_ms: np.ndarray) -> float
def signal_quality_index(signal: np.ndarray, fs: float, window_s: float = 5.0) -> np.ndarray
    # Devuelve un SQI en [0, 1] por ventana (idea 1: abstención)
```

## `losti/hrv.py`
```python
def time_domain_hrv(rr_ms: np.ndarray) -> HRVMetrics
def irregularity_alerts(rr_ms: np.ndarray, beat_times_s: np.ndarray) -> list[Alert]
    # Regla de cribado (no diagnóstica): RR fuera de ±20% de la mediana móvil durante >= 5 latidos seguidos
def cusum_shift(series: np.ndarray, k: float, h: float) -> np.ndarray   # índices de alarma de cambio sostenido (idea 3)
```

## `losti/validation.py`
```python
def match_beats(ref: np.ndarray, det: np.ndarray, fs: float, tol_ms: float = 150.0) -> tuple[int, int, int]  # tp, fp, fn
def beat_metrics(ref: np.ndarray, det: np.ndarray, fs: float, tol_ms: float = 150.0) -> BeatMetrics
def evaluate_record(record_id: str, data_dir: Path) -> BeatMetrics
def evaluate_all(data_dir: Path) -> pd.DataFrame     # una fila por registro, columnas de BeatMetrics + record_id
def noise_robustness(record_id: str, data_dir: Path, snr_db: list[float], noise: str = "em") -> pd.DataFrame
    # columnas: snr_db, f1_no_abstention, f1_with_abstention, kept_fraction
    # ruido real de NSTDB (records "em" o "ma") mezclado a la SNR pedida
```

## `losti/wearable.py`
```python
def extract_windows(subject: dict, window_s: float = 60.0, step_s: float = 30.0) -> pd.DataFrame
    # columnas: subject_id, t_start_s, label, features (EDA mean/slope, TEMP mean, ACC magnitude std, HR chest, HR wrist, RESP rate)
    # label: 1=baseline, 2=stress, 3=amusement (WESAD); se descartan ventanas con label 0 o 4-7
def cross_sensor_check(hr_chest: np.ndarray, hr_wrist: np.ndarray, tol_bpm: float = 10.0) -> list[Alert]  # idea 2
```

## `losti/classifier.py`
```python
def train_loso(features: pd.DataFrame) -> tuple[object, pd.DataFrame]
    # Leave-one-subject-out. Devuelve (modelo final entrenado con todos, DataFrame por sujeto: subject_id, accuracy, f1_macro)
```

## `losti/alerts.py`
```python
def explain(features: dict[str, float], baseline: dict[str, float]) -> list[str]
    # Frases legibles: "Heart rate 112 bpm, 35% above your baseline (74 bpm)" (idea 5)
```

## `losti/privacy.py`
```python
def export_feature_payload(features: dict[str, float], record_id: str) -> dict
    # Solo números agregados. Nunca incluye arrays de señal.
def payload_size_bytes(payload: dict) -> int
def assert_no_raw_signal(payload: dict) -> None   # lanza ValueError si hay listas largas (> 50 elementos)
```

## `losti/report.py`
```python
def build_html_report(record_id: str, beat_metrics: BeatMetrics, hrv: HRVMetrics, alerts: list[Alert]) -> str
```

## `scripts/download_data.py` (CLI)
- `python scripts/download_data.py` descarga MIT-BIH, NSTDB y WESAD en `data/raw/`, y verifica que estén completos.
- Idempotente: si ya existe, no vuelve a descargar.

## `app/` (Streamlit)
- `app/streamlit_app.py`: entrada. Navegación entre secciones con splash screen al entrar y al cambiar de sección.
- Solo consume las funciones públicas de arriba. No contiene lógica de análisis.

## Tests (`tests/`)
- Un archivo por módulo: `tests/test_ecg.py`, `tests/test_hrv.py`, `tests/test_validation.py`, `tests/test_wearable.py`, `tests/test_privacy.py`, `tests/test_alerts.py`.
- Usan datos reales (registro 100 de MIT-BIH, o el sujeto S2 de WESAD). Si los datos no están, el test se marca `skip` con mensaje claro.

## Desvíos aprobados en la implementación (fuente de verdad)
- `extract_windows(subject, window_s=60.0, step_s=30.0, subject_id: str | None = None)`: el dict del loader no trae el id; si no se pasa, lanza `ValueError`.
- `cross_sensor_check(hr_chest, hr_wrist, tol_bpm=10.0, t_start_s=None, window_s=60.0)`: `t_start_s` da los tiempos de las alertas; por defecto asume paso de 30 s.
- Features de `extract_windows` como columnas planas: `subject_id, t_start_s, label, eda_mean, eda_slope, temp_mean, acc_mag_std, hr_chest, hr_wrist, resp_rate`. Se usan sensores de muñeca para EDA/TEMP/ACC.
- `irregularity_alerts` exige `len(beat_times_s) == len(rr_ms) + 1`, o lanza `ValueError`.
- `ecg.heart_rate_bpm` devuelve `NaN` si no hay intervalos RR.
- `validation.noise_robustness`: `f1_with_abstention` es `NaN` si ninguna ventana se acepta.
- Umbral de aceptación del SQI: 0.5 (constante en `validation.py`).
