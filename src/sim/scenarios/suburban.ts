import type { ScenarioSpec } from './types';

// Suburban: moderate alerts, moderate TTL, intermittent congestion
export const SuburbanScenario: ScenarioSpec = {
  name: 'Suburban',
  baseAlertRatePerMin: 12, // 0.2 per sec
  meanTTL: 1200, // 20 min
  targetFirstDeliverySec: 180,
  segments: [
    { startSec: 0, endSec: 240, reliability: 0.92 },
    { startSec: 240, endSec: 720, reliability: 0.75, alertRateMul: 1.2 },
    { startSec: 720, endSec: 1200, reliability: 0.85, queryRateMul: 1.4 },
    { startSec: 1200, endSec: 1e9, reliability: 0.93 }
  ]
};

