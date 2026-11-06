import { useCallback, useEffect, useRef, useState } from 'react';
import type { SimulationState } from '../engine/types';
import type { Astronaut, MaintenanceStation } from '../engine/types';
import { Button } from './primitives';
import type { CoopSessionController } from '../hooks/useCoopSession';

type StationInfo = {
  id: MaintenanceStation;
  label: string;
  short: string;
  icon: string;
  x: number;
  system: keyof SimulationState['systems'];
  active: boolean;
  task: string;
};

const BASE_STATIONS: Array<Omit<StationInfo, 'active'>> = [
  { id: 'lifeSupport', label: 'SOPORTE VITAL', short: 'O₂ / PRESIÓN', icon: '◉', x: 10, system: 'lifeSupport', task: 'Estabiliza la presión de cabina' },
  { id: 'power', label: 'ENERGÍA', short: 'BUS ELÉCTRICO', icon: '⚡', x: 21, system: 'power', task: 'Conecta el bus de distribución' },
  { id: 'hydroponics', label: 'INVERNADERO', short: 'HIDROPONÍA', icon: '✿', x: 32, system: 'foodProduction', task: 'Retira las esporas del cultivo' },
  { id: 'communications', label: 'COMUNICACIONES', short: 'ANTENA', icon: '⌁', x: 44, system: 'communications', task: 'Sintoniza la frecuencia de rescate' },
  { id: 'radiationShield', label: 'BLINDAJE', short: 'ESCUDO RADIOLÓGICO', icon: '⬡', x: 67, system: 'radiationShield', task: 'Sincroniza el escudo contra radiación' },
  { id: 'water', label: 'RESERVA DE AGUA', short: 'RECICLAJE', icon: '◌', x: 90, system: 'lifeSupport', task: 'Purga el circuito de recuperación' },
];
const COLORS = ['cyan', 'yellow', 'red'] as const;
const WIRE_SEQUENCE = ['yellow', 'cyan', 'red'] as const;
const PLANT_TARGETS = [1, 3];
const WATER_SEQUENCE = ['ABRIR', 'FILTRAR', 'RECIRCULAR'] as const;
// 0.012% of the 2200px deck per millisecond = 264px/s. One 180px gait takes
// about 680ms, so the character travels responsively without rapid pedalling.
const PLAYER_SPEED_PERCENT_PER_MS = 0.012;
const PLAYER_STRIDE_PERCENT = (180 / 2200) * 100;
const WALK_FRAME_COUNT = 8;

function keepPlayerInView(viewport: HTMLDivElement, playerPercent: number) {
  const playerPixel = playerPercent / 100 * viewport.scrollWidth;
  const positionInViewport = playerPixel - viewport.scrollLeft;
  const leftLimit = viewport.clientWidth * 0.3;
  const rightLimit = viewport.clientWidth * 0.7;
  const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

  if (positionInViewport < leftLimit) {
    viewport.scrollLeft = Math.max(0, playerPixel - leftLimit);
  } else if (positionInViewport > rightLimit) {
    viewport.scrollLeft = Math.min(maxScroll, playerPixel - rightLimit);
  }
}
const TASK_EXPERTISE: Record<MaintenanceStation, string[]> = {
  power: ['engineer'], lifeSupport: ['engineer'], hydroponics: ['scientist', 'botanist'],
  communications: ['commander'], radiationShield: ['engineer', 'geologist'], water: ['engineer', 'doctor'],
};
const ROLE_NAMES: Record<Astronaut['role'], string> = {
  commander: 'Comandante', engineer: 'Ingeniería', scientist: 'Ciencia', doctor: 'Medicina', botanist: 'Botánica', geologist: 'Geología',
};

export function OperationsDeck({ state, onCompleteTask, disabled = false, active = true, focusStation = null, onFocusHandled, onTaskOpenChange, coop = null }: {
  state: SimulationState;
  onCompleteTask: (station: MaintenanceStation, crewId?: string) => string;
  disabled?: boolean;
  active?: boolean;
  focusStation?: MaintenanceStation | null;
  onFocusHandled?: () => void;
  onTaskOpenChange?: (open: boolean) => void;
  coop?: CoopSessionController | null;
}) {
  const [playerX, setPlayerX] = useState(8);
  const [taskStation, setTaskStation] = useState<MaintenanceStation | null>(null);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [wireProgress, setWireProgress] = useState(0);
  const [pressure, setPressure] = useState(17);
  const [plants, setPlants] = useState<number[]>([]);
  const [frequency, setFrequency] = useState(96);
  const [shieldSetting, setShieldSetting] = useState(50);
  const [toast, setToast] = useState('');
  const [crewChoice, setCrewChoice] = useState<{ station: MaintenanceStation; crewId: string } | null>(null);
  const playerXRef = useRef(playerX);
  const facingRef = useRef(facing);
  const movementFrame = useRef<number | undefined>(undefined);
  const lastMovementFrame = useRef(0);
  const lastPositionSync = useRef(0);
  const walkedDistance = useRef(0);
  const pressedKeys = useRef(new Set<string>());
  const pointerDirection = useRef<1 | -1 | 0>(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const playerElementRef = useRef<HTMLDivElement>(null);
  const crewElementRef = useRef<HTMLSpanElement>(null);
  const taskCloseRef = useRef<HTMLButtonElement>(null);
  const taskScoreRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const wasTaskOpenRef = useRef(false);

  const completed = (state.completedMaintenanceTasks ?? []).filter((task) => task.day === state.dayNumber).map((task) => task.station);

  const stations = BASE_STATIONS.map((station) => ({
    ...station,
    active: state.activeEffects.some((effect) => {
      if (station.id === 'power') return effect.kind === 'dust_storm' || (effect.kind === 'equipment_failure' && effect.system === 'power');
      if (station.id === 'lifeSupport') return effect.kind === 'equipment_failure' && effect.system === 'lifeSupport';
      if (station.id === 'hydroponics') return effect.kind === 'crop_disease' || (effect.kind === 'equipment_failure' && effect.system === 'foodProduction');
      if (station.id === 'radiationShield') return effect.kind === 'radiation_spike' || (effect.kind === 'equipment_failure' && effect.system === 'radiationShield');
      if (station.id === 'water') return effect.kind === 'water_leak';
      return effect.kind === 'communication_loss';
    }) || (station.id !== 'water' && state.systems[station.system] !== 'operational'),
  }));

  const visiblePlayerX = active && focusStation ? (BASE_STATIONS.find(station => station.id === focusStation)?.x ?? playerX) - 1 : playerX;
  const visiblePlayerXRef = useRef(visiblePlayerX);
  const setPlayerElement = useCallback((element: HTMLDivElement | null) => {
    playerElementRef.current = element;
    if (element) element.style.left = `${visiblePlayerXRef.current}%`;
  }, []);
  const nearby = stations.find((station) => Math.abs(station.x - visiblePlayerX) < 5.5 && !completed.includes(station.id));
  const activeTaskStation = active && focusStation ? focusStation : taskStation;
  const selected = stations.find((station) => station.id === activeTaskStation);
  const eligibleCrew = state.crew.filter(member => member.healthStatus !== 'critical');
  const defaultCrewId = activeTaskStation
    ? eligibleCrew.find(member => TASK_EXPERTISE[activeTaskStation].includes(member.role))?.id ?? eligibleCrew[0]?.id ?? ''
    : eligibleCrew[0]?.id ?? '';
  const assignedCrewId = crewChoice?.station === activeTaskStation && eligibleCrew.some(member => member.id === crewChoice.crewId)
    ? crewChoice.crewId
    : defaultCrewId;
  const taskOpen = active && Boolean(focusStation || taskStation);
  const sendCoopMovement = coop?.sendMovement;
  const coopPlayerId = coop?.session?.playerId;
  const nearbyStation = nearby?.id;
  const deckCrew = state.crew.find((member) => member.healthStatus === 'critical' || member.healthStatus === 'injured' || member.healthStatus === 'fatigued' || member.stress >= 70) ?? state.crew[0];
  const crewCondition = deckCrew?.healthStatus !== 'healthy' ? deckCrew?.healthStatus : (deckCrew?.stress ?? 0) >= 70 ? 'estresado' : 'healthy';
  const crewConditionLabel = crewCondition === 'healthy' ? '' : crewCondition === 'critical' ? 'CRÍTICO' : crewCondition === 'injured' ? 'HERIDO' : crewCondition === 'fatigued' ? 'CANSADO' : 'ESTRESADO';
  const faultClasses = Object.entries(state.systems).filter(([, status]) => status !== 'operational').map(([system]) => `fault-${system}`).join(' ');

  const movementDirection = useCallback(() => {
    const keyboard = Number(pressedKeys.current.has('ArrowRight') || pressedKeys.current.has('d')) -
      Number(pressedKeys.current.has('ArrowLeft') || pressedKeys.current.has('a'));
    return keyboard || pointerDirection.current;
  }, []);

  const stopMovement = useCallback(() => {
    if (movementFrame.current !== undefined) cancelAnimationFrame(movementFrame.current);
    movementFrame.current = undefined;
    lastMovementFrame.current = 0;
    lastPositionSync.current = 0;
    setPlayerX(playerXRef.current);
    setWalking(false);
  }, []);

  const startMovement = useCallback(() => {
    if (movementFrame.current !== undefined) return;
    setWalking(true);
    const tick = (now: number) => {
      const direction = movementDirection();
      if (!direction) { stopMovement(); return; }
      const nextFacing = direction < 0 ? -1 : 1;
      if (facingRef.current !== nextFacing) {
        facingRef.current = nextFacing;
        setFacing(nextFacing);
      }
      const elapsed = lastMovementFrame.current ? Math.min(40, now - lastMovementFrame.current) : 16;
      lastMovementFrame.current = now;
      const previous = playerXRef.current;
      const next = Math.max(3, Math.min(97, previous + direction * PLAYER_SPEED_PERCENT_PER_MS * elapsed));
      walkedDistance.current += Math.abs(next - previous);
      const walkFrame = Math.floor((walkedDistance.current % PLAYER_STRIDE_PERCENT) / PLAYER_STRIDE_PERCENT * WALK_FRAME_COUNT);
      playerXRef.current = next;
      visiblePlayerXRef.current = next;
      if (playerElementRef.current) playerElementRef.current.style.left = `${next}%`;
      if (crewElementRef.current) crewElementRef.current.style.backgroundPositionX = `${walkFrame * 12.5}%`;

      const viewport = viewportRef.current;
      if (viewport) keepPlayerInView(viewport, next);

      // Nearby-station UI and co-op only need periodic state updates. The
      // character itself stays at display refresh rate through the DOM ref.
      if (!lastPositionSync.current || now - lastPositionSync.current >= 80) {
        lastPositionSync.current = now;
        setPlayerX(next);
      }
      movementFrame.current = requestAnimationFrame(tick);
    };
    movementFrame.current = requestAnimationFrame(tick);
  }, [movementDirection, stopMovement]);

  const pressDirection = useCallback((direction: 1 | -1) => {
    pointerDirection.current = direction;
    startMovement();
  }, [startMovement]);

  const releaseDirection = useCallback(() => {
    pointerDirection.current = 0;
    if (!movementDirection()) stopMovement();
  }, [movementDirection, stopMovement]);

  useEffect(() => {
    const preload = new Image();
    preload.src = '/sprites/astronaut-v2-walk.png';
    return () => stopMovement();
  }, [stopMovement]);

  useEffect(() => {
    onTaskOpenChange?.(taskOpen);
    return () => { if (taskOpen) onTaskOpenChange?.(false); };
  }, [onTaskOpenChange, taskOpen]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const syncOverlayPosition = () => viewport.style.setProperty('--operations-scroll-x', `${viewport.scrollLeft}px`);
    syncOverlayPosition();
    viewport.addEventListener('scroll', syncOverlayPosition, { passive: true });
    return () => viewport.removeEventListener('scroll', syncOverlayPosition);
  }, []);

  useEffect(() => {
    if (taskOpen) {
      wasTaskOpenRef.current = true;
      taskCloseRef.current?.focus();
    } else if (wasTaskOpenRef.current) {
      wasTaskOpenRef.current = false;
      if (lastFocusedRef.current?.isConnected && !lastFocusedRef.current.matches(':disabled')) lastFocusedRef.current.focus();
      else taskScoreRef.current?.focus();
    }
  }, [taskOpen]);

  const followPlayer = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    keepPlayerInView(viewport, visiblePlayerXRef.current);
  }, []);

  useEffect(() => {
    visiblePlayerXRef.current = visiblePlayerX;
    playerXRef.current = visiblePlayerX;
    if (playerElementRef.current) playerElementRef.current.style.left = `${visiblePlayerX}%`;
  }, [visiblePlayerX]);
  useEffect(followPlayer, [followPlayer, visiblePlayerX]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(followPlayer);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [followPlayer]);

  useEffect(() => {
    if (!coopPlayerId) return;
    sendCoopMovement?.({ x: visiblePlayerX, facing, walking });
  }, [coopPlayerId, facing, sendCoopMovement, visiblePlayerX, walking]);

  const openNearby = () => {
    if (nearby && !disabled) {
      lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTaskStation(nearby.id);
      setWireProgress(0);
      setPressure(17);
      setPlants([]);
      setFrequency(96);
      setShieldSetting(50);
    }
  };

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (taskOpen) {
        if (event.key === 'Escape') { setTaskStation(null); onFocusHandled?.(); }
        return;
      }
      if (target?.closest('button, input, [role="slider"]')) return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); pressedKeys.current.add(event.key === 'ArrowLeft' ? 'ArrowLeft' : 'a'); startMovement(); }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); pressedKeys.current.add(event.key === 'ArrowRight' ? 'ArrowRight' : 'd'); startMovement(); }
      if (event.key.toLowerCase() === 'e' || event.key === 'Enter') {
        event.preventDefault();
        if (nearbyStation && !disabled) {
          lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setTaskStation(nearbyStation);
          setWireProgress(0);
          setPressure(17);
          setPlants([]);
          setFrequency(96);
          setShieldSetting(50);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') pressedKeys.current.delete('ArrowLeft');
      else if (event.key === 'ArrowRight') pressedKeys.current.delete('ArrowRight');
      else pressedKeys.current.delete(event.key.toLowerCase());
      if (!movementDirection()) stopMovement();
    };
    const onBlur = () => { pressedKeys.current.clear(); pointerDirection.current = 0; stopMovement(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      onBlur();
    };
  }, [active, disabled, movementDirection, nearbyStation, onFocusHandled, startMovement, stopMovement, taskOpen]);

  const closeTask = () => { setTaskStation(null); onFocusHandled?.(); };

  const finish = (station: MaintenanceStation) => {
    const result = onCompleteTask(station, assignedCrewId);
    setToast(result);
    setTimeout(() => setToast(''), 2400);
    closeTask();
  };

  const fail = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 1500);
  };

  const shortFor = (station: StationInfo) => completed.includes(station.id) ? 'LISTO' : station.active ? 'ALERTA' : 'OPERATIVO';

  return (
    <section className="operations-wrap" aria-label="Operaciones dentro de la nave">
      <div className="operations-heading">
        <div>
          <p className="t-tag text-px-cyan">MISIÓN INTERIOR · DÍA {state.dayNumber}</p>
          <h2 className="t-title text-px-white mt-2">Cubierta de sistemas</h2>
          <p className="t-body text-px-dim mt-1">Recorre la nave, atiende los sistemas y vuelve a ponerla en marcha.</p>
        </div>
        <div ref={taskScoreRef} className="operations-score" tabIndex={-1} aria-live="polite"><strong>{completed.length}/6</strong><span> TAREAS DE HOY</span></div>
      </div>

      {state.dayNumber === 1 && (state.completedMaintenanceTasks ?? []).length === 0 && <div className="operations-first-task" role="note"><strong>PRIMERA MISIÓN A BORDO</strong><span>Prueba una estación para ver cómo una tarea cambia tus recursos. Si aparece una alerta, ve a su sistema y detén el problema antes.</span></div>}
      <div ref={viewportRef} className="operations-viewport" role="region" aria-label="Cubierta extensa de la nave; desliza a los lados para recorrerla">
      <div className={`operations-scene ${state.isDay ? 'ship-day' : 'ship-night'} ${faultClasses}`}>
        <div className="ship-habitat-art" aria-hidden="true" />
        <div className="ship-engineering-bay" aria-hidden="true">
          <div className="engineering-bulkhead" />
          <div className="engineering-window"><i /><i /><i /></div>
          <div className="engineering-racks"><i /><i /><i /><i /></div>
          <div className="engineering-airlock"><i /><i /></div>
          <div className="engineering-workbench"><i /><i /><i /></div>
        </div>
        <div className="ship-window" aria-hidden="true"><span className="ship-earth" /><span className="ship-star star-one" /><span className="ship-star star-two" /><span className="ship-star star-three" /><span className="ship-mars-ridge" /></div>
        <div className="ship-ceiling"><span>HÁBITAT · SECTOR A</span><span>O₂ {Math.round(state.resources.oxygen)} KG</span></div>
        <div className="ship-extension-sign">INGENIERÍA · SECTOR B</div>
        <div className="ship-ceiling-lights" aria-hidden="true">{stations.map((station) => <i key={station.id} className={station.active ? 'lamp-alert' : ''} style={{ left: `${station.x}%` }} />)}</div>
        <div className="ship-wall-pipes" aria-hidden="true"><i /><i /><i /></div>
        <div className="ship-floor" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div>

        {stations.map((station) => (
          <button
            key={station.id}
            type="button"
            className={`ship-station station-${station.id} ${station.active ? 'station-alert' : ''} ${completed.includes(station.id) ? 'station-done' : ''} ${nearby?.id === station.id ? 'station-nearby' : ''}`}
            style={{ left: `${station.x}%` }}
            onClick={(event) => { lastFocusedRef.current = event.currentTarget; setPlayerX(station.x - 1); setTaskStation(station.id); setWireProgress(0); setPressure(17); setPlants([]); setFrequency(96); setShieldSetting(50); }}
            aria-label={`${station.label}, ${station.active ? 'requiere atención' : 'operativo'}. Abrir tarea`}
            disabled={disabled || completed.includes(station.id)}
          >
            <span className="station-sign">{station.icon}</span>
            <span className="station-label">{station.label}</span>
            <span className="station-status">{shortFor(station)}</span>
            <span className="station-console"><i /><i /><i /></span>
          </button>
        ))}

        <div ref={setPlayerElement} className={`ship-player crew-${crewCondition}`} role="img" aria-label={deckCrew ? `${deckCrew.name}, ${crewCondition === 'healthy' ? 'en buen estado' : crewCondition}` : 'Astronauta'}>
          <span ref={crewElementRef} className={`operation-crew is-distance-synced ${walking ? 'is-walking' : ''}`} aria-hidden="true" style={{ transform: facing < 0 ? 'scaleX(-1)' : undefined }} />
          <span className="player-shadow" />
          {crewCondition !== 'healthy' && <span className="crew-condition-mark" aria-hidden="true">{deckCrew?.name} · {crewConditionLabel}</span>}
          {coop?.session && <span className="coop-player-name">{coop.session.playerName}</span>}
        </div>
        {coop?.players.filter(player => player.id !== coop.session?.playerId).map((player, index) => {
          const movement = coop.movements[player.id];
          const remoteX = movement?.x ?? 8 + (index + 1) * 2;
          return <div key={player.id} className={`ship-player remote-player coop-color-${(coop.players.findIndex(item => item.id === player.id) + 4) % 4}`} style={{ left: `${remoteX}%` }} role="img" aria-label={`${player.name}, jugador conectado`}>
            <span className={`operation-crew ${movement?.walking ? 'is-walking' : ''}`} aria-hidden="true" style={{ transform: movement?.facing === -1 ? 'scaleX(-1)' : undefined }} />
            <span className="player-shadow" />
            <span className="coop-player-name">{player.name}</span>
          </div>;
        })}
        {nearby && !taskOpen && <button type="button" className="interact-prompt" onClick={openNearby} disabled={disabled}>E · {nearby.active ? 'REPARAR' : 'USAR'} {nearby.label}</button>}

      </div>
      {activeTaskStation && selected && (
        <div className="task-overlay">
          <div className="task-card" role="dialog" aria-modal="true" aria-labelledby="task-title" aria-describedby="task-help" onKeyDown={(event) => {
            if (event.key === 'Tab') {
              const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])');
              const first = controls[0];
              const last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
          }}>
              <div className="task-card-head"><span className="t-tag text-px-cyan">TAREA DE SISTEMA</span><button ref={taskCloseRef} type="button" className="task-close" onClick={closeTask} aria-label="Cerrar tarea">×</button></div>
            <h3 id="task-title" className="t-title text-px-white mt-3">{selected.task}</h3>
            <p id="task-help" className="t-small text-px-dim mt-2">{selected.active ? 'La tarea adelanta hasta 6 horas la reparación; un especialista puede adelantar hasta 10.' : activeTaskStation === 'power' ? 'Diagnóstico preventivo: recupera hasta 6 kWh de batería.' : activeTaskStation === 'lifeSupport' ? 'Calibración preventiva: recupera 2 kg de oxígeno.' : activeTaskStation === 'hydroponics' ? 'Cosecha preventiva: suma 3 kg de alimentos.' : activeTaskStation === 'radiationShield' ? 'Calibración preventiva: reduce 1 mSv de la dosis acumulada.' : activeTaskStation === 'water' ? 'Mantenimiento preventivo: recupera 20 litros de agua.' : 'Ajuste preventivo: mejora 2 puntos la moral de toda la tripulación.'}</p>
            <label className="task-crew-select">ASIGNAR TRIPULANTE
              <select value={assignedCrewId} onChange={event => setCrewChoice({ station: activeTaskStation, crewId: event.target.value })}>
                {eligibleCrew.map(member => <option key={member.id} value={member.id}>{member.name} · {ROLE_NAMES[member.role]}{TASK_EXPERTISE[activeTaskStation].includes(member.role) ? ' · ESPECIALISTA' : ''}</option>)}
              </select>
              <small>{eligibleCrew.length ? 'La especialidad acelera 4 h extra las averías; trabajar suma estrés.' : 'No hay tripulantes en condiciones de realizar la tarea.'}</small>
            </label>
            {activeTaskStation === 'power' && <div className="task-game"><p className="task-instruction">Conecta los cables en el orden indicado</p><div className="wire-targets">{WIRE_SEQUENCE.map((color, index) => <span key={color} className={wireProgress > index ? `wire-dot ${color} connected` : `wire-dot ${color}`}>{wireProgress > index ? '✓' : index + 1}</span>)}</div><div className="wire-buttons">{COLORS.map((color) => <button key={color} type="button" className={`wire-button ${color}`} onClick={() => { if (color === WIRE_SEQUENCE[wireProgress]) { const next = wireProgress + 1; setWireProgress(next); if (next === WIRE_SEQUENCE.length) finish('power'); } else { setWireProgress(0); fail('SECUENCIA INCORRECTA · PRUEBA DE NUEVO'); } }}>{color === 'cyan' ? 'AZUL' : color === 'yellow' ? 'AMARILLO' : 'ROJO'}</button>)}</div></div>}
            {activeTaskStation === 'lifeSupport' && <div className="task-game"><p className="task-instruction">Ajusta la presión a 21 kPa</p><div className="pressure-meter"><strong>{pressure}</strong><span> kPa</span><i style={{ width: `${Math.max(8, Math.min(100, pressure * 4))}%` }} /></div><div className="task-actions"><button type="button" className="btn8 btn8-secondary" onClick={() => setPressure((value) => Math.max(0, value - 1))}>− BAJAR</button><button type="button" className="btn8 btn8-primary" onClick={() => { const next = Math.min(30, pressure + 1); setPressure(next); if (next === 21) finish('lifeSupport'); }}>+ SUBIR</button></div></div>}
            {activeTaskStation === 'hydroponics' && <div className="task-game"><p className="task-instruction">Retira solo las plantas con esporas</p><div className="plant-grid">{[0, 1, 2, 3].map((index) => <button key={index} type="button" disabled={plants.includes(index)} className={`plant-card ${plants.includes(index) ? 'plant-cleared' : ''} ${PLANT_TARGETS.includes(index) ? 'plant-spored' : ''}`} onClick={() => { if (PLANT_TARGETS.includes(index)) { const next = [...plants, index]; setPlants(next); if (next.length === PLANT_TARGETS.length) finish('hydroponics'); } else { setPlants([]); fail('CULTIVO SANO · NO LO RETIRES'); } }}><span>{plants.includes(index) ? '✓' : PLANT_TARGETS.includes(index) ? '✹' : '♣'}</span><small>CULTIVO {index + 1}</small></button>)}</div></div>}
            {activeTaskStation === 'communications' && <div className="task-game"><p className="task-instruction">Sintoniza la señal de rescate: 100 MHz</p><div className="radio-display"><span>FREQ.</span><strong>{frequency.toFixed(0)}<small> MHz</small></strong><div className="radio-wave"><i /><i /><i /><i /><i /><i /><i /></div></div><div className="task-actions"><button type="button" className="btn8 btn8-secondary" onClick={() => setFrequency((value) => Math.max(90, value - 1))}>− AJUSTAR</button><button type="button" className="btn8 btn8-primary" onClick={() => { const next = Math.min(110, frequency + 1); setFrequency(next); if (next === 100) finish('communications'); }}>+ AJUSTAR</button></div></div>}
            {activeTaskStation === 'radiationShield' && <div className="task-game"><p className="task-instruction">Ajusta la potencia protectora a 80%</p><div className="pressure-meter"><strong>{shieldSetting}</strong><span>% ESCUDO</span><i style={{ width: `${shieldSetting}%` }} /></div><div className="task-actions"><button type="button" className="btn8 btn8-secondary" onClick={() => setShieldSetting((value) => Math.max(30, value - 10))}>− BAJAR</button><button type="button" className="btn8 btn8-primary" onClick={() => { const next = Math.min(100, shieldSetting + 10); setShieldSetting(next); if (next === 80) finish('radiationShield'); }}>+ SUBIR</button></div></div>}
            {activeTaskStation === 'water' && <div className="task-game"><p className="task-instruction">Purga el circuito en el orden correcto</p><div className="wire-targets">{WATER_SEQUENCE.map((step, index) => <span key={step} className={wireProgress > index ? 'wire-dot cyan connected' : 'wire-dot cyan'}>{wireProgress > index ? '✓' : index + 1}</span>)}</div><div className="wire-buttons">{WATER_SEQUENCE.map((step, index) => <button key={step} type="button" className={`wire-button ${COLORS[index]}`} onClick={() => { if (step === WATER_SEQUENCE[wireProgress]) { const next = wireProgress + 1; setWireProgress(next); if (next === WATER_SEQUENCE.length) finish('water'); } else { setWireProgress(0); fail('VÁLVULA FUERA DE ORDEN · PRUEBA DE NUEVO'); } }}>{step}</button>)}</div></div>}
          </div>
        </div>
      )}
      {toast && <div className="operations-toast" role="status">{toast}</div>}
      </div>

      <div className="operations-controls">
        <div className="dpad" role="group" aria-label="Controles de movimiento">
          <button type="button" onPointerDown={() => pressDirection(-1)} onPointerUp={releaseDirection} onPointerCancel={releaseDirection} onPointerLeave={releaseDirection} onClick={event => { if (event.detail === 0) { setPlayerX(current => Math.max(3, current - 2)); setFacing(-1); } }} aria-label="Caminar a la izquierda">◀</button>
          <button type="button" onPointerDown={() => pressDirection(1)} onPointerUp={releaseDirection} onPointerCancel={releaseDirection} onPointerLeave={releaseDirection} onClick={event => { if (event.detail === 0) { setPlayerX(current => Math.min(97, current + 2)); setFacing(1); } }} aria-label="Caminar a la derecha">▶</button>
        </div>
        <p className="t-small text-px-dim"><strong className="operation-steps">1 CAMINA</strong> <kbd>A</kbd> <kbd>D</kbd> o ← → · <strong className="operation-steps">2 USA</strong> <kbd>E</kbd> · móvil: flechas, desliza la nave y toca la estación.</p>
        {nearby && !taskOpen && <Button variant="primary" onClick={openNearby} disabled={disabled}>{nearby.active ? 'Reparar sistema' : 'Hacer tarea'}</Button>}
      </div>
      <div className="operations-checklist" aria-label="Estado de las tareas">
        {stations.map((station) => <div key={station.id} className={completed.includes(station.id) ? 'check-item done' : station.active ? 'check-item needs-attention' : 'check-item'}><i /> <span>{station.label}</span><strong>{completed.includes(station.id) ? 'LISTO' : station.active ? 'ATENDER' : 'PENDIENTE'}</strong></div>)}
      </div>
    </section>
  );
}
