import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import { isValidSimulatorSaveData } from '../engine/saveValidation';
import {
  COOP_MAX_PLAYERS, createRoomCode, normalizeRoomCode, type CoopAction,
  type CoopConnectionStatus, type CoopMovement, type CoopPlayer, type CoopSnapshot, type CoopStart,
} from '../lib/coop';

interface JoinRequest { code: string; name: string; playerId: string; joinedAt: number; wantsHost: boolean }
type CoopMessage =
  | { type: 'roster'; players: CoopPlayer[] }
  | { type: 'start'; start: CoopStart }
  | { type: 'snapshot'; snapshot: CoopSnapshot }
  | { type: 'action'; from: string; action: CoopAction }
  | { type: 'request-state'; from: string }
  | { type: 'movement'; movement: CoopMovement }
  | { type: 'task-state'; playerId: string; open: boolean }
  | { type: 'error'; message: string };
interface HostConnection { connection: DataConnection; player: CoopPlayer }

function newPlayerId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function hostPeerId(code: string): string { return `outpost-${code.toLowerCase()}`; }
function isPlayer(value: unknown): value is CoopPlayer {
  if (!value || typeof value !== 'object') return false;
  const player = value as Partial<CoopPlayer>;
  return typeof player.id === 'string' && typeof player.name === 'string' && player.name.length > 0 &&
    typeof player.joinedAt === 'number' && Number.isFinite(player.joinedAt);
}
function isMessage(value: unknown): value is CoopMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'roster': return Array.isArray(message.players) && message.players.length <= COOP_MAX_PLAYERS && message.players.every(isPlayer);
    case 'start': {
      const start = message.start as Record<string, unknown> | undefined;
      return Boolean(start && ['moon', 'mars'].includes(String(start.location)) && Number.isInteger(start.crewCount) &&
        Number(start.crewCount) >= 2 && Number(start.crewCount) <= 6 && ['easy', 'normal', 'hard'].includes(String(start.difficulty)));
    }
    case 'snapshot': {
      const next = message.snapshot as Record<string, unknown> | undefined;
      return Boolean(next && isValidSimulatorSaveData(next.save, true) && typeof next.running === 'boolean' &&
        typeof next.speed === 'number' && Number.isFinite(next.speed) && typeof next.sequence === 'number' && Number.isFinite(next.sequence));
    }
    case 'action': {
      const action = message.action as Record<string, unknown> | undefined;
      return typeof message.from === 'string' && Boolean(action && ['toggle-running', 'set-speed', 'set-allocation', 'assign-crew', 'complete-task', 'restart'].includes(String(action.kind)));
    }
    case 'request-state': return typeof message.from === 'string';
    case 'movement': {
      const movement = message.movement as Record<string, unknown> | undefined;
      return Boolean(movement && typeof movement.playerId === 'string' && typeof movement.x === 'number' &&
        Number.isFinite(movement.x) && movement.x >= 0 && movement.x <= 100 && (movement.facing === 1 || movement.facing === -1) && typeof movement.walking === 'boolean');
    }
    case 'task-state': return typeof message.playerId === 'string' && typeof message.open === 'boolean';
    case 'error': return typeof message.message === 'string';
    default: return false;
  }
}

export function useCoopSession() {
  const [request, setRequest] = useState<JoinRequest | null>(null);
  const [status, setStatus] = useState<CoopConnectionStatus>('idle');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<CoopPlayer[]>([]);
  const [startMessage, setStartMessage] = useState<CoopStart | null>(null);
  const [snapshot, setSnapshot] = useState<CoopSnapshot | null>(null);
  const [movements, setMovements] = useState<Record<string, CoopMovement>>({});
  const [busyPlayerIds, setBusyPlayerIds] = useState<string[]>([]);
  const [stateRequest, setStateRequest] = useState(0);
  const peerRef = useRef<Peer | null>(null);
  const guestConnectionRef = useRef<DataConnection | null>(null);
  const hostConnectionsRef = useRef(new Map<string, HostConnection>());
  const actionHandlerRef = useRef<(action: CoopAction) => void>(() => undefined);
  const lastMovementSentRef = useRef(0);
  const pendingMovementRef = useRef<CoopMovement | null>(null);
  const movementTimerRef = useRef<number | undefined>(undefined);

  const resetState = useCallback(() => {
    window.clearTimeout(movementTimerRef.current);
    movementTimerRef.current = undefined;
    pendingMovementRef.current = null;
    guestConnectionRef.current = null;
    hostConnectionsRef.current.clear();
    setStatus('idle'); setError(''); setPlayers([]); setStartMessage(null); setSnapshot(null);
    setMovements({}); setBusyPlayerIds([]);
  }, []);
  const leave = useCallback(() => {
    const peer = peerRef.current;
    peerRef.current = null;
    peer?.destroy();
    setRequest(null);
    resetState();
  }, [resetState]);
  const connect = useCallback((name: string, code: string, wantsHost: boolean) => {
    const cleanName = name.trim().slice(0, 20);
    const cleanCode = normalizeRoomCode(code);
    if (!cleanName || cleanCode.length !== 6) {
      setStatus('error'); setError('Escribe un nombre y un código válido de 6 caracteres.'); return;
    }
    peerRef.current?.destroy();
    resetState();
    setStatus('connecting');
    setRequest({ code: cleanCode, name: cleanName, playerId: newPlayerId(), joinedAt: Date.now(), wantsHost });
  }, [resetState]);
  const createRoom = useCallback((name: string) => connect(name, createRoomCode(), true), [connect]);
  const joinRoom = useCallback((name: string, code: string) => connect(name, code, false), [connect]);

  useEffect(() => {
    if (!request) return;
    const lifecycle = new AbortController();
    const hostConnections = hostConnectionsRef.current;
    const localPlayer: CoopPlayer = { id: request.playerId, name: request.name, joinedAt: request.joinedAt, wantsHost: request.wantsHost };
    const peer = request.wantsHost ? new Peer(hostPeerId(request.code), { debug: 1 }) : new Peer({ debug: 1 });
    peerRef.current = peer;

    const sendToGuests = (message: CoopMessage, exceptPlayerId?: string) => {
      for (const [playerId, entry] of hostConnections) {
        if (playerId !== exceptPlayerId && entry.connection.open) entry.connection.send(message);
      }
    };
    const syncHostRoster = () => {
      const nextPlayers = [localPlayer, ...Array.from(hostConnections.values()).map(entry => entry.player)]
        .sort((a, b) => a.joinedAt - b.joinedAt);
      const activeIds = new Set(nextPlayers.map(player => player.id));
      setPlayers(nextPlayers);
      setMovements(current => Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id))));
      setBusyPlayerIds(current => current.filter(id => activeIds.has(id)));
      sendToGuests({ type: 'roster', players: nextPlayers });
    };
    const handleHostMessage = (message: CoopMessage, fromPlayerId: string) => {
      switch (message.type) {
        case 'action': actionHandlerRef.current(message.action); break;
        case 'request-state': setStateRequest(value => value + 1); break;
        case 'movement':
          setMovements(current => ({ ...current, [message.movement.playerId]: message.movement }));
          sendToGuests(message, fromPlayerId); break;
        case 'task-state':
          setBusyPlayerIds(current => message.open
            ? current.includes(message.playerId) ? current : [...current, message.playerId]
            : current.filter(id => id !== message.playerId));
          sendToGuests(message); break;
        default: break;
      }
    };
    const handleGuestMessage = (message: CoopMessage) => {
      switch (message.type) {
        case 'roster': {
          const activeIds = new Set(message.players.map(player => player.id));
          setPlayers(message.players.slice(0, COOP_MAX_PLAYERS));
          setMovements(current => Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id))));
          setBusyPlayerIds(current => current.filter(id => activeIds.has(id)));
          break;
        }
        case 'start': setStartMessage(message.start); break;
        case 'snapshot': setSnapshot(current => !current || message.snapshot.sequence > current.sequence ? message.snapshot : current); break;
        case 'movement':
          if (message.movement.playerId !== request.playerId) setMovements(current => ({ ...current, [message.movement.playerId]: message.movement }));
          break;
        case 'task-state':
          setBusyPlayerIds(current => message.open
            ? current.includes(message.playerId) ? current : [...current, message.playerId]
            : current.filter(id => id !== message.playerId));
          break;
        case 'error': setStatus('error'); setError(message.message); guestConnectionRef.current?.close(); break;
        default: break;
      }
    };

    peer.on('open', () => {
      if (lifecycle.signal.aborted) return;
      if (request.wantsHost) { setPlayers([localPlayer]); setStatus('connected'); return; }
      const connection = peer.connect(hostPeerId(request.code), { reliable: true, serialization: 'json', metadata: localPlayer });
      guestConnectionRef.current = connection;
      connection.on('open', () => {
        if (lifecycle.signal.aborted) return;
        setStatus('connected');
        connection.send({ type: 'request-state', from: request.playerId } satisfies CoopMessage);
      });
      connection.on('data', data => { if (isMessage(data)) handleGuestMessage(data); });
      connection.on('close', () => {
        if (!lifecycle.signal.aborted) { setStatus('error'); setError('El anfitrión cerró la sala. Crea una nueva para continuar.'); }
      });
      connection.on('error', () => {
        if (!lifecycle.signal.aborted) { setStatus('error'); setError('No se pudo establecer la conexión con el anfitrión.'); }
      });
    });

    if (request.wantsHost) {
      peer.on('connection', connection => {
        const player = connection.metadata;
        connection.on('open', () => {
          if (!isPlayer(player)) { connection.close(); return; }
          if (hostConnections.size >= COOP_MAX_PLAYERS - 1) {
            connection.send({ type: 'error', message: 'La sala ya tiene cuatro jugadores.' } satisfies CoopMessage);
            window.setTimeout(() => connection.close(), 100); return;
          }
          hostConnections.set(player.id, { connection, player: { ...player, wantsHost: false } });
          connection.on('data', data => { if (isMessage(data)) handleHostMessage(data, player.id); });
          const removePlayer = () => { hostConnections.delete(player.id); syncHostRoster(); };
          connection.on('close', removePlayer);
          connection.on('error', removePlayer);
          syncHostRoster();
          setStateRequest(value => value + 1);
        });
      });
    }

    peer.on('error', peerError => {
      if (lifecycle.signal.aborted) return;
      if (request.wantsHost && peerError.type === 'unavailable-id') {
        setStatus('connecting');
        setRequest({ ...request, code: createRoomCode(), joinedAt: Date.now() });
      } else if (!request.wantsHost && peerError.type === 'peer-unavailable') {
        setStatus('error'); setError('No existe una sala activa con ese código.');
      } else {
        setStatus('error'); setError('Se perdió la conexión P2P. Comprueba tu red e inténtalo de nuevo.');
      }
    });
    peer.on('disconnected', () => {
      if (!lifecycle.signal.aborted && !peer.destroyed) {
        try { peer.reconnect(); } catch { /* a later error reports a permanent failure */ }
      }
    });
    return () => {
      lifecycle.abort();
      peer.destroy();
      guestConnectionRef.current = null;
      hostConnections.clear();
    };
  }, [request]);

  const isHost = status === 'connected' && Boolean(request?.wantsHost);
  const session = useMemo(() => request ? { code: request.code, playerId: request.playerId, playerName: request.name } : null, [request]);
  const sendNetworkMessage = useCallback((message: CoopMessage) => {
    if (request?.wantsHost) {
      for (const entry of hostConnectionsRef.current.values()) if (entry.connection.open) entry.connection.send(message);
      return true;
    }
    const connection = guestConnectionRef.current;
    if (!connection?.open) return false;
    connection.send(message); return true;
  }, [request?.wantsHost]);
  const sendStart = useCallback(async (start: CoopStart) => {
    if (!request?.wantsHost) return false;
    setStartMessage(start); return sendNetworkMessage({ type: 'start', start });
  }, [request?.wantsHost, sendNetworkMessage]);
  const sendSnapshot = useCallback(async (next: CoopSnapshot) => {
    if (!request?.wantsHost) return false;
    setSnapshot(next); return sendNetworkMessage({ type: 'snapshot', snapshot: next });
  }, [request?.wantsHost, sendNetworkMessage]);
  const sendAction = useCallback(async (action: CoopAction) => {
    if (!request || request.wantsHost) return false;
    return sendNetworkMessage({ type: 'action', from: request.playerId, action });
  }, [request, sendNetworkMessage]);
  const requestState = useCallback(async () => {
    if (!request) return false;
    if (request.wantsHost) { setStateRequest(value => value + 1); return true; }
    return sendNetworkMessage({ type: 'request-state', from: request.playerId });
  }, [request, sendNetworkMessage]);
  const sendTaskState = useCallback(async (open: boolean) => {
    if (!request) return false;
    if (request.wantsHost) setBusyPlayerIds(current => open
      ? current.includes(request.playerId) ? current : [...current, request.playerId]
      : current.filter(id => id !== request.playerId));
    return sendNetworkMessage({ type: 'task-state', playerId: request.playerId, open });
  }, [request, sendNetworkMessage]);
  const setActionHandler = useCallback((handler: (action: CoopAction) => void) => { actionHandlerRef.current = handler; }, []);
  const sendMovementNow = useCallback((movement: CoopMovement) => {
    lastMovementSentRef.current = performance.now();
    sendNetworkMessage({ type: 'movement', movement });
  }, [sendNetworkMessage]);
  const sendMovement = useCallback((movement: Omit<CoopMovement, 'playerId'>) => {
    if (!request) return;
    const payload = { ...movement, playerId: request.playerId };
    const elapsed = performance.now() - lastMovementSentRef.current;
    if (!movement.walking || elapsed >= 100) {
      window.clearTimeout(movementTimerRef.current); movementTimerRef.current = undefined;
      pendingMovementRef.current = null; sendMovementNow(payload); return;
    }
    pendingMovementRef.current = payload;
    if (movementTimerRef.current !== undefined) return;
    movementTimerRef.current = window.setTimeout(() => {
      movementTimerRef.current = undefined;
      const pending = pendingMovementRef.current; pendingMovementRef.current = null;
      if (pending) sendMovementNow(pending);
    }, Math.max(0, 100 - elapsed));
  }, [request, sendMovementNow]);

  return {
    status, error, session, players, isHost, startMessage, snapshot, movements,
    busyPlayerIds, stateRequest, createRoom, joinRoom, leave, sendStart, sendSnapshot, sendAction,
    requestState, sendTaskState, sendMovement, setActionHandler,
  };
}

export type CoopSessionController = ReturnType<typeof useCoopSession>;
