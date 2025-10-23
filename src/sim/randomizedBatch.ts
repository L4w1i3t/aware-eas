import { runMultiPolicyBatch, type PolicyComparisonResult } from './multiPolicyBatch';
import type { RunOptions } from './run';

export type RandomizedMultiPolicyRun = {
  options: RunOptions;
  comparison: PolicyComparisonResult;
};

export type RandomizedMultiPolicyResult = {
  kind: 'randomized-multi-policy';
  timestamp: number;
  count: number;
  runs: RandomizedMultiPolicyRun[];
  info: string;
};

const SCENARIOS: RunOptions['scenario'][] = ['Rural', 'Suburban', 'Urban'];
const CACHE_CHOICES = [16, 32, 64, 128, 256, 512, 1024, 2048];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 3) {
  const v = Math.random() * (max - min) + min;
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomUUID(): string {
  // Prefer Web Crypto if available
  const g: any = globalThis as any;
  if (g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID();
  // Fallback
  return `rand-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Generate a fully randomized set of RunOptions for a single multi-policy comparison.
 * All knobs are randomized within reasonable ranges.
 */
export function randomizeRunOptions(base?: Partial<RunOptions>): RunOptions {
  const pushEnabled = Math.random() < 0.6; // enable pushes ~60% of the time
  const policy: RunOptions['policy'] = 'PriorityFresh'; // base options use PF weights but each policy will be compared in batch
  return {
    scenario: base?.scenario ?? pick(SCENARIOS),
    policy: base?.policy ?? policy,
    cacheSize: base?.cacheSize ?? pick(CACHE_CHOICES),
    alerts: base?.alerts ?? randInt(80, 2000),
    reliability: base?.reliability ?? randFloat(0.3, 1.0, 3),
    durationSec: base?.durationSec ?? randInt(300, 3600),
    queryRatePerMin: base?.queryRatePerMin ?? randInt(10, 300),
    seed: base?.seed ?? randomUUID(),
    // PF weights (used when comparing PF; ignored by other policies)
    wS: base?.wS ?? randFloat(0, 5, 2),
    wU: base?.wU ?? randFloat(0, 5, 2),
    wF: base?.wF ?? randFloat(0, 6, 2),
    // Push controls
    pushRateLimitPerMin: base?.pushRateLimitPerMin ?? (pushEnabled ? randInt(10, 180) : 0),
    pushDedupWindowSec: base?.pushDedupWindowSec ?? (pushEnabled ? randInt(10, 600) : 0),
    pushThreshold: base?.pushThreshold ?? (pushEnabled ? randFloat(0.1, 0.9, 2) : 0.5),
    // PF exploration and model tuning
    pfExplorationEpsilon: base?.pfExplorationEpsilon ?? randFloat(0, 0.15, 3),
    pfHashBuckets: base?.pfHashBuckets ?? pick([64, 128, 256, 512]),
    pfTemperature: base?.pfTemperature ?? randFloat(0.1, 1.5, 2),
    pfDecay: base?.pfDecay ?? randFloat(0.85, 1.0, 3),
    pfLearningRate: base?.pfLearningRate ?? randFloat(0.01, 0.3, 3),
    pfRegularization: base?.pfRegularization ?? randFloat(0.0, 0.15, 3),
    // Batch/seed controls (fixed inside multi-policy comparison)
    seedMode: 'Fixed',
    replicates: 1
  };
}

/**
 * Run N randomized multi-policy comparisons. Each run randomizes all parameters.
 */
export function runRandomizedMultiPolicy(count: number, base?: Partial<RunOptions>): RandomizedMultiPolicyResult {
  const runs: RandomizedMultiPolicyRun[] = [];
  const n = Math.max(1, Math.floor(count));
  for (let i = 0; i < n; i++) {
    const opts = randomizeRunOptions(base);
    const comparison = runMultiPolicyBatch(opts);
    runs.push({ options: opts, comparison });
  }
  const timestamp = Date.now();
  return {
    kind: 'randomized-multi-policy',
    timestamp,
    count: n,
    runs,
    info: `Randomized ${n} multi-policy comparisons (all parameters randomized per run)`
  };
}

/**
 * Export all randomized comparisons as a flattened CSV (one row per policy per run)
 */
export function exportRandomizedMultiPolicyCSV(result: RandomizedMultiPolicyResult): string {
  const header = [
    'runIndex',
    'policy',
    'seed',
    'scenario',
    'cacheSize',
    'alerts',
    'reliability',
    'durationSec',
    'queryRatePerMin',
    'wS','wU','wF',
    'pushRateLimitPerMin','pushDedupWindowSec','pushThreshold',
    'pfExplorationEpsilon','pfHashBuckets','pfTemperature','pfDecay','pfLearningRate','pfRegularization',
    // metrics
    'cacheHitRate','deliveryRate','avgFreshness','staleAccessRate','redundancyIndex','actionabilityFirstRatio','timelinessConsistency','pushesSent','pushSuppressRate','pushDuplicateRate','pushTimelyFirstRatio'
  ];
  const rows: string[] = [header.join(',')];

  result.runs.forEach((entry, idx) => {
    const { options: o, comparison } = entry;
    comparison.runs.forEach(({ policy, result }) => {
      const m = result.metrics;
      rows.push([
        (idx + 1).toString(),
        policy,
        result.seed,
        result.scenario,
        o.cacheSize.toString(),
        result.issuedAlerts.length.toString(),
        (comparison.reliability ?? o.reliability).toFixed(3),
        (comparison.durationSec ?? o.durationSec).toString(),
        (comparison.queryRatePerMin ?? o.queryRatePerMin).toString(),
        (o.wS ?? '').toString(),
        (o.wU ?? '').toString(),
        (o.wF ?? '').toString(),
        (o.pushRateLimitPerMin ?? 0).toString(),
        (o.pushDedupWindowSec ?? 0).toString(),
        (o.pushThreshold ?? 0).toString(),
        (o.pfExplorationEpsilon ?? '').toString(),
        (o.pfHashBuckets ?? '').toString(),
        (o.pfTemperature ?? '').toString(),
        (o.pfDecay ?? '').toString(),
        (o.pfLearningRate ?? '').toString(),
        (o.pfRegularization ?? '').toString(),
        // metrics
        m.cacheHitRate.toFixed(6),
        m.deliveryRate.toFixed(6),
        m.avgFreshness.toFixed(6),
        m.staleAccessRate.toFixed(6),
        m.redundancyIndex.toFixed(6),
        m.actionabilityFirstRatio.toFixed(6),
        m.timelinessConsistency.toFixed(6),
        m.pushesSent.toString(),
        m.pushSuppressRate.toFixed(6),
        m.pushDuplicateRate.toFixed(6),
        m.pushTimelyFirstRatio.toFixed(6)
      ].join(','));
    });
  });

  return rows.join('\n');
}
