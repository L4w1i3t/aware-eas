import { hashStringToSeed, mulberry32, type RNG } from './core/RandomGenerator';
import type { Alert, Metrics, Sample } from './types';
import { LRU } from './policies/lru';
import { TTLOnly } from './policies/ttlOnly';
import { PriorityFresh } from './policies/priorityFresh';
import type { CachePolicy } from './policies/base';
import { PAFTinyLFUCache } from './policies/PAFTinyLFUCache';
import type { ScenarioName, ScenarioSpec } from './scenarios/types';
import { UrbanScenario } from './scenarios/urban';
import { SuburbanScenario } from './scenarios/suburban';
import { RuralScenario } from './scenarios/rural';
import { getSegment } from './scenarios/types';
import { generateEnvironment } from './geo/generate';
import type { Environment, Region } from './geo/types';
import { PriorityForecastModel, synthesizeWeatherHistory, synthesizeAnomalyHistory, type PFTrainingSample, type PFState } from './learning/pfModel';

export type SeedMode = 'Fixed' | 'DeterministicJitter' | 'Randomized';

export type RunOptions = {
  scenario: ScenarioName;
  policy: 'LRU' | 'TTLOnly' | 'PriorityFresh' | 'PAFTinyLFU';
  cacheSize: number;
  alerts: number;
  reliability: number; // baseline reliability 0..1 (modulated by scenario)
  durationSec: number;
  queryRatePerMin: number; // requests for alerts per minute
  seed: string;
  // Optional weights for PriorityFresh
  wS?: number;
  wU?: number;
  wF?: number;
  // Batch/nondeterministic controls (handled outside single run execution)
  replicates?: number;
  seedMode?: SeedMode;
  // PF model options
  pfExplorationEpsilon?: number;
  pfTrainingSamples?: PFTrainingSample[];
  pfRandomize?: boolean;
  pfInitialState?: PFState;
  pfHashBuckets?: number;
  pfTemperature?: number;
  pfDecay?: number;
  pfLearningRate?: number;
  pfRegularization?: number;
  // Push decision controls
  pushRateLimitPerMin?: number; // R: max pushes per minute
  pushDedupWindowSec?: number; // D: suppress within thread window
  pushThreshold?: number; // tau: PF probability threshold for push
  // Delivery retry controls (network realism)
  deliveryRetryIntervalSec?: number; // seconds between retry attempts if initial delivery fails
  deliveryMaxAttempts?: number; // total attempts including the first (1 = no retry)
};

export type RegionStats = {
  regionId: string;
  delivered: number;
  dropped: number;
  firstRetrievals: number;
  avgFirstRetrievalLatencySec: number | null;
};

export type RunResult = {
  metrics: Metrics;
  timeline: Sample[];
  info: string;
  issuedAlerts: Alert[];
  deliveredAlerts: Alert[];
  environment: Environment;
  regionStats: RegionStats[];
  scenario: ScenarioName;
  baselineReliability: number;
  seed: string;
  pfState?: PFState;
};

const ENV_WIDTH = 960;
const ENV_HEIGHT = 540;
const REGION_TARGETS: Record<ScenarioName, number> = {
  Urban: 18,
  Suburban: 12,
  Rural: 8
};

export function runSimulation(opts: RunOptions): RunResult {
  const scenario = pickScenario(opts.scenario);
  const environment = buildEnvironmentForRun(opts);
  const regionLookup = new Map(environment.regions.map((r) => [r.id, r]));
  const regionStatsMap = new Map<string, { delivered: number; dropped: number; firstLatSum: number; firstRetrievals: number }>();
  for (const region of environment.regions) {
    regionStatsMap.set(region.id, { delivered: 0, dropped: 0, firstLatSum: 0, firstRetrievals: 0 });
  }
  const retryInterval = Math.max(1, Math.floor(opts.deliveryRetryIntervalSec ?? 0));
  const maxAttempts = Math.max(1, Math.floor(opts.deliveryMaxAttempts ?? 1));

  let pfModel: PriorityForecastModel | undefined;
  if (opts.policy === 'PriorityFresh') {
    const weatherSeed = hashStringToSeed(`${opts.seed}|weather`);
    const weatherRng = mulberry32(weatherSeed);
    const weatherHistory = synthesizeWeatherHistory(environment, weatherRng);
    const anomalySeed = hashStringToSeed(`${opts.seed}|anomaly`);
    const anomalyRng = mulberry32(anomalySeed);
    const anomalyHistory = synthesizeAnomalyHistory(environment, anomalyRng);
    const pfRng = opts.pfRandomize ? Math.random : mulberry32(hashStringToSeed(`${opts.seed}|pf`));
    pfModel = new PriorityForecastModel(environment, weatherHistory, anomalyHistory, {
      explorationEpsilon: opts.pfExplorationEpsilon,
      initialState: opts.pfInitialState,
      hashBucketCount: opts.pfHashBuckets,
      temperature: opts.pfTemperature,
      decay: opts.pfDecay,
      learningRate: opts.pfLearningRate,
      regularization: opts.pfRegularization,
      rng: pfRng
    });
    if (opts.pfTrainingSamples?.length) {
      pfModel.ingestHistoricalSamples(opts.pfTrainingSamples);
    }
  }

  const rng = mulberry32(hashStringToSeed(opts.seed));
  const alertStream = synthAlerts(opts, scenario, environment, rng);
  const policy = createPolicy(opts, pfModel);

  let delivered = 0;
  let hits = 0;
  let misses = 0;
  let staleAccess = 0;
  let freshnessSum = 0;
  let freshnessCount = 0;
  let duplicateDelivered = 0;
  // Push metrics
  let pushesSent = 0;
  let pushSuppressCount = 0;
  let pushDuplicates = 0;
  const lastPushByThread = new Map<string, number>();
  const firstPushTimeByThread = new Map<string, number>();
  const pushTimes: number[] = [];
  const firstRetrievalByThread = new Map<string, { t: number; actionable: boolean }>();
  const deliveredByThread = new Map<string, number>();
  const firstRetrievalLatencyByAlert = new Map<string, number>();
  const deliveredAlerts: Alert[] = [];
  const issuedAlerts: Alert[] = [];
  const timeline: Sample[] = [];
  type PendingAttempt = { alert: Alert; nextAttemptAt: number; attemptsLeft: number };
  const pending: PendingAttempt[] = [];

  // Pre-index alerts by issue time
  const byTime = new Map<number, Alert[]>();
  for (const a of alertStream) {
    const t = Math.floor(a.issuedAt);
    if (!byTime.has(t)) byTime.set(t, []);
    byTime.get(t)!.push(a);
  }

  const queriesPerSecBase = opts.queryRatePerMin / 60;
  const now0 = 0;
  const dt = 1; // sec per step
  const steps = Math.max(1, Math.floor(opts.durationSec / dt));

  let t = now0;
  for (let i = 0; i < steps; i++, t += dt) {
    const seg = getSegment(scenario, t);
    const arrivals = byTime.get(Math.floor(t)) ?? [];

    // Arrivals
    for (const a of arrivals) {
      issuedAlerts.push(a);
      const regionId = a.regionId ?? a.geokey ?? '';
      const stats = ensureRegionStats(regionStatsMap, regionId);

      const deliveredNow = attemptDelivery(a, t);
      if (!deliveredNow) {
        // Queue for retry if allowed
        if (maxAttempts > 1) {
          pending.push({ alert: a, nextAttemptAt: t + retryInterval, attemptsLeft: maxAttempts - 1 });
        } else {
          stats.dropped += 1;
          if (pfModel) pfModel.observeDrop(a, t);
        }
      }
    }

    // Retry pending deliveries whose time has come (respect TTL)
    if (pending.length) {
      for (let idx = pending.length - 1; idx >= 0; idx--) {
        const pnd = pending[idx];
        const a = pnd.alert;
        // drop if TTL expired
        if (t >= a.issuedAt + a.ttlSec) {
          const regionId = a.regionId ?? a.geokey ?? '';
          const stats = ensureRegionStats(regionStatsMap, regionId);
          stats.dropped += 1;
          if (pfModel) pfModel.observeDrop(a, t);
          pending.splice(idx, 1);
          continue;
        }
        if (t >= pnd.nextAttemptAt) {
          const ok = attemptDelivery(a, t);
          if (ok) {
            pending.splice(idx, 1);
          } else if (pnd.attemptsLeft > 1) {
            pnd.attemptsLeft -= 1;
            pnd.nextAttemptAt = t + retryInterval;
          } else {
            const regionId = a.regionId ?? a.geokey ?? '';
            const stats = ensureRegionStats(regionStatsMap, regionId);
            stats.dropped += 1;
            if (pfModel) pfModel.observeDrop(a, t);
            pending.splice(idx, 1);
          }
        }
      }
    }

    const segQueryMul = seg.queryRateMul ?? 1;
    const queriesPerSec = queriesPerSecBase * segQueryMul;

    // Queries
    let q = poisson(queriesPerSec, rng);
    while (q-- > 0) {
      // Biased pick: prefer recent and severe/urgent alerts
      const choice = biasedPick(policy, t, rng);
      if (!choice) {
        misses++;
        continue;
      }
      const cached = policy.get(choice.id, t);
      if (cached) {
        hits++;
        const fresh = freshness(cached, t);
        freshnessSum += fresh;
        freshnessCount++;
        if (fresh <= 0) staleAccess++;
        const latency = Math.max(0, t - cached.issuedAt);
        if (pfModel) {
          pfModel.observeRetrieval(cached, {
            freshness: fresh,
            latencySec: latency,
            servedAt: t,
            slaSec: scenario.targetFirstDeliverySec
          });
        }

        // First retrieval tracking for actionability-first and timeliness
        const th = cached.threadKey ?? cached.id;
        if (!firstRetrievalByThread.has(th)) {
          const actionable = cached.urgency === 'Immediate' || cached.severity === 'Extreme' || cached.severity === 'Severe';
          firstRetrievalByThread.set(th, { t, actionable });
        }

        if (!firstRetrievalLatencyByAlert.has(cached.id)) {
          const latency = Math.max(0, t - cached.issuedAt);
          firstRetrievalLatencyByAlert.set(cached.id, latency);
          const regionId = cached.regionId ?? cached.geokey ?? '';
          const stats = ensureRegionStats(regionStatsMap, regionId);
          stats.firstRetrievals += 1;
          stats.firstLatSum += latency;
        }
      } else {
        misses++;
        if (pfModel) pfModel.observeDrop(choice, t);
      }
    }

    timeline.push({ t, cacheSize: policy.size(), hits, misses });
  }

  const totalRequests = hits + misses;
  const threads = Math.max(1, firstRetrievalByThread.size);
  let timely = 0;
  const targetSLA = scenario.targetFirstDeliverySec;
  for (const [, v] of firstRetrievalByThread) {
    if (v.t <= targetSLA) timely++;
  }
  const actionableFirst = [...firstRetrievalByThread.values()].filter((v) => v.actionable).length;

  const metrics: Metrics = {
    cacheHitRate: totalRequests ? hits / totalRequests : 0,
    deliveryRate: opts.alerts ? delivered / opts.alerts : 0,
    avgFreshness: freshnessCount ? freshnessSum / freshnessCount : 0,
    staleAccessRate: totalRequests ? staleAccess / totalRequests : 0,
    redundancyIndex: delivered ? duplicateDelivered / delivered : 0,
    actionabilityFirstRatio: actionableFirst / threads,
    timelinessConsistency: threads ? timely / threads : 0,
    pushesSent,
    pushSuppressRate: delivered ? pushSuppressCount / delivered : 0,
    pushDuplicateRate: pushesSent ? pushDuplicates / pushesSent : 0,
    pushTimelyFirstRatio: firstPushTimeByThread.size
      ? Array.from(firstPushTimeByThread.values()).filter((tp) => tp <= targetSLA).length / firstPushTimeByThread.size
      : 0
  };

  const regionStats: RegionStats[] = Array.from(regionStatsMap.entries()).map(([regionId, stats]) => ({
    regionId,
    delivered: stats.delivered,
    dropped: stats.dropped,
    firstRetrievals: stats.firstRetrievals,
    avgFirstRetrievalLatencySec: stats.firstRetrievals ? stats.firstLatSum / stats.firstRetrievals : null
  }));

  return {
    metrics,
    timeline,
    info: `${opts.policy} on ${opts.scenario} | cache=${opts.cacheSize} | alerts=${opts.alerts} | reliability=${opts.reliability} | regions=${environment.regions.length}`,
    issuedAlerts,
    deliveredAlerts,
    environment,
    regionStats,
    scenario: opts.scenario,
    baselineReliability: opts.reliability,
    seed: opts.seed,
    pfState: pfModel ? pfModel.getState() : undefined
  };

  function attemptDelivery(a: Alert, now: number): boolean {
    const regionId = a.regionId ?? a.geokey ?? '';
    const region = regionLookup.get(regionId);
    const seg = getSegment(scenario, now);
    const regionMultiplier = region?.localFactor ?? 1;
    const effReliability = clamp01(opts.reliability * seg.reliability * regionMultiplier);
    const stats = ensureRegionStats(regionStatsMap, regionId);
    if (rng() < effReliability) {
      delivered++;
      stats.delivered += 1;
      deliveredAlerts.push(a);
      if (a.threadKey) {
        const count = (deliveredByThread.get(a.threadKey) ?? 0) + 1;
        deliveredByThread.set(a.threadKey, count);
        if (count > 1) duplicateDelivered++;
      }
      policy.put(a, now);

      // Decide whether to push the alert immediately
      const R = Math.max(0, Math.floor(opts.pushRateLimitPerMin ?? 0));
      const D = Math.max(0, Math.floor(opts.pushDedupWindowSec ?? 0));
      const tau = clamp01(opts.pushThreshold ?? 0.0);
      const withinRate = R > 0 ? countRecent(pushTimes, now, 60) < R : false;
      const thread = a.threadKey ?? `${a.eventType}:${regionId}`;
      const lastPushT = lastPushByThread.get(thread) ?? -Infinity;
      const notDuplicate = D > 0 ? now - lastPushT > D : true;
      let p = 0;
      if (pfModel) {
        const fresh = freshness(a, now);
        const ctx = { now, freshness: fresh, baseScore: 0 } as const;
        p = pfModel.score(a, ctx).probability;
      }
      const highImpact = a.urgency === 'Immediate' || a.severity === 'Extreme' || a.severity === 'Severe';
      const shouldConsiderPush = R > 0; // enabled only if a rate limit is configured
      if (shouldConsiderPush) {
        const eps = clamp01(opts.pfExplorationEpsilon ?? 0);
        const explore = pfModel && eps > 0 && rng() < eps;
        const meetsThreshold = p >= tau || explore;
        if (withinRate && notDuplicate && (meetsThreshold || highImpact)) {
          pushesSent++;
          pushTimes.push(now);
          lastPushByThread.set(thread, now);
          if (!firstPushTimeByThread.has(thread)) firstPushTimeByThread.set(thread, now);
          if (lastPushT !== -Infinity) {
            pushDuplicates++;
          }
        } else {
          pushSuppressCount++;
        }
      }
      return true;
    }
    return false;
  }
}

function createPolicy(opts: RunOptions, predictor?: PriorityForecastModel): CachePolicy {
  if (opts.policy === 'LRU') return new LRU(opts.cacheSize);
  if (opts.policy === 'TTLOnly') return new TTLOnly(opts.cacheSize);
  if (opts.policy === 'PAFTinyLFU') return new PAFTinyLFUCache(opts.cacheSize);
  return new PriorityFresh(opts.cacheSize, { wS: opts.wS, wU: opts.wU, wF: opts.wF }, predictor);
}

function buildEnvironmentForRun(opts: RunOptions): Environment {
  const envSeed = `${opts.seed}|env|${opts.scenario}`;
  const envRng = mulberry32(hashStringToSeed(envSeed));
  const regionCount = REGION_TARGETS[opts.scenario] ?? 10;
  return generateEnvironment(envRng, ENV_WIDTH, ENV_HEIGHT, { regions: regionCount });
}

function synthAlerts(opts: RunOptions, scenario: ScenarioSpec, environment: Environment, rng: RNG): Alert[] {
  const alerts: Alert[] = [];
  const horizon = opts.durationSec;
  const baseRatePerSec = scenario.baseAlertRatePerMin / 60;

  let t = 0;
  let idCounter = 0;
  // Thread map to occasionally issue updates/near-duplicates
  const threads = new Map<string, number>();

  while (alerts.length < opts.alerts && t < horizon) {
    const seg = getSegment(scenario, t);
    const rate = baseRatePerSec * (seg.alertRateMul ?? 1);
    const gap = Math.max(1, Math.round(expRand(1 / Math.max(rate, 1e-6), rng)));
    t += gap;
    const ttl = Math.round(Math.max(120, normal(scenario.meanTTL, scenario.meanTTL * 0.25, rng)));

    const region = pickRegion(environment, rng);
    const regionId = region?.id ?? 'R0';

    const sev = pickSeverity(rng, region?.severity);
  const urg = pickUrgency(rng);
    const typeR = rng();
    const eventType = typeR < 0.7 ? 'Flood' : typeR < 0.85 ? 'Shelter' : 'Other';

    // 30% chance to issue update to an existing thread in same region/type
    const makeUpdate = rng() < 0.3 && threads.size > 0;
    let threadKey = `${eventType}:${regionId}`;
    if (!threads.has(threadKey)) threads.set(threadKey, 0);
    let updateNo = threads.get(threadKey)! + 1;
    if (!makeUpdate) {
      // Occasionally start a new thread
      if (rng() < 0.4) {
        threadKey = `${eventType}:${regionId}:${Math.floor(rng() * 1000)}`;
        threads.set(threadKey, 0);
        updateNo = 1;
      }
    }
    threads.set(threadKey, updateNo);

    // Size estimation: severity/urgency influence size a bit
    const baseSize = eventType === 'Flood' ? 1800 : eventType === 'Shelter' ? 1200 : 900;
    const sizeBytes = Math.round(baseSize * (1 + (sev === 'Extreme' ? 0.3 : sev === 'Severe' ? 0.15 : 0)));

    alerts.push({
      id: `A${++idCounter}`,
      eventType,
      severity: sev,
      urgency: urg,
      issuedAt: Math.min(t, horizon - 1),
      ttlSec: ttl,
      sender: 'demo@aware.local',
      headline: `${sev} ${eventType} Alert`,
      instruction: urg === 'Immediate' ? 'Move to higher ground' : 'Prepare to move if needed',
      geokey: regionId,
      regionId,
      sizeBytes,
      threadKey,
      updateNo
    });
  }
  return alerts;
}

function pickRegion(environment: Environment, rng: RNG): Region | undefined {
  if (environment.regions.length === 0) return undefined;
  const idx = Math.floor(rng() * environment.regions.length);
  return environment.regions[idx] ?? environment.regions[0];
}
function pickUrgency(rng: RNG): Alert['urgency'] {
  const r = rng();
  if (r < 0.45) return 'Immediate';
  if (r < 0.85) return 'Expected';
  if (r < 0.95) return 'Future';
  if (r < 0.98) return 'Past';
  return 'Unknown';
}

function pickSeverity(rng: RNG, regionSeverity?: Region['severity']): Alert['severity'] {
  const bias = regionSeverity === 'Extreme' ? 0.12 : regionSeverity === 'Severe' ? 0.06 : 0;
  const r = rng();
  if (r < 0.05) return 'Unknown';
  if (r < 0.20 + bias) return 'Extreme';
  if (r < 0.55 + bias * 0.5) return 'Severe';
  if (r < 0.85) return 'Moderate';
  return 'Minor';
}

function poisson(lambdaPerStep: number, rng: RNG): number {
  // Knuth for small lambda
  let L = Math.exp(-lambdaPerStep);
  let p = 1;
  let k = 0;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function normal(mean: number, stddev: number, rng: RNG): number {
  // Box-Muller
  let u = 0,
    v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return n * stddev + mean;
}

function expRand(mean: number, rng: RNG): number {
  let u = rng();
  if (u < 1e-8) u = 1e-8;
  return -mean * Math.log(u);
}

function freshness(a: Alert, now: number): number {
  const age = Math.max(0, now - a.issuedAt);
  const f = Math.exp(-age / Math.max(1, a.ttlSec));
  return Math.max(0, Math.min(1, f));
}

function biasedPick(policy: { entries: (now: number) => Alert[] }, now: number, rng: RNG): Alert | null {
  const items = policy.entries(now);
  if (items.length === 0) return null;
  // Weight by urgency first, then severity, and freshness
  const weights = items.map((a) => urgW(a.urgency) * sevW(a.severity) * freshness(a, now));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function sevW(s: Alert['severity']) {
  return s === 'Extreme' ? 3 : s === 'Severe' ? 2 : 1;
}

function urgW(u: Alert['urgency']) {
  return u === 'Immediate' ? 3 : u === 'Expected' ? 2 : 1;
}

function pickScenario(name: ScenarioName) {
  if (name === 'Urban') return UrbanScenario;
  if (name === 'Suburban') return SuburbanScenario;
  return RuralScenario;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function ensureRegionStats(
  map: Map<string, { delivered: number; dropped: number; firstLatSum: number; firstRetrievals: number }>,
  regionId: string
) {
  if (!map.has(regionId)) {
    map.set(regionId, { delivered: 0, dropped: 0, firstLatSum: 0, firstRetrievals: 0 });
  }
  return map.get(regionId)!;
}

function countRecent(times: number[], now: number, windowSec: number): number {
  const start = now - windowSec;
  // Drop old entries to keep list short
  let firstIdx = 0;
  while (firstIdx < times.length && times[firstIdx] < start) firstIdx++;
  if (firstIdx > 0) times.splice(0, firstIdx);
  return times.length;
}



