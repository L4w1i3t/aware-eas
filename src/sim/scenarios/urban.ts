import type { ScenarioSpec } from './types';

// Urban: more alerts, shorter TTL, sharp surges and brief outages
export const UrbanScenario: ScenarioSpec = {
  name: 'Urban',
  baseAlertRatePerMin: 36, // 0.6 per sec
  meanTTL: 900, // 15 min
  targetFirstDeliverySec: 120,
  segments: [
    { startSec: 0, endSec: 180, reliability: 0.95 },
    // Short sharp outage + heavy alerting
    { startSec: 180, endSec: 420, reliability: 0.6, alertRateMul: 1.5 },
    // Query surge as users check status
    { startSec: 420, endSec: 900, reliability: 0.88, queryRateMul: 1.8 },
    { startSec: 900, endSec: 1e9, reliability: 0.96 }
  ]
};

