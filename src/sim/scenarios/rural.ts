import type { Scenario } from './types';

export const rural: Scenario = {
  name: 'Rural Flood Warning',
  polygon: [
    [-78.85, 37.45], [-78.70, 37.45], [-78.70, 37.65], [-78.85, 37.65]
  ],
  devices: 8000,
  insideRatio: 0.7,
  sectors: { count: 6, mbps: 25, degradedPct: 0.3, degradedMbps: 5, rttMs: 80, drop: 0.012 },
  alerts: [
    { 
      id: 'watch1', 
      polygon: [[-78.85, 37.45], [-78.70, 37.45], [-78.70, 37.65], [-78.85, 37.65]], 
      sizeBytes: 40_000, 
      issuedAt: 0, 
      expireAt: 120*60_000, 
      urgency: 'Expected', 
      severity: 'Moderate' 
    },
    { 
      id: 'warn1',  
      polygon: [[-78.80, 37.50], [-78.75, 37.50], [-78.75, 37.60], [-78.80, 37.60]], 
      sizeBytes: 55_000, 
      issuedAt: 30*60_000, 
      expireAt: 120*60_000, 
      urgency: 'Immediate', 
      severity: 'Severe' 
    },
    { 
      id: 'upd1',   
      polygon: [[-78.78, 37.52], [-78.77, 37.52], [-78.77, 37.58], [-78.78, 37.58]], 
      sizeBytes: 35_000, 
      issuedAt: 60*60_000, 
      expireAt: 120*60_000, 
      urgency: 'Expected', 
      severity: 'Moderate' 
    }
  ]
};
