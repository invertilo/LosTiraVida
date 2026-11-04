import { useState, useCallback, useEffect, useRef } from 'react';
import { MissionSimulator } from '../engine/SimulationState';
import { SimulationState, LocationType, ResourceAllocation, AstronautRole } from '../engine/types';

export function useSimulation(location: LocationType, crewCount: number = 4) {
  const [state, setState] = useState<SimulationState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 4x
  const simulatorRef = useRef<MissionSimulator | null>(null);

  // Initialize simulator
  useEffect(() => {
    const simulator = new MissionSimulator(location, crewCount);
    simulatorRef.current = simulator;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setState(simulator.getState());
  }, [location, crewCount]);

  // Run simulation loop
  useEffect(() => {
    if (!isRunning || !simulatorRef.current) return;

    const interval = setInterval(() => {
      if (!simulatorRef.current) return;

      // Step simulation multiple times based on speed
      for (let i = 0; i < speed; i++) {
        simulatorRef.current.step();
      }

      setState(simulatorRef.current.getState());

      // Stop if mission ended
      if (!simulatorRef.current.isMissionRunning()) {
        setIsRunning(false);
      }
    }, 100); // Update every 100ms = 1 hour per 100ms in real-time at 1x speed

    return () => clearInterval(interval);
  }, [isRunning, speed]);

  const toggleRunning = useCallback(() => {
    setIsRunning(!isRunning);
  }, [isRunning]);

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
    const simulator = new MissionSimulator(location, crewCount);
    simulatorRef.current = simulator;
    setState(simulator.getState());
  }, [location, crewCount]);

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
