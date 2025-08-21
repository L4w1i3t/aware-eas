import type { Scenario } from './types';

export const suburban: Scenario = {
  name: 'Suburban Flash Flood',
  polygon: [
    [-77.95, 38.75], [-77.85, 38.75], [-77.85, 38.85], [-77.95, 38.85]
  ],
  devices: 15000,
  insideRatio: 0.8,
  sectors: { count: 12, mbps: 40, degradedPct: 0.15, degradedMbps: 8, rttMs: 60, drop: 0.008 },
  alerts: [
    { 
      id: 'flash1', 
      polygon: [[-77.95, 38.75], [-77.85, 38.75], [-77.85, 38.85], [-77.95, 38.85]], 
      sizeBytes: 45_000, 
      issuedAt: 0, 
      expireAt: 45*60_000, 
      urgency: 'Immediate', 
      severity: 'Extreme' 
    },
    { 
      id: 'evac1',  
      polygon: [[-77.92, 38.78], [-77.88, 38.78], [-77.88, 38.82], [-77.92, 38.82]], 
      sizeBytes: 75_000, 
      issuedAt: 5*60_000, 
      expireAt: 45*60_000, 
      urgency: 'Immediate', 
      severity: 'Severe' 
    },
    { 
      id: 'upd1',   
      polygon: [[-77.90, 38.80], [-77.89, 38.80], [-77.89, 38.81], [-77.90, 38.81]], 
      sizeBytes: 25_000, 
      issuedAt: 15*60_000, 
      expireAt: 45*60_000, 
      urgency: 'Expected', 
      severity: 'Moderate' 
    }
  ]
};
