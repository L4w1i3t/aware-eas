import type { Alert } from '../types';
import type { Environment, Region } from '../geo/types';
import type { RNG } from '../core/RandomGenerator';

export type RegionWeatherRecord = {
  regionId: string;
  floodFrequency: number;
  rainfallMeanMm: number;
  rainfallVolatility: number;
  drainageScore: number;
  shelterDemandIndex: number;
};

/**
 * Historical patterns and anomalies specific to a region.
 * Captures behaviors like false alarms, last-minute trajectory changes,
 * and overall prediction reliability to inform the PF model.
 */
export type RegionAnomalyHistory = {
  regionId: string;
  /** Rate of alerts that were issued but did not materialize (0-1) */
  falseAlarmRate: number;
  /** Rate of storms/floods that diverted away at the last minute despite head-on trajectory (0-1) */
  lastMinuteDiversionRate: number;
  /** Historical accuracy of warnings for this region (0-1, higher = more reliable) */
  historicalAccuracy: number;
  /** Typical lead time in seconds between warning and event onset */
  typicalLeadTimeSec: number;
  /** Rate at which alerts were under-estimated (actual severity exceeded prediction) */
  underestimationRate: number;
  /** Rate at which alerts were over-estimated (actual severity fell short) */
  overestimationRate: number;
  /** Recent trend: improving (>1), stable (~1), or degrading (<1) accuracy */
  accuracyTrend: number;
};

export type ForecastScoreContext = {
  now: number;
  freshness: number;
  baseScore: number;
};

export type PFTrainingSample = {
  alert: {
    severity: Alert['severity'];
    urgency: Alert['urgency'];
    ttlSec: number;
    regionId?: string;
    geokey?: string;
    regionSeverity?: Region['severity'];
    localReliability?: number;
    floodFrequency?: number;
    rainfallMeanMm?: number;
    rainfallVolatility?: number;
    drainageScore?: number;
    shelterDemandIndex?: number;
    falseAlarmRate?: number;
    lastMinuteDiversionRate?: number;
    historicalAccuracy?: number;
    typicalLeadTimeSec?: number;
    underestimationRate?: number;
    overestimationRate?: number;
    accuracyTrend?: number;
  };
  freshness: number;
  baseScore?: number;
  label: number;
};

export type ScoreDetail = {
  base: number;
  boost: number;
  total: number;
  probability: number;
  exploration: number;
};

export type PFState = {
  weights: number[];
  g2: number[]; // Adagrad accumulators
  featureCount: number;
  hashBucketCount: number;
  temperature: number;
  learningRate: number;
  regularization: number;
  decay: number;
};

export function synthesizeWeatherHistory(environment: Environment, rng: RNG): Map<string, RegionWeatherRecord> {
  const history = new Map<string, RegionWeatherRecord>();
  for (const region of environment.regions) {
    const severityBias = region.severity === 'Extreme' ? 0.2 : region.severity === 'Severe' ? 0.1 : 0;
    const floodFrequency = clamp01(0.25 + severityBias + (rng() - 0.5) * 0.15);
    const rainfallMeanMm = clamp(10, 160, 80 + (rng() - 0.5) * 20 + floodFrequency * 45);
    const rainfallVolatility = clamp01(0.3 + (rng() - 0.5) * 0.2 + severityBias * 0.3);
    const drainageScore = clamp01(0.5 + (region.localFactor - 1) * 0.4 + (rng() - 0.5) * 0.2);
    const shelterDemandIndex = clamp01(0.35 + floodFrequency * 0.5 + (rng() - 0.5) * 0.25);
    history.set(region.id, {
      regionId: region.id,
      floodFrequency,
      rainfallMeanMm,
      rainfallVolatility,
      drainageScore,
      shelterDemandIndex
    });
  }
  return history;
}

/**
 * Synthesizes realistic anomaly/pattern history for each region.
 * Some regions naturally experience more false alarms or last-minute diversions
 * due to topography, microclimates, or upstream conditions.
 */
export function synthesizeAnomalyHistory(environment: Environment, rng: RNG): Map<string, RegionAnomalyHistory> {
  const history = new Map<string, RegionAnomalyHistory>();
  for (const region of environment.regions) {
    // Base accuracy inversely related to volatility and positively to drainage
    const baseAccuracy = clamp01(0.65 + (region.localFactor - 1) * 0.15 + (rng() - 0.5) * 0.2);
    
    // False alarm rate: some regions have geography that leads to overprediction
    // Higher in regions with uncertain drainage or complex terrain
    const falseAlarmRate = clamp01(0.08 + (1 - baseAccuracy) * 0.3 + (rng() - 0.5) * 0.12);
    
    // Last-minute diversion: topographic steering, upstream dams, or natural channels
    // More common in certain regions (imagine a valley that naturally redirects flow)
    const topographicDiversionBias = rng() < 0.3 ? 0.15 : 0; // 30% of regions have high diversion
    const lastMinuteDiversionRate = clamp01(0.05 + topographicDiversionBias + (rng() - 0.5) * 0.08);
    
    // Historical accuracy: composite of successful predictions
    const historicalAccuracy = clamp01(baseAccuracy - falseAlarmRate * 0.3 - lastMinuteDiversionRate * 0.2);
    
    // Typical lead time: some regions have better early-warning infrastructure
    const leadTimeBias = region.severity === 'Extreme' ? 1800 : region.severity === 'Severe' ? 1200 : 600;
    const typicalLeadTimeSec = Math.max(300, leadTimeBias + (rng() - 0.5) * 900);
    
    // Under/over estimation rates
    const estimationError = clamp01(0.15 + (rng() - 0.5) * 0.1);
    const underestimationRate = clamp01(estimationError * (0.4 + rng() * 0.3));
    const overestimationRate = clamp01(estimationError * (0.6 - rng() * 0.3));
    
    // Accuracy trend: most regions stable, some improving or degrading
    const trendRoll = rng();
    let accuracyTrend = 1.0; // stable
    if (trendRoll < 0.15) accuracyTrend = 1.1 + rng() * 0.15; // improving
    else if (trendRoll > 0.85) accuracyTrend = 0.85 - rng() * 0.1; // degrading
    
    history.set(region.id, {
      regionId: region.id,
      falseAlarmRate,
      lastMinuteDiversionRate,
      historicalAccuracy,
      typicalLeadTimeSec,
      underestimationRate,
      overestimationRate,
      accuracyTrend
    });
  }
  return history;
}

export class PriorityForecastModel {
  private readonly weights: number[];
  private readonly g2: number[]; // Adagrad accumulators
  private readonly learningRate: number;
  private readonly regularization: number;
  private readonly decay: number; // forgetting for accumulators
  private readonly baseScoreNorm: number;
  private explorationEpsilon: number;
  private temperature: number; // probability calibration
  private rng: () => number;
  private readonly regionLookup: Map<string, Region>;
  private readonly weatherLookup: Map<string, RegionWeatherRecord>;
  private readonly anomalyLookup: Map<string, RegionAnomalyHistory>;
  private readonly hashBucketCount: number;

  constructor(
    environment: Environment,
    weatherHistory: Map<string, RegionWeatherRecord>,
    anomalyHistory: Map<string, RegionAnomalyHistory>,
    opts?: {
      learningRate?: number;
      regularization?: number;
      decay?: number;
      baseScoreNorm?: number;
      explorationEpsilon?: number;
      temperature?: number;
      hashBucketCount?: number;
      initialState?: PFState;
      rng?: RNG | (() => number);
    }
  ) {
    this.regionLookup = new Map(environment.regions.map((region) => [region.id, region] as const));
    this.weatherLookup = weatherHistory;
    this.anomalyLookup = anomalyHistory;
    this.hashBucketCount = Math.max(0, Math.floor(opts?.hashBucketCount ?? 32));
    const featureCount = 13 /* base */ + 7 /* anomaly */ + 3 /* time + updateNo */ + this.hashBucketCount; // keep in sync with deriveFeatures
    const init = opts?.initialState;
    this.weights = init?.weights?.length === featureCount ? [...init.weights] : new Array(featureCount).fill(0);
    this.g2 = init?.g2?.length === featureCount ? [...init.g2] : new Array(featureCount).fill(1e-6);
    this.learningRate = opts?.learningRate ?? (init?.learningRate ?? 0.05);
    this.regularization = opts?.regularization ?? (init?.regularization ?? 0.0005);
    this.decay = opts?.decay ?? (init?.decay ?? 0.99);
    this.baseScoreNorm = opts?.baseScoreNorm ?? 15;
    this.explorationEpsilon = clamp01(opts?.explorationEpsilon ?? 0);
    this.temperature = Math.max(1e-3, opts?.temperature ?? (init?.temperature ?? 1));
    this.rng = typeof opts?.rng === 'function' ? (opts!.rng as () => number) : opts?.rng ?? Math.random;
  }

  setExplorationEpsilon(epsilon: number) {
    this.explorationEpsilon = clamp01(epsilon);
  }

  setRng(fn: () => number) {
    this.rng = fn;
  }

  getState(): PFState {
    return {
      weights: [...this.weights],
      g2: [...this.g2],
      featureCount: this.weights.length,
      hashBucketCount: this.hashBucketCount,
      temperature: this.temperature,
      learningRate: this.learningRate,
      regularization: this.regularization,
      decay: this.decay
    };
  }

  ingestHistoricalSamples(samples: PFTrainingSample[]) {
    for (const sample of samples) {
      const features = this.buildFeaturesFromSample(sample);
      this.train(features, clamp01(sample.label));
    }
  }

  score(alert: Alert, ctx: ForecastScoreContext, opts?: { explore?: boolean }): ScoreDetail {
    const features = this.buildFeatures(alert, ctx);
    const probability = this.predict(features);
    let boost = ctx.baseScore * (probability - 0.5);
    let exploration = 0;
    if (opts?.explore && this.explorationEpsilon > 0 && this.rng() < this.explorationEpsilon) {
      exploration = (this.rng() - 0.5) * ctx.baseScore * 0.6;
      boost += exploration;
    }
    return {
      base: ctx.baseScore,
      boost,
      total: ctx.baseScore + boost,
      probability,
      exploration
    };
  }

  boost(alert: Alert, ctx: ForecastScoreContext): number {
    return this.score(alert, ctx).boost;
  }

  observeRetrieval(
    alert: Alert,
    outcome: { freshness: number; latencySec: number; servedAt: number; slaSec?: number }
  ) {
    const label = this.labelForOutcome(alert, outcome);
    const features = this.buildFeatures(alert, {
      now: outcome.servedAt,
      freshness: outcome.freshness,
      baseScore: this.baseScore(alert)
    });
    this.train(features, label);
  }

  observeDrop(alert: Alert, servedAt: number) {
    const features = this.buildFeatures(alert, {
      now: servedAt,
      freshness: 0,
      baseScore: this.baseScore(alert)
    });
    this.train(features, 0);
  }

  private baseScore(alert: Alert) {
    return this.baseScoreNorm * 0.6 + severityNumeric(alert.severity) * 3 + (alert.urgency === 'Immediate' ? 2 : 0);
  }

  private labelForOutcome(
    alert: Alert,
    outcome: { freshness: number; latencySec: number; slaSec?: number }
  ) {
    const severity = severityNumeric(alert.severity);
    const urgency = alert.urgency === 'Immediate' ? 1 : 0.4;
    const freshnessComponent = clamp01(outcome.freshness);
    const timeliness = outcome.slaSec
      ? clamp01(1 - outcome.latencySec / Math.max(outcome.slaSec * 1.5, 1))
      : 0.6;
    return clamp01(0.4 * severity + 0.2 * urgency + 0.25 * freshnessComponent + 0.15 * timeliness);
  }

  private buildFeatures(alert: Alert, ctx: ForecastScoreContext) {
    const regionId = alert.regionId ?? alert.geokey ?? '';
    const region = regionId ? this.regionLookup.get(regionId) : undefined;
    const weather = regionId ? this.weatherLookup.get(regionId) : undefined;
    const anomaly = regionId ? this.anomalyLookup.get(regionId) : undefined;
    return this.deriveFeatures({
      severity: severityNumeric(alert.severity),
      urgency: alert.urgency === 'Immediate' ? 1 : 0,
      ttl: clamp01(alert.ttlSec / 3600),
      freshness: clamp01(ctx.freshness),
      regionSeverity: region ? severityNumeric(region.severity) : 0.4,
      localReliability: region ? clamp01((region.localFactor - 0.7) / 0.6) : 0.5,
      floodFrequency: weather?.floodFrequency ?? 0.3,
      rainfallMean: weather ? clamp01(weather.rainfallMeanMm / 160) : 0.5,
      rainfallVolatility: weather?.rainfallVolatility ?? 0.4,
      drainageRisk: weather ? 1 - weather.drainageScore : 0.5,
      shelterDemand: weather?.shelterDemandIndex ?? 0.3,
      baseScoreNorm: clamp01(ctx.baseScore / this.baseScoreNorm),
      falseAlarmRate: anomaly?.falseAlarmRate ?? 0.1,
      diversionRate: anomaly?.lastMinuteDiversionRate ?? 0.05,
      historicalAccuracy: anomaly?.historicalAccuracy ?? 0.7,
      leadTimeNorm: anomaly ? clamp01(anomaly.typicalLeadTimeSec / 3600) : 0.3,
      underestimationRate: anomaly?.underestimationRate ?? 0.08,
      overestimationRate: anomaly?.overestimationRate ?? 0.12,
      accuracyTrend: anomaly ? clamp01((anomaly.accuracyTrend - 0.75) / 0.5) : 0.5,
      now: ctx.now,
      updateNo: alert.updateNo ?? 1,
      hashes: this.hashedFeatures([
        alert.eventType ?? 'Other',
        regionId,
        alert.threadKey ?? ''
      ])
    });
  }

  private buildFeaturesFromSample(sample: PFTrainingSample) {
    const baseScore = sample.baseScore ?? this.baseScoreFromSample(sample.alert);
    return this.deriveFeatures({
      severity: severityNumeric(sample.alert.severity),
      urgency: sample.alert.urgency === 'Immediate' ? 1 : 0,
      ttl: clamp01(sample.alert.ttlSec / 3600),
      freshness: clamp01(sample.freshness),
      regionSeverity: sample.alert.regionSeverity ? severityNumeric(sample.alert.regionSeverity) : 0.4,
      localReliability: sample.alert.localReliability ?? 0.5,
      floodFrequency: sample.alert.floodFrequency ?? 0.3,
      rainfallMean: sample.alert.rainfallMeanMm ? clamp01(sample.alert.rainfallMeanMm / 160) : 0.5,
      rainfallVolatility: sample.alert.rainfallVolatility ?? 0.4,
      drainageRisk: sample.alert.drainageScore != null ? 1 - sample.alert.drainageScore : 0.5,
      shelterDemand: sample.alert.shelterDemandIndex ?? 0.3,
      baseScoreNorm: clamp01(baseScore / this.baseScoreNorm),
      falseAlarmRate: sample.alert.falseAlarmRate ?? 0.1,
      diversionRate: sample.alert.lastMinuteDiversionRate ?? 0.05,
      historicalAccuracy: sample.alert.historicalAccuracy ?? 0.7,
      leadTimeNorm: sample.alert.typicalLeadTimeSec ? clamp01(sample.alert.typicalLeadTimeSec / 3600) : 0.3,
      underestimationRate: sample.alert.underestimationRate ?? 0.08,
      overestimationRate: sample.alert.overestimationRate ?? 0.12,
      accuracyTrend: sample.alert.accuracyTrend ? clamp01((sample.alert.accuracyTrend - 0.75) / 0.5) : 0.5,
      now: 0,
      updateNo: 1,
      hashes: this.hashedFeatures([
        'hist',
        sample.alert.regionId ?? sample.alert.geokey ?? '',
        sample.alert.geokey ?? ''
      ])
    });
  }

  private deriveFeatures(inputs: {
    severity: number;
    urgency: number;
    ttl: number;
    freshness: number;
    regionSeverity: number;
    localReliability: number;
    floodFrequency: number;
    rainfallMean: number;
    rainfallVolatility: number;
    drainageRisk: number;
    shelterDemand: number;
    baseScoreNorm: number;
    falseAlarmRate: number;
    diversionRate: number;
    historicalAccuracy: number;
    leadTimeNorm: number;
    underestimationRate: number;
    overestimationRate: number;
    accuracyTrend: number;
    now: number;
    updateNo: number;
    hashes: number[];
  }) {
    const tod = ((inputs.now % 86400) + 86400) % 86400;
    const phase = (2 * Math.PI * tod) / 86400;
    const timeSin = Math.sin(phase);
    const timeCos = Math.cos(phase);
    const updateNoNorm = clamp01(inputs.updateNo / 4);
    
    // Compute a composite alert reliability score from anomaly history
    // Higher when region has good accuracy, low false alarms, and low diversions
    const alertReliability = clamp01(
      inputs.historicalAccuracy * 0.5 +
      (1 - inputs.falseAlarmRate) * 0.25 +
      (1 - inputs.diversionRate) * 0.15 +
      inputs.accuracyTrend * 0.1
    );
    
    return [
      1, // bias
      inputs.severity,
      inputs.urgency,
      inputs.ttl,
      inputs.freshness,
      inputs.regionSeverity,
      inputs.localReliability,
      inputs.floodFrequency,
      inputs.rainfallMean,
      inputs.rainfallVolatility,
      inputs.drainageRisk,
      inputs.shelterDemand,
      inputs.baseScoreNorm,
      // Anomaly/pattern features
      inputs.falseAlarmRate,
      inputs.diversionRate,
      inputs.historicalAccuracy,
      inputs.leadTimeNorm,
      inputs.underestimationRate,
      inputs.overestimationRate,
      alertReliability, // composite feature
      // Temporal and update features
      timeSin,
      timeCos,
      updateNoNorm,
      ...inputs.hashes
    ];
  }

  private predict(features: number[]) {
    const z = this.weights.reduce((sum, w, idx) => sum + w * features[idx], 0);
    const scaled = z / this.temperature;
    return 1 / (1 + Math.exp(-scaled));
  }

  private train(features: number[], label: number) {
    const prediction = this.predict(features);
    const error = label - prediction;
    for (let i = 0; i < this.weights.length; i++) {
      const grad = error * features[i];
      this.g2[i] = this.decay * this.g2[i] + grad * grad;
      const step = this.learningRate / Math.sqrt(this.g2[i] + 1e-6);
      this.weights[i] = (1 - this.regularization) * this.weights[i] + step * grad;
    }
  }

  private hashedFeatures(items: string[]): number[] {
    const count = this.hashBucketCount;
    const buckets = new Array(count).fill(0);
    if (count <= 0) return buckets;
    const n = Math.max(1, items.length);
    for (const s of items) {
      if (!s) continue;
      const idx = hashString(s) % count;
      buckets[idx] += 1 / n;
    }
    return buckets;
  }

  private baseScoreFromSample(alert: PFTrainingSample['alert']) {
    return this.baseScoreNorm * 0.6 + severityNumeric(alert.severity) * 3 + (alert.urgency === 'Immediate' ? 2 : 0);
  }
}

// Simple string hash (xorshift-ish), deterministic across sessions
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}


function severityNumeric(value: Region['severity'] | Alert['severity']) {
  if (value === 'Extreme') return 1;
  if (value === 'Severe') return 0.75;
  if (value === 'Moderate') return 0.45;
  if (value === 'Minor') return 0.25;
  return 0.4; // Unknown/others default mid-low
}

function clamp(min: number, max: number, value: number) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return clamp(0, 1, value);
}
