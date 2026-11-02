from __future__ import annotations

import math

import numpy as np
from numpy.typing import NDArray
from scipy.signal import butter, find_peaks, sosfiltfilt
from scipy.stats import kurtosis


def _as_1d(signal: np.ndarray) -> NDArray[np.float64]:
    x = np.asarray(signal, dtype=np.float64)
    if x.ndim != 1:
        raise ValueError(f"signal debe ser 1-D, recibido shape {x.shape}")
    return x


def _check_fs(fs: float) -> None:
    if not (math.isfinite(fs) and fs > 0):
        raise ValueError(f"fs debe ser positiva y finita, recibido {fs}")


def bandpass(signal: np.ndarray, fs: float, low: float = 5.0, high: float = 15.0) -> np.ndarray:
    """Filtro pasabanda Butterworth de orden 2, fase cero (sosfiltfilt)."""
    _check_fs(fs)
    x = _as_1d(signal)
    nyq = fs / 2.0
    if not (0.0 < low < high < nyq):
        raise ValueError(f"Bandas invalidas: 0 < low < high < fs/2 (low={low}, high={high}, fs={fs})")
    if x.size < 30:
        raise ValueError("La senal es demasiado corta para filtrar")
    sos = butter(2, [low / nyq, high / nyq], btype="bandpass", output="sos")
    return np.asarray(sosfiltfilt(sos, x), dtype=np.float64)


def detect_r_peaks(signal: np.ndarray, fs: float) -> np.ndarray:
    """Deteccion de picos R con Pan-Tompkins (pasabanda, derivada, cuadrado, integracion,
    umbrales adaptativos con search-back, periodo refractario y rechazo de onda T).

    Devuelve indices de muestra (int64) de los picos R, ordenados.
    """
    _check_fs(fs)
    x = _as_1d(signal)
    if x.size < 2.0 * fs:
        raise ValueError("Se necesitan al menos 2 s de senal para detectar picos R")

    band = bandpass(x, fs)
    deriv = np.convolve(band, np.array([1.0, 2.0, 0.0, -2.0, -1.0]), mode="same")
    squared = deriv**2
    win = max(1, round(0.150 * fs))
    mwi = np.convolve(squared, np.ones(win) / win, mode="same")

    refrac = round(0.200 * fs)
    tw_window = round(0.360 * fs)
    slope_win = max(1, round(0.075 * fs))
    cands = find_peaks(mwi)[0]
    if cands.size == 0:
        return np.empty(0, dtype=np.int64)

    def slope(i: int) -> float:
        lo = max(0, i - slope_win)
        return float(np.max(np.abs(np.diff(band[lo : i + 1])))) if i > lo else 0.0

    learn = mwi[: int(2.0 * fs)]
    spki = 0.25 * float(learn.max())
    npki = 0.5 * float(learn.mean())
    rr_hist: list[float] = [0.8 * fs]
    accepted: list[int] = []
    slopes: list[float] = []

    def accept(j: int) -> None:
        if accepted:
            rr_hist.append(float(j - accepted[-1]))
            del rr_hist[:-8]
        accepted.append(j)
        slopes.append(slope(j))

    for i_np in cands:
        i = int(i_np)
        pk = float(mwi[i])
        rr_avg = float(np.mean(rr_hist))

        if accepted and (i - accepted[-1]) > 1.66 * rr_avg:
            lo_k = int(np.searchsorted(cands, accepted[-1] + refrac, side="right"))
            hi_k = int(np.searchsorted(cands, i, side="left"))
            if hi_k > lo_k:
                seg = cands[lo_k:hi_k]
                j = int(seg[int(np.argmax(mwi[seg]))])
                thr1 = npki + 0.25 * (spki - npki)
                if mwi[j] > 0.5 * thr1:
                    spki = 0.25 * float(mwi[j]) + 0.75 * spki
                    accept(j)

        if accepted and (i - accepted[-1]) < refrac:
            continue

        thr1 = npki + 0.25 * (spki - npki)
        if pk > thr1:
            is_t_wave = (
                bool(accepted)
                and (i - accepted[-1]) < tw_window
                and slope(i) < 0.5 * slopes[-1]
            )
            if is_t_wave:
                npki = 0.125 * pk + 0.875 * npki
            else:
                spki = 0.125 * pk + 0.875 * spki
                accept(i)
        else:
            npki = 0.125 * pk + 0.875 * npki

    half = max(1, round(0.150 * fs))
    refined: list[int] = []
    for j in accepted:
        lo = max(0, j - half)
        hi = min(x.size, j + half + 1)
        refined.append(lo + int(np.argmax(np.abs(band[lo:hi]))))

    peaks: list[int] = []
    for p in sorted(set(refined)):
        if peaks and p - peaks[-1] < refrac:
            continue
        peaks.append(p)
    return np.asarray(peaks, dtype=np.int64)


def rr_intervals_ms(r_peaks: np.ndarray, fs: float) -> np.ndarray:
    """Intervalos RR en milisegundos. Vacio si hay menos de dos picos."""
    _check_fs(fs)
    r = np.asarray(r_peaks, dtype=np.float64)
    if r.size < 2:
        return np.empty(0, dtype=np.float64)
    return np.diff(r) * 1000.0 / fs


def heart_rate_bpm(rr_ms: np.ndarray) -> float:
    """Frecuencia cardiaca media en bpm. NaN si no hay intervalos RR."""
    rr = np.asarray(rr_ms, dtype=np.float64)
    if rr.size == 0:
        return float("nan")
    mean_rr = float(np.mean(rr))
    if mean_rr <= 0:
        raise ValueError("Los intervalos RR deben ser positivos")
    return 60000.0 / mean_rr


def _window_sqi(seg: NDArray[np.float64], fs: float) -> float:
    """SQI de una ventana: mitad curtosis (picos QRS) y mitad fraccion de potencia en la banda QRS."""
    if seg.size < 3 or float(np.std(seg)) == 0.0:
        return 0.0
    kurt = float(kurtosis(seg, fisher=False))
    kurt_score = min(1.0, max(0.0, (kurt - 3.0) / 3.0))

    centered = seg - np.mean(seg)
    spectrum = np.abs(np.fft.rfft(centered)) ** 2
    freqs = np.fft.rfftfreq(seg.size, d=1.0 / fs)
    total = float(np.sum(spectrum[(freqs >= 0.5) & (freqs <= 40.0)]))
    if total <= 0.0:
        return 0.0
    qrs = float(np.sum(spectrum[(freqs >= 5.0) & (freqs <= 15.0)]))
    spec_score = min(1.0, (qrs / total) / 0.5)

    return 0.5 * kurt_score + 0.5 * spec_score


def signal_quality_index(signal: np.ndarray, fs: float, window_s: float = 5.0) -> np.ndarray:
    """SQI en [0, 1] por ventana de `window_s` segundos (la ultima ventana puede ser mas corta).

    Combina curtosis (un ECG limpio tiene picos marcados) y la fraccion de potencia en la
    banda QRS (5-15 Hz) frente a 0.5-40 Hz.
    """
    _check_fs(fs)
    if not window_s > 0:
        raise ValueError("window_s debe ser positivo")
    x = _as_1d(signal)
    w = round(window_s * fs)
    if w < 3:
        raise ValueError("La ventana es demasiado corta")
    n_windows = math.ceil(x.size / w) if x.size else 0
    out = np.empty(n_windows, dtype=np.float64)
    for k in range(n_windows):
        out[k] = _window_sqi(x[k * w : (k + 1) * w], fs)
    return out
