export type Severity = 'Minor' | 'Moderate' | 'Severe' | 'Extreme' | 'Unknown';
export type Urgency = 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';

export type Alert = {
  id: string;
  eventType: string; // e.g., Flood, Shelter
  severity: Severity;
  urgency: Urgency;
  issuedAt: number; // seconds
  ttlSec: number; // seconds
  // CAP-like extras (simplified)
  sender?: string;
  headline?: string;
  instruction?: string;
  geokey?: string; // coarse spatial key
  regionId?: string; // generated region identifier
  sizeBytes?: number;
  threadKey?: string; // dedup group key
  updateNo?: number; // monotonic update number within thread
};

export type Sample = {
  t: number; // seconds
  cacheSize: number;
  hits: number; // cumulative
  misses: number; // cumulative
};

export type Metrics = {
  cacheHitRate: number;
  deliveryRate: number;
  avgFreshness: number; // [0, 1]
  staleAccessRate: number;
  redundancyIndex: number; // duplicates / delivered
  actionabilityFirstRatio: number; // actionable first retrievals / threads
  timelinessConsistency: number; // fraction of first retrievals within target SLA window
  // Push-notification–specific metrics
  pushesSent: number; // count of pushes issued
  pushSuppressRate: number; // suppressed / delivered arrivals
  pushDuplicateRate: number; // pushes that were repeats in the same thread (beyond dedup window) / pushesSent
  pushTimelyFirstRatio: number; // fraction of threads whose first push met SLA
};
