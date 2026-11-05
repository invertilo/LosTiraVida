import { useEffect, useState } from 'react';
import type { SimulationState } from '../engine/types';
import { Panel } from './primitives';
import { cx } from '../lib/ui';

const SYSTEMS = [
  ['POTENCIA', 'power'], ['COMUNICACIONES', 'communications'], ['SOPORTE VITAL', 'lifeSupport'], ['HIDROPONÍA', 'foodProduction'],
] as const;

export function ExteriorScene({ state }: { state: SimulationState }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  const effects = state.activeEffects;
  const storm = effects.some(effect => effect.kind === 'dust_storm');
  const radiation = effects.some(effect => effect.kind === 'radiation_spike');
  const antennaDown = state.systems.communications !== 'operational';
  const powerDown = state.systems.power !== 'operational';
  const cropDisease = state.systems.foodProduction === 'offline';
  const repairable = effects.some(effect => effect.kind === 'equipment_failure' || effect.kind === 'water_leak');
  const repairCrew = repairable ? state.allocation.maintenancePersonnel.length : 0;
  const isMars = state.location === 'mars';
  const description = `${isMars ? 'Puesto de Marte' : 'Puesto de la Luna'}, ${state.isDay ? 'día' : 'noche'}. ${SYSTEMS.filter(([, id]) => state.systems[id] !== 'operational').map(([name]) => `${name} afectado`).join(', ') || 'Todos los sistemas operativos'}${storm ? ', tormenta de polvo activa' : ''}${radiation ? ', evento de radiación activa' : ''}.`;

  return <Panel
    title="Puesto desde el exterior"
    subtitle={`${isMars ? 'MARTE · CRÁTER JEZERO' : 'LUNA · BORDE SHACKLETON'} · ${state.isDay ? 'DÍA' : 'NOCHE'}${state.missionSuccess !== null ? ' · MISIÓN TERMINADA' : ''}`}
    accent={isMars ? 'var(--px-red)' : 'var(--px-cyan)'}
    bodyClassName="!p-0"
  >
    <div className={cx('exterior-scene', isMars ? 'mars' : 'moon', !state.isDay && 'is-night', storm && 'has-storm', radiation && 'has-radiation', cropDisease && 'has-crop-disease', powerDown && 'has-power-fault', antennaDown && 'has-comms-fault', state.missionSuccess !== null && 'mission-ended')} role="img" aria-label={description}>
      <svg viewBox={compact ? '100 0 830 560' : '0 0 1000 560'} preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="exo-stars" width="91" height="73" patternUnits="userSpaceOnUse">
            <path d="M11 13h4v4h-4zM58 41h3v3h-3zM79 9h3v3h-3zM32 62h4v4h-4z" fill="#d9e7ff" />
          </pattern>
          <pattern id="exo-ground-grid" width="48" height="24" patternUnits="userSpaceOnUse">
            <path d="M0 0h48M0 12h48M0 0v24M24 0v24" fill="none" stroke="#e9b17d" strokeOpacity=".14" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="1000" height="560" className="exo-sky" />
        <rect width="1000" height="305" fill="url(#exo-stars)" className="exo-stars" />
        {isMars ? <>
          <path className="exo-sun-rays" d="M830 42h8v18h-8zM790 75h18v8h-18zM876 75h18v8h-18zM810 119h8v18h-8zM866 119h8v18h-8z" />
          <path className="exo-sun" d="M817 65h44v8h8v44h-8v8h-44v-8h-8V73h8z" />
          <path d="M0 306 110 224l82 49 103-116 108 115 84-76 104 91 93-128 91 94 125-97v160H0z" className="exo-mountains" />
          <path d="M0 334 128 282l79 27 101-68 103 81 95-44 99 49 123-92 101 72 91-54 80 53v108H0z" className="exo-mountains-far" />
        </> : <>
          <path d="M0 318 134 234l102 66 126-115 125 122 120-97 124 108 103-139 166 111v140H0z" className="exo-moon-ridge" />
          <path d="M806 73h56v8h8v8h8v40h-8v8h-8v8h-56v-8h-8v-8h-8V89h8v-8h8z" className="exo-earth" />
          <path d="M828 84h28v5h8v19h-8v8h-28v-5h-7V89h7z" className="exo-earth-land" />
          <path d="M0 348h1000v86H0z" className="exo-shadow-band" />
        </>}
        <path d="M0 350 105 329l92 22 100-27 113 32 117-38 110 35 103-31 113 31 90-21 57 17v211H0z" className="exo-ground" />
        <path d="M0 350 105 329l92 22 100-27 113 32 117-38 110 35 103-31 113 31 90-21 57 17v211H0z" fill="url(#exo-ground-grid)" />
        <path d="M53 442h67v9H53zM859 462h88v8h-88zM180 496h26v8h-26zM715 423h39v8h-39z" className="exo-rocks" />
        <g className="exo-craters"><path d="M22 402h104v8H22zm18 8h70v8H40zm666 61h122v8H706zm20 8h82v8h-82z" /></g>

        {/* Descender and landing legs */}
        <g className="exo-lander">
          <path d="M151 286h24v-20h18v-18h54v18h18v20h23v47h-23v16h-18v13h-54v-13h-18v-16h-24z" />
          <path d="M194 248h54v-23h-54z" className="exo-lander-glass" />
          <path d="M201 254h40v21h-40z" className="exo-lander-window" />
          <path d="M164 325h22v45h-10v21h-29v-9h20v-15h-12v-9h9zM253 325h18v33h9v15h20v10h-30v-19h-17z" className="exo-lander-leg" />
          <path d="M149 392h54v8h-54zM263 392h53v8h-53z" />
          <path d="M180 340h74v8h-74zM190 356h54v8h-54z" className="exo-lander-mark" />
        </g>

        {/* Communications mast */}
        <g className={cx('exo-antenna', antennaDown && 'is-offline')}>
          <path d="M365 359V177h8v182zM337 359h64v8h-64zM340 218q28-34 56 0l-6 7q-22-27-44 0zM330 207q38-48 76 0l-6 7q-32-41-64 0z" />
          <path d="M360 186h17v8h-17z" className="exo-antenna-lamp" />
          {!antennaDown && <path d="M394 176h18v5h-13v8h13v5h-18z" className="exo-signal" />}
        </g>

        {/* Pressurized habitat, service tunnel and hydroponics wing */}
        <g className="exo-habitat">
          <path d="M420 304h35v-21h27v-26h80v26h27v21h36v82H420z" className="exo-habitat-shell" />
          <path d="M472 257v-28h115v28z" className="exo-dome" />
          <path d="M483 249h92v-12h-92zM493 236v-7m23 7v-7m23 7v-7m23 7v-7" className="exo-dome-ribs" />
          <path d="M443 325h37v35h-37zM493 325h37v35h-37zM543 325h37v35h-37z" className="exo-window" />
          <path d="M486 304v78m50-78v78m51-78v78" className="exo-seam" />
          <path d="M408 386h286v12H408zM437 398v23h-9v-23m236 0v23h-9v-23" className="exo-foundation" />
          <path d="M377 342h43v14h-43zm278 0h67v14h-67z" className="exo-airlock" />
          <path d="M675 306h103v76H675z" className="exo-greenhouse" />
          <path d="M675 306h103v13H675zM691 319v63m25-63v63m25-63v63m25-63v63" className="exo-greenhouse-ribs" />
          <path d="M686 371v-27h8v27m10 0v-39h8v39m9 0v-31h8v31m10 0v-21h8v21m10 0v-36h8v36" className="exo-plants" />
          <path d="M648 367h27v8h-27m-228-3h-49v14h49m402-24h-14v12h24" className="exo-pipe" />
          <path d="M440 310h8v8h-8zM607 310h8v8h-8zM686 329h8v8h-8z" className="exo-lights" />
        </g>

        {/* Solar field, tiltable panels and heavy stands */}
        <g className={cx('exo-solar', powerDown && 'is-broken')} transform={compact ? 'translate(130 0) scale(.84 1)' : undefined}>
          <path d="M808 286h132v89H808z" className="exo-solar-array" />
          <path d="M841 286v89m33-89v89m33-89v89M808 315h132m-132 30h132" className="exo-solar-grid" />
          <path d="M870 375v40m-31 0h62m61-129 12-8" className="exo-solar-stand" />
          <path d="M809 282h133v7H809z" className="exo-solar-highlight" />
        </g>

        {repairCrew > 0 && <g className="exo-crew" transform="translate(320 352)">
          <path d="M8 0h20v8h6v22h-6v7H8v-7H2V8h6z" /><path d="M8 11h20v9H8z" className="exo-crew-visor" />
          <path d="M12 37h12v28H12zM8 65h8v16H8zm14 0h8v16h-8zM2 41h8v18H2zm24 0h8v18h-8z" />
          <path d="M42 35h9v5h-9zM46 31h5v4h-5z" className="exo-sparks" />
        </g>}
        {storm && <g className="exo-dust-particles"><path d="M0 138h119v7H0zM249 187h99v6h-99zm516-72h121v7H765zM604 212h83v6h-83zm300-33h196v6H900zM91 231h65v5H91z" /></g>}
        {radiation && <g className="exo-radiation-mark"><path d="M487 112h18v7h-5l11 19-7 4-11-19-11 19-7-4 11-19h-5zM469 151l10-6 7 12-10 6zm43 0-7-6-7 12 10 6z" /></g>}

        <path d="M0 420h1000v8H0z" className="exo-horizon-line" />
      </svg>
      <div className="exo-hud-top" aria-hidden="true">
        <span className="exo-coordinate">{isMars ? '04°35′S · 137°26′E' : '89°S · 0°E'}</span>
        <span className="exo-time">{state.isDay ? '☼' : '☾'} {state.isDay ? 'LUZ SOLAR' : 'CICLO NOCTURNO'} <b>{state.dayNumber.toString().padStart(3, '0')}</b></span>
      </div>
      {storm && <div className="exo-alert exo-alert-storm">ALERTA · TORMENTA DE POLVO</div>}
      {radiation && <div className="exo-alert exo-alert-rad">ALERTA · RADIACIÓN SOLAR</div>}
      <div className="exo-hud-bottom" aria-hidden="true">
        <span className="exo-hud-status">{repairCrew ? `EVA · ${repairCrew} EN REPARACIÓN` : state.missionSuccess !== null ? 'MISIÓN FINALIZADA' : 'ASENTAMIENTO ACTIVO'}</span>
        <span className="exo-hud-effects">{effects.length ? `${effects.length} INCIDENCIA${effects.length === 1 ? '' : 'S'}` : 'SIN INCIDENCIAS'}</span>
      </div>
    </div>
    <div className="exterior-system-strip" aria-label="Estado de sistemas exteriores">
      {SYSTEMS.map(([label, system]) => <div className={`exterior-system ${state.systems[system] === 'operational' ? 'is-good' : 'is-alert'}`} key={system}>
        <i aria-hidden="true" /><span>{label}</span><strong>{state.systems[system] === 'operational' ? 'EN LÍNEA' : 'REVISAR'}</strong>
      </div>)}
    </div>
    <p className="sr-only" aria-live="polite">{description}</p>
    <ul className="sr-only" aria-label="Incidencias visibles desde el exterior">{effects.map(effect => <li key={effect.id}>{effect.title}, {Math.ceil(effect.remainingHours)} horas restantes</li>)}</ul>
  </Panel>;
}
