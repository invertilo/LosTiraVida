import { useState, useCallback, useEffect, useRef } from 'react';
import { MissionSimulator } from '../engine/SimulationState';
import type { SimulatorSaveData } from '../engine/SimulationState';
import { writeMissionSave } from '../engine/save';
import { SimulationState, LocationType, Difficulty, ResourceAllocation, AstronautRole, MaintenanceStation } from '../engine/types';
import type { CoopSnapshot } from '../lib/coop';

export function useSimulation(location: LocationType, crewCount: number = 4, difficulty: Difficulty = 'normal', savedGame: SimulatorSaveData | null = null, pauseOnWarnings = false, interactionPaused = false, remoteSnapshot: CoopSnapshot | null = null, readOnly = false) {
  const [state, setState] = useState<SimulationState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const simulatorRef = useRef<MissionSimulator | null>(null);

  const saveNow = useCallback(() => {
    if (simulatorRef.current?.isMissionRunning()) writeMissionSave(simulatorRef.current.serialize());
  }, []);

  // Initialize simulator
  useEffect(() => {
    const simulator = savedGame ? MissionSimulator.restore(savedGame) : new MissionSimulator(location, crewCount, difficulty);
    simulatorRef.current = simulator;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setState(simulator.getState());
  }, [location, crewCount, difficulty, savedGame]);

  useEffect(() => {
    if (!readOnly || !remoteSnapshot) return;
    const simulator = MissionSimulator.restore(remoteSnapshot.save);
    simulatorRef.current = simulator;
    setState(simulator.getState());
    setIsRunning(remoteSnapshot.running);
    setSpeed(remoteSnapshot.speed);
  }, [readOnly, remoteSnapshot]);

  // Run simulation loop
  useEffect(() => {
    if (readOnly || !isRunning || interactionPaused || !simulatorRef.current) return;

    const interval = setInterval(() => {
      if (!simulatorRef.current) return;

      // One simulated hour per tick. Speed changes the cadence instead of batching
      // several hours into one render, so movement and alerts stay readable.
      const before = simulatorRef.current.getEvents().length;
      simulatorRef.current.step();

      const next = simulatorRef.current.getState();
      setState(next);
      const freshEvents = next.eventLog.slice(before);
      if (freshEvents.length > 0) writeMissionSave(simulatorRef.current.serialize());
      if (freshEvents.some((event) => event.type === 'critical' || event.type === 'failure' || (pauseOnWarnings && event.type === 'warning'))) {
        setIsRunning(false);
        writeMissionSave(simulatorRef.current.serialize());
      }

      // Stop if mission ended
      if (!simulatorRef.current.isMissionRunning()) {
        setIsRunning(false);
        writeMissionSave(null);
      }
    }, 1000 / speed); // 1X = one simulated hour per real second

    return () => clearInterval(interval);
  }, [isRunning, speed, pauseOnWarnings, interactionPaused, readOnly]);

  useEffect(() => {
    if (readOnly || !isRunning || !simulatorRef.current) return;
    const id = window.setInterval(() => {
      if (simulatorRef.current?.isMissionRunning()) writeMissionSave(simulatorRef.current.serialize());
    }, 5000);
    return () => window.clearInterval(id);
  }, [isRunning, readOnly]);

  // Persist at browser lifecycle boundaries; timers are not guaranteed to run before a tab is discarded.
  useEffect(() => {
    const onPageHide = () => saveNow();
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') saveNow(); };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [saveNow]);

  useEffect(() => {
    if (interactionPaused) saveNow();
  }, [interactionPaused, saveNow]);

  const toggleRunning = useCallback(() => {
    setIsRunning((running) => {
      const next = !running;
      if (running && simulatorRef.current?.isMissionRunning()) writeMissionSave(simulatorRef.current.serialize());
      return next;
    });
  }, []);

  const setAllocation = useCallback((allocation: Partial<ResourceAllocation>) => {
    if (simulatorRef.current) {
      simulatorRef.current.setResourceAllocation(allocation);
      setState(simulatorRef.current.getState());
      writeMissionSave(simulatorRef.current.serialize());
    }
  }, []);

  const assignCrew = useCallback((role: AstronautRole, assignment: 'maintenance' | 'rest') => {
    if (simulatorRef.current) {
      simulatorRef.current.assignCrew(role, assignment);
      setState(simulatorRef.current.getState());
      writeMissionSave(simulatorRef.current.serialize());
    }
  }, []);

  const completeTask = useCallback((station: MaintenanceStation, crewId?: string) => {
    if (!simulatorRef.current) return 'La tarea no está disponible.';
    const result = simulatorRef.current.completeMaintenanceTask(station, crewId);
    setState(simulatorRef.current.getState());
    writeMissionSave(simulatorRef.current.serialize());
    return result;
  }, []);

  const restart = useCallback(() => {
    setIsRunning(false);
    const simulator = new MissionSimulator(location, crewCount, difficulty);
    simulatorRef.current = simulator;
    setState(simulator.getState());
    writeMissionSave(simulator.serialize());
  }, [location, crewCount, difficulty]);

  return {
    state,
    isRunning,
    toggleRunning,
    speed,
    setSpeed,
    setAllocation,
    assignCrew,
    completeTask,
    restart,
    saveNow,
    serializeNow: () => simulatorRef.current?.serialize() ?? null,
  };
}
