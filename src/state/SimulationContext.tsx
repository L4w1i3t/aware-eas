import { createContext, useContext, useMemo, useState } from 'react';
import type { Environment } from '../sim/geo/types';
import type { ScenarioName } from '../sim/scenarios/types';
import type { Alert, Sample } from '../sim/types';
import type { RegionStats } from '../sim/run';

export type SimulationSnapshot = {
  seed: string;
  scenario: ScenarioName;
  baselineReliability: number;
  environment: Environment;
  regionStats: RegionStats[];
  timeline: Sample[];
  issuedAlerts?: Alert[];
  generatedAt: number;
  info?: string;
};

export type SimulationContextValue = {
  snapshot: SimulationSnapshot | null;
  setSnapshot: (snapshot: SimulationSnapshot | null) => void;
  activeTimeSec: number;
  setActiveTimeSec: (value: number) => void;
};

const SimulationContext = createContext<SimulationContextValue | undefined>(undefined);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshotState] = useState<SimulationSnapshot | null>(null);
  const [activeTimeSec, setActiveTimeSecState] = useState(0);

  const handleSetSnapshot = (next: SimulationSnapshot | null) => {
    setSnapshotState(next);
    if (next?.timeline?.length) {
      const last = next.timeline[next.timeline.length - 1];
      setActiveTimeSecState(last.t);
    } else {
      setActiveTimeSecState(0);
    }
  };

  const value = useMemo(
    () => ({
      snapshot,
      setSnapshot: handleSetSnapshot,
      activeTimeSec,
      setActiveTimeSec: setActiveTimeSecState
    }),
    [snapshot, activeTimeSec]
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulationContext(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error('useSimulationContext must be used within SimulationProvider');
  }
  return ctx;
}
