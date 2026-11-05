import { useRef } from 'react';

const TABS = [
  ['exterior', 'EXTERIOR'], ['habitat', 'HÁBITAT'], ['operations', 'OPERACIONES'], ['management', 'GESTIÓN'], ['crew', 'TRIPULACIÓN'], ['log', 'BITÁCORA'],
] as const;
export type DashboardTab = (typeof TABS)[number][0];

export function DashboardTabs({ active, onChange, unread = 0, alerted = [] }: {
  active: DashboardTab; onChange: (tab: DashboardTab) => void; unread?: number; alerted?: DashboardTab[];
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const focus = (index: number) => {
    const next = (index + TABS.length) % TABS.length;
    refs.current[next]?.focus();
    onChange(TABS[next][0]);
  };
  return <div className="dashboard-tabs" role="tablist" aria-label="Secciones de la misión">
    {TABS.map(([id, label], index) => <button
      key={id} ref={node => { refs.current[index] = node; }} type="button" role="tab"
      id={`tab-${id}`} aria-controls="dashboard-panel" aria-selected={active === id} tabIndex={active === id ? 0 : -1}
      className={`dashboard-tab ${active === id ? 'is-active' : ''} ${alerted.includes(id) ? 'has-alert' : ''}`}
      onClick={() => onChange(id)} onKeyDown={event => {
        if (event.key === 'ArrowRight') { event.preventDefault(); focus(index + 1); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); focus(index - 1); }
        if (event.key === 'Home') { event.preventDefault(); focus(0); }
        if (event.key === 'End') { event.preventDefault(); focus(TABS.length - 1); }
      }}>
      {label}{id === 'log' && unread > 0 && <span className="tab-badge" aria-label={`${unread} eventos sin revisar`}>{unread}</span>}
      {alerted.includes(id) && <span className="tab-alert-dot" aria-label="Sistema afectado" />}
    </button>)}
  </div>;
}
