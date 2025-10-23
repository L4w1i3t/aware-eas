export type ScenarioName = 'Rural' | 'Suburban' | 'Urban';

export type ScenarioSegment = {
  startSec: number;
  endSec: number;
  reliability: number; // 0..1 effective network reliability
  alertRateMul?: number; // multiplier to base alert rate
  queryRateMul?: number; // multiplier to base query rate
};

export type ScenarioSpec = {
  name: ScenarioName;
  baseAlertRatePerMin: number; // base Poisson rate for alert issuance
  meanTTL: number; // seconds
  targetFirstDeliverySec: number; // used for timeliness consistency
  segments: ScenarioSegment[]; // piecewise schedule of outages/surges
};

export function getSegment(spec: ScenarioSpec, t: number): ScenarioSegment {
  for (const seg of spec.segments) {
    if (t >= seg.startSec && t < seg.endSec) return seg;
  }
  // Default fallthrough: last segment reliability
  return spec.segments[spec.segments.length - 1];
}

