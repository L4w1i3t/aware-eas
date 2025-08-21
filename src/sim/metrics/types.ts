export interface Metrics {
  coverageIn: number; overshoot: number; missRate: number;
  latencyP50: number; latencyP95: number;
  hitRate: number; freshnessMean: number; staleRate: number;
  bytesPerDevice: number;
}

export interface DeviceSample {
  inside: boolean; receivedAt?: number; latency?: number; bytes: number;
  hits: number; reads: number; freshnessAtRead: number[];
}
