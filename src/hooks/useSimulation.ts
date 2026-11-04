import { useState, useCallback, useEffect, useRef } from 'react';
import { MissionSimulator } from '../engine/SimulationState';
import { SimulationState, LocationType, Difficulty, ResourceAllocation, AstronautRole } from '../engine/types';

export function useSimulation(location: LocationType, crewCount: number = 4, difficulty: Difficulty = 'normal') {
  const [state, setState] = useState<SimulationState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 4x
  const simulatorRef = useRef<MissionSimulator | null>(null);

  // Initialize simulator
  useEffect(() => {
    const simulator = new MissionSimulator(location, crewCount, difficulty);
    simulatorRef.current = simulator;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setState(simulator.getState());
  }, [location, crewCount, difficulty]);

  // Run simulation loop
  useEffect(() => {
    if (!isRunning || !simulatorRef.current) return;

    const interval = setInterval(() => {
      if (!simulatorRef.current) return;

      // One simulated hour per tick. Speed changes the cadence instead of batching
      // several hours into one render, so movement and alerts stay readable.
      simulatorRef.current.step();

      setState(simulatorRef.current.getState());

      // Stop if mission ended
      if (!simulatorRef.current.isMissionRunning()) {
        setIsRunning(false);
      }
    }, 1000 / speed); // 1X = one simulated hour per real second

    return () => clearInterval(interval);
  }, [isRunning, speed]);

  const toggleRunning = useCallback(() => {
    setIsRunning((running) => !running);
  }, []);

  const setAllocation = useCallback((allocation: Partial<ResourceAllocation>) => {
    if (simulatorRef.current) {
      simulatorRef.current.setResourceAllocation(allocation);
      setState(simulatorRef.current.getState());
    }
  }, []);

  const assignCrew = useCallback((role: AstronautRole, assignment: 'maintenance' | 'rest') => {
    if (simulatorRef.current) {
      simulatorRef.current.assignCrew(role, assignment);
      setState(simulatorRef.current.getState());
    }
  }, []);

  const restart = useCallback(() => {
    setIsRunning(false);
    const simulator = new MissionSimulator(location, crewCount, difficulty);
    simulatorRef.current = simulator;
    setState(simulator.getState());
  }, [location, crewCount, difficulty]);

  return {
    state,
    isRunning,
    toggleRunning,
    speed,
    setSpeed,
    setAllocation,
    assignCrew,
    restart,
  };
}
