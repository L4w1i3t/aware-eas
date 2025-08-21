import type { Scenario } from './types';

export const urban: Scenario = {
  name: 'Urban Flood',
  polygon: [
    [-78.50, 38.03], [-78.45, 38.03], [-78.45, 38.08], [-78.50, 38.08]
  ],
  devices: 30000,
  insideRatio: 0.6,
  sectors: { count: 25, mbps: 60, degradedPct: 0.2, degradedMbps: 6, rttMs: 40, drop: 0.005 },
  alerts: [
    { 
      id: 'warn1', 
      polygon: [[-78.49, 38.04], [-78.47, 38.04], [-78.47, 38.07], [-78.49, 38.07]], // Smaller flood zone
      sizeBytes: 60_000, 
      issuedAt: 0, 
      expireAt: 60*60_000, 
      urgency: 'Immediate', 
      severity: 'Extreme'  // HIGH priority: will get 5+4+1=10
    },
    { 
      id: 'upd1',  
      polygon: [[-78.485, 38.045], [-78.475, 38.045], [-78.475, 38.065], [-78.485, 38.065]], // Overlapping update
      sizeBytes: 40_000,  // Larger to create more cache pressure
      issuedAt: 5*60_000,  // 5 minutes (closer timing)
      expireAt: 60*60_000, 
      urgency: 'Expected', 
      severity: 'Severe'  // MEDIUM priority: will get 5+2+0=7
    },
    { 
      id: 'upd2',  
      polygon: [[-78.48, 38.05], [-78.475, 38.05], [-78.475, 38.06], [-78.48, 38.06]], // Small final area
      sizeBytes: 35_000,  // Larger to create more cache pressure
      issuedAt: 10*60_000, // 10 minutes (closer timing)
      expireAt: 60*60_000, 
      urgency: 'Expected', 
      severity: 'Moderate'  // LOW priority: will get 5+1+0=6
    }
  ]
};
