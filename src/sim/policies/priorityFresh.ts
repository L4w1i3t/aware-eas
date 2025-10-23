// Layman's terms for this policy:
// Keep the cache full of the highest priority (severity, urgency, freshness) alerts.
// Optionally integrates with the PF model to inject environment- and history-aware boosts.
// When adding a new alert to a full cache, evict the lowest priority alert.

import type { Alert } from '../types';
import { CachePolicy, isExpired } from './base';
import type { ForecastScoreContext, PriorityForecastModel } from '../learning/pfModel';

// Weights for severity, urgency, freshness
type Weights = { wS: number; wU: number; wF: number };

// Keep the cache full of the highest priority (severity, urgency, freshness) alerts.
// Optionally integrates with the PF model to inject environment- and history-aware boosts.
export class PriorityFresh implements CachePolicy {
  readonly name = 'PriorityFresh';
  private cap: number;
  private map = new Map<string, Alert>();
  private w: Weights;
  private lambda = 1 / 600; // freshness half-life-ish
  private predictor?: PriorityForecastModel;

  constructor(capacity: number, weights?: Partial<Weights>, predictor?: PriorityForecastModel) {
    this.cap = capacity;
    // Default: urgency takes precedence over severity; freshness remains influential
    this.w = { wS: 2, wU: 3, wF: 4, ...weights };
    this.predictor = predictor;
  }

  setPredictor(predictor?: PriorityForecastModel) {
    this.predictor = predictor;
  }

  // Remove expired alerts from the cache
  private purgeExpired(now: number) {
    for (const id of [...this.map.keys()]) {
      const a = this.map.get(id)!;
      if (isExpired(a, now)) this.map.delete(id);
    }
  }
  // Add a new alert to the cache
  put(a: Alert, now: number): void {
    this.purgeExpired(now);
    if (this.map.size < this.cap) {
      this.map.set(a.id, a);
      return;
    }
    // If full, evict lowest score
    let worstId: string | null = null;
    let worstScore = Infinity;
    for (const [id, item] of this.map) {
      const s = this.score(item, now);
      if (s < worstScore) {
        worstScore = s;
        worstId = id;
      }
    }
    if (worstId) this.map.delete(worstId);
    this.map.set(a.id, a);
  }
  // Retrieve an alert from the cache
  get(id: string, now: number): Alert | undefined {
    this.purgeExpired(now);
    return this.map.get(id);
  }
  // Check if an alert is in the cache
  has(id: string, now: number): boolean {
    return !!this.get(id, now);
  }

  // Current number of alerts in the cache
  size(): number {
    return this.map.size;
  }
  // Get all current alerts in the cache
  entries(now: number): Alert[] {
    this.purgeExpired(now);
    return [...this.map.values()];
  }
  // Scoring functions
  private sevWeight(s: Alert['severity']) {
    if (s === 'Extreme') return 4;
    if (s === 'Severe') return 3;
    if (s === 'Moderate') return 2;
    if (s === 'Minor') return 1;
    return 2; // Unknown
  }
  private urgWeight(u: Alert['urgency']) {
    if (u === 'Immediate') return 3;
    if (u === 'Expected') return 2;
    if (u === 'Future') return 1.5;
    if (u === 'Past') return 0.5;
    return 1.5; // Unknown
  }
  private freshness(a: Alert, now: number) {
    const age = Math.max(0, now - a.issuedAt);
    const f = Math.exp(-this.lambda * age);
    return f; // 1 fresh, 0 stale
  }
  private score(a: Alert, now: number) {
    // Higher is better; eviction chooses lowest
    const sev = this.sevWeight(a.severity);
    const urg = this.urgWeight(a.urgency);
    const fresh = this.freshness(a, now);
    const base = this.w.wS * sev + this.w.wU * urg + this.w.wF * fresh;
    if (!this.predictor) return base;
    const context: ForecastScoreContext = { now, freshness: fresh, baseScore: base };
    const detail = this.predictor.score(a, context, { explore: true });
    return detail.total;
  }
}



