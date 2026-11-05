import { useState } from 'react';
import type { CoopSessionController } from '../hooks/useCoopSession';
import { normalizeRoomCode } from '../lib/coop';
import { Button } from './primitives';

export function CoopLobby({ coop, onStart }: { coop: CoopSessionController; onStart: () => void }) {
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('outpost.playerName') ?? ''; } catch { return ''; }
  });
  const [code, setCode] = useState('');

  const rememberName = () => {
    const clean = name.trim().slice(0, 20);
    try { localStorage.setItem('outpost.playerName', clean); } catch { /* optional convenience */ }
    return clean;
  };

  if (coop.status === 'connected' && coop.session) {
    return (
      <div className="coop-room" aria-live="polite">
        <div className="coop-code">
          <span>CÓDIGO DE INVITACIÓN</span>
          <strong>{coop.session.code}</strong>
          <Button variant="plain" onClick={() => void navigator.clipboard?.writeText(coop.session!.code)}>Copiar código</Button>
        </div>
        <ul className="coop-player-list" aria-label={`${coop.players.length} de 4 jugadores conectados`}>
          {coop.players.map((player, index) => (
            <li key={player.id} className={player.id === coop.session?.playerId ? 'is-local' : ''}>
              <i style={{ '--player-index': index } as React.CSSProperties} />
              <span>{player.name}</span>
              <small>{index === 0 ? 'ANFITRIÓN' : player.id === coop.session?.playerId ? 'TÚ' : 'CONECTADO'}</small>
            </li>
          ))}
          {Array.from({ length: 4 - coop.players.length }, (_, index) => <li key={`empty-${index}`} className="is-empty"><i /><span>Esperando…</span></li>)}
        </ul>
        <p className="t-small text-px-dim">Comparte el código. La misión admite hasta cuatro personas; el anfitrión debe mantener abierta su pestaña.</p>
        <div className="coop-actions">
          {coop.isHost
            ? <Button variant="primary" onClick={onStart} disabled={coop.players.length < 1}>Iniciar misión cooperativa</Button>
            : <span className="t-tag text-px-yellow blink">Esperando al anfitrión…</span>}
          <Button variant="plain" onClick={coop.leave}>Salir de la sala</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="coop-join">
      <label>
        NOMBRE DEL JUGADOR
        <input value={name} maxLength={20} autoComplete="nickname" onChange={event => setName(event.target.value)} placeholder="Tu nombre" />
      </label>
      <label>
        CÓDIGO DE INVITACIÓN
        <input value={code} maxLength={6} autoCapitalize="characters" spellCheck={false} onChange={event => setCode(normalizeRoomCode(event.target.value))} placeholder="ABC234" />
      </label>
      {coop.error && <p className="coop-error" role="alert">{coop.error}</p>}
      <div className="coop-actions">
        <Button variant="primary" disabled={!name.trim() || coop.status === 'connecting'} onClick={() => coop.createRoom(rememberName())}>
          {coop.status === 'connecting' ? 'Conectando…' : 'Crear sala'}
        </Button>
        <Button variant="secondary" disabled={!name.trim() || code.length !== 6 || coop.status === 'connecting'} onClick={() => coop.joinRoom(rememberName(), code)}>
          Unirse con código
        </Button>
      </div>
    </div>
  );
}
