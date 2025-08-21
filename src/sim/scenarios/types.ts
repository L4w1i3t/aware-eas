import type { Alert } from '@sim/models/alert';

export interface Scenario {
  name: string;
  polygon: [number,number][]; // alert area
  devices: number;
  insideRatio: number; // fraction initially inside polygon
  sectors: { count: number; mbps: number; degradedPct: number; degradedMbps: number; rttMs: number; drop: number; };
  alerts: Alert[];
}
