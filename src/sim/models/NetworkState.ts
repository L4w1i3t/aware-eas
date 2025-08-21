export enum NetworkState {
  STABLE = 'stable',
  CONGESTED = 'congested', 
  PARTIAL_OUTAGE = 'partial-outage',
  DISCONNECTED = 'disconnected'
}

export interface NetworkConditions {
  latencyMs: number;
  packetLossRate: number; // 0-1
  bandwidthKbps: number;
  jitterMs: number;
}

export const NETWORK_CONDITIONS: Record<NetworkState, NetworkConditions> = {
  [NetworkState.STABLE]: {
    latencyMs: 50,
    packetLossRate: 0.01,
    bandwidthKbps: 1000,
    jitterMs: 5
  },
  [NetworkState.CONGESTED]: {
    latencyMs: 200,
    packetLossRate: 0.05,
    bandwidthKbps: 100,
    jitterMs: 50
  },
  [NetworkState.PARTIAL_OUTAGE]: {
    latencyMs: 500,
    packetLossRate: 0.15,
    bandwidthKbps: 50,
    jitterMs: 100
  },
  [NetworkState.DISCONNECTED]: {
    latencyMs: Infinity,
    packetLossRate: 1.0,
    bandwidthKbps: 0,
    jitterMs: 0
  }
};
