import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ActiveEffect, SimulationState } from '../engine/types';
import { EVENT_PRESENTATION } from '../lib/eventPresentation';

export function EventEffectsLayer({ state }: { state: SimulationState }) {
  const [soundOn, setSoundOn] = useState(false);
  const [flashEffect, setFlashEffect] = useState<ActiveEffect | null>(null);
  const [resolutionFlash, setResolutionFlash] = useState(false);
  const lastEvent = useRef(state.eventLog.length);
  const lastVisualEvent = useRef(state.eventLog.length);
  const context = useRef<AudioContext | null>(null);
  const active = state.activeEffects[0];
  useEffect(() => {
    const fresh = state.eventLog.slice(lastVisualEvent.current);
    lastVisualEvent.current = state.eventLog.length;
    if (!fresh.length) return;
    const latest = fresh[fresh.length - 1];
    if (latest.effect) {
      setFlashEffect({ ...latest.effect, id: state.eventLog.length, title: latest.title, remainingHours: latest.effect.durationHours });
      const timeout = window.setTimeout(() => setFlashEffect(null), 2200);
      return () => window.clearTimeout(timeout);
    }
    if (latest.title.startsWith('Resuelto:')) {
      setResolutionFlash(true);
      const timeout = window.setTimeout(() => setResolutionFlash(false), 800);
      return () => window.clearTimeout(timeout);
    }
  }, [state.eventLog]);
  useEffect(() => {
    const fresh = state.eventLog.slice(lastEvent.current);
    lastEvent.current = state.eventLog.length;
    if (!soundOn || fresh.length === 0) return;
    const eventKind = fresh[0].effect?.kind;
    const isResolved = fresh[0].title.startsWith('Resuelto:');
    if (!eventKind && !isResolved) return;
    const Ctx = window.AudioContext;
    if (!context.current && Ctx) context.current = new Ctx();
    const audio = context.current;
    if (!audio) return;
    void audio.resume().then(() => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = isResolved ? 880 : EVENT_PRESENTATION[eventKind!].frequency;
      gain.gain.setValueAtTime(0.035, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + 0.18);
    });
  }, [state.eventLog, soundOn]);

  return <>
    {flashEffect && <div className={`event-effects event-${EVENT_PRESENTATION[flashEffect.kind].effectClass}`} style={{ '--event-color': EVENT_PRESENTATION[flashEffect.kind].color } as CSSProperties} aria-hidden="true"><span /></div>}
    {resolutionFlash && <div className="event-resolution" aria-hidden="true" />}
    <button type="button" className="sound-toggle btn8 btn8-secondary" aria-pressed={soundOn} onClick={() => setSoundOn(value => {
      if (!value && !context.current && window.AudioContext) context.current = new window.AudioContext();
      return !value;
    })}>{soundOn ? 'SONIDO: SÍ' : 'SONIDO: NO'}</button>
    <span className="sr-only" aria-live="polite">{active ? `Efecto visual: ${active.title}` : ''}</span>
  </>;
}
