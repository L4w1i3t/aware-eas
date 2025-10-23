import type { ScenarioSpec } from './types';

// Rural: fewer alerts, longer TTL, deeper outages, slower query surges
export const RuralScenario: ScenarioSpec = {
  name: 'Rural',
  baseAlertRatePerMin: 6, // 0.1 per sec
  meanTTL: 1800, // 30 min
  targetFirstDeliverySec: 300,
  segments: [
    { startSec: 0, endSec: 300, reliability: 0.9 },
    // Outage window
    { startSec: 300, endSec: 900, reliability: 0.55, alertRateMul: 1.2, queryRateMul: 0.8 },
    // Recovery + surge of user queries
    { startSec: 900, endSec: 1500, reliability: 0.8, alertRateMul: 1.0, queryRateMul: 1.5 },
    // Stabilize
    { startSec: 1500, endSec: 1e9, reliability: 0.92 }
  ]
};

