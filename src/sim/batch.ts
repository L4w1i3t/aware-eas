import { runSimulation, type RunOptions, type RunResult, type SeedMode } from './run';
import type { Metrics } from './types';

export type BatchConfig = {
  replicates: number;
  seedMode: SeedMode;
};

export type BatchRunResult = {
  kind: 'batch';
  baseSeed: string;
  seedMode: SeedMode;
  replicates: number;
  runs: Array<{ seed: string; result: RunResult }>;
  aggregate: {
    mean: Metrics;
    stdev: Metrics;
  };
  info: string;
};

const metricKeys: (keyof Metrics)[] = [
  'cacheHitRate',
  'deliveryRate',
  'avgFreshness',
  'staleAccessRate',
  'redundancyIndex',
  'actionabilityFirstRatio',
  'timelinessConsistency',
  'pushesSent',
  'pushSuppressRate',
  'pushDuplicateRate',
  'pushTimelyFirstRatio'
];

let randomCounter = 0;

export function runBatch(baseOptions: RunOptions, config: BatchConfig): BatchRunResult {
  const { replicates, seedMode } = sanitizeConfig(config);
  const runs: Array<{ seed: string; result: RunResult }> = [];
  const baseSeed = baseOptions.seed;

  for (let i = 0; i < replicates; i++) {
    const seed = deriveSeed(baseSeed, i, seedMode);
    const result = runSimulation({ ...baseOptions, seed });
    runs.push({ seed, result });
  }

  const aggregate = aggregateMetrics(runs.map((r) => r.result));
  return {
    kind: 'batch',
    baseSeed,
    seedMode,
    replicates,
    runs,
    aggregate,
    info: `Aggregated ${replicates} run(s) using ${seedMode} seeds derived from base seed "${baseSeed}"`
  };
}

function sanitizeConfig(config: BatchConfig): BatchConfig {
  const replicates = Math.max(1, Math.floor(config.replicates || 1));
  const seedMode = config.seedMode ?? 'Fixed';
  return { replicates, seedMode };
}

function deriveSeed(baseSeed: string, index: number, mode: SeedMode): string {
  if (mode === 'Fixed') {
    return baseSeed;
  }
  if (mode === 'DeterministicJitter') {
    return `${baseSeed}#${index + 1}`;
  }
  return `${baseSeed}#${randomSeedString(index)}`;
}

function randomSeedString(index: number): string {
  randomCounter += 1;
  const globalCrypto = typeof globalThis !== 'undefined' && 'crypto' in globalThis ? (globalThis.crypto as Crypto) : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  return `rand-${Date.now().toString(36)}-${index}-${randomCounter}-${Math.random().toString(16).slice(2)}`;
}

function aggregateMetrics(results: RunResult[]): { mean: Metrics; stdev: Metrics } {
  const count = results.length;
  const mean = {} as Metrics;
  const stdev = {} as Metrics;

  for (const key of metricKeys) {
    mean[key] = count
      ? results.reduce((acc, r) => acc + (r.metrics[key] ?? 0), 0) / count
      : 0;
  }

  if (count <= 1) {
    for (const key of metricKeys) {
      stdev[key] = 0;
    }
    return { mean, stdev };
  }

  for (const key of metricKeys) {
    const variance =
      results.reduce((acc, r) => {
        const delta = (r.metrics[key] ?? 0) - mean[key];
        return acc + delta * delta;
      }, 0) /
      (count - 1);
    stdev[key] = Math.sqrt(Math.max(variance, 0));
  }

  return { mean, stdev };
}
