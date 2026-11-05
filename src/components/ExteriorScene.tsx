import type { SimulationState } from '../engine/types';
import { Panel } from './primitives';
import { cx } from '../lib/ui';

export function ExteriorScene({ state }: { state: SimulationState }) {
  const effects = state.activeEffects;
  const storm = effects.some(e => e.kind === 'dust_storm');
  const radiation = effects.some(e => e.kind === 'radiation_spike');
  const antennaDown = effects.some(e => e.kind === 'communication_loss');
  const powerDown = state.systems.power !== 'operational';
  const cropDisease = state.systems.foodProduction === 'offline';
  const repairable = effects.some(effect => effect.kind === 'equipment_failure' || effect.kind === 'water_leak');
  const repairCrew = repairable ? state.allocation.maintenancePersonnel.length : 0;
  const description = `${state.location === 'mars' ? 'Puesto sobre Marte' : 'Puesto sobre la Luna'}, ahora de ${state.isDay ? 'día' : 'noche'}. Paneles ${powerDown ? 'averiados' : 'operativos'}, antena ${antennaDown ? 'desconectada' : 'conectada'}${storm ? ', tormenta de polvo activa' : ''}${radiation ? ', alerta de radiación activa' : ''}.`;
  return <Panel title="Puesto desde el exterior" subtitle={`${state.location === 'mars' ? 'MARTE · CRÁTER JEZERO' : 'LUNA · BORDE SHACKLETON'} · ${state.isDay ? 'DÍA' : 'NOCHE'}${state.missionSuccess !== null ? ' · MISIÓN TERMINADA' : ''}`} accent={state.location === 'mars' ? 'var(--px-red)' : 'var(--px-cyan)'}>
    <div className={cx('exterior-scene', state.location, !state.isDay && 'is-night', storm && 'has-storm', radiation && 'has-radiation', cropDisease && 'has-crop-disease', state.missionSuccess !== null && 'mission-ended')} role="img" aria-label={description}>
      <svg viewBox="0 0 960 360" preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
        <rect width="960" height="250" className="exo-sky" />
        {state.location === 'moon' ? <><circle cx="790" cy="86" r="34" className="exo-earth"/><path d="M0 235 L130 185 245 228 370 175 510 226 640 190 770 230 880 180 960 218V280H0Z" className="exo-ridge"/></> : <><circle cx="790" cy="64" r="25" className="exo-sun"/><path d="M0 220 L95 148 188 210 310 138 432 220 560 155 683 226 806 150 960 222V280H0Z" className="exo-ridge"/><path d="M0 248 L118 220 250 255 390 215 535 260 700 218 840 252 960 225V280H0Z" className="exo-ridge-far"/></>}
        <rect y="250" width="960" height="110" className="exo-ground" />
        <g className="exo-rocks"><path d="M55 279h28v-12h24v12h18v13H55zM805 284h18v-18h26v11h24v18h-68zM690 326h20v-10h24v12h20v9h-64z"/></g>
        {/* landing craft */}
        <g className="exo-lander"><path d="M145 190h72v20h-72zM160 172h42v18h-42zM168 155h25v17h-25zM132 210h98v10h-98zM140 220h10v25h-10zM211 220h10v25h-10z"/><rect x="170" y="162" width="20" height="9" className="exo-window"/></g>
        {/* habitat with hydroponic and support links */}
        <g className="exo-base"><rect x="345" y="175" width="250" height="82"/><path d="M325 174h290v12H325zM365 148h92v27h-92zM383 135h56v13h-56z"/><rect x="365" y="193" width="208" height="47" className="exo-windows"/><path d="M454 193v47M502 193v47" className="exo-seams"/><path d="M230 215h115v10M595 218h68v11h54" className="exo-pipe"/><rect x="600" y="211" width="70" height="37" className="exo-greenhouse"/><path d="M615 239v-14h12v14m9 0v-20h12v20m10 0v-12h12v12" className="exo-plants"/></g>
        {/* solar array */}
        <g className={cx('exo-panels', powerDown && 'is-broken')}><path d="M690 215l148-25v68l-148 25z"/><path d="M727 209v67m37-73v67m37-73v67M690 238l148-25M690 260l148-25" className="exo-grid"/><path d="M764 260v24" className="exo-stand"/></g>
        {/* antenna */}
        <g className={cx('exo-antenna', antennaDown && 'is-offline')}><path d="M273 244v-88m0 0q34-35 63 0m-63 0q34 35 63 0m-32-25v26"/><path d="M263 244h20"/></g>
        {repairCrew > 0 && <g className="exo-eva"><circle cx="317" cy="255" r="7"/><path d="M311 264h12v22h-12zM307 267h5m11 0h5m-13 19v11m9-11v11"/></g>}
        {storm && <g className="exo-dust"><path d="M20 70h40m30 55h45m620-88h60m-40 115h70M220 95h33m-10 70h55m460 30h40"/></g>}
        {radiation && <g className="exo-rad"><path d="M440 92l10-17 10 17h-8v9h-4v-9zm-22 24 20-3-5 7-8 5zm44 0-20-3 5 7 8 5z"/></g>}
      </svg>
      <div className="exo-readout" aria-hidden="true"><span>{repairCrew ? `EVA ${repairCrew} · REPARACIÓN` : 'BASE OPERATIVA'}</span><span>{effects.length ? `${effects.length} INCIDENCIA${effects.length === 1 ? '' : 'S'}` : 'SIN INCIDENCIAS'}</span></div>
    </div>
    <ul className="sr-only">{effects.map(effect => <li key={effect.id}>{effect.title}, {Math.ceil(effect.remainingHours)} horas restantes</li>)}</ul>
  </Panel>;
}
