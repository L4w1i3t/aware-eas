import { runSimulation, type RunOptions, type RunResult } from './run';

export type PolicyName = 'LRU' | 'TTLOnly' | 'PriorityFresh' | 'PAFTinyLFU';

export type PolicyComparisonResult = {
  kind: 'multi-policy';
  baseSeed: string;
  timestamp: number;
  cacheSize: number;
  scenario: string;
  reliability: number;
  durationSec: number;
  queryRatePerMin: number;
  runs: Array<{
    policy: PolicyName;
    result: RunResult;
  }>;
  info: string;
};

export type DeviceProfile = {
  name: string;
  cacheSize: number;
  description: string;
};

export const DEVICE_PROFILES: DeviceProfile[] = [
  { name: 'Budget Phone', cacheSize: 32, description: 'Low-end smartphone (limited memory)' },
  { name: 'Standard Phone', cacheSize: 128, description: 'Modern mid-range smartphone' },
  { name: 'High-End Phone', cacheSize: 256, description: 'Flagship smartphone' },
  { name: 'Tablet/Laptop', cacheSize: 512, description: 'Tablet or laptop device' },
  { name: 'Desktop PC', cacheSize: 1024, description: 'Desktop computer' }
];

export type NetworkProfile = {
  name: string;
  reliability: number;
  description: string;
};

export const NETWORK_PROFILES: NetworkProfile[] = [
  { name: 'Perfect', reliability: 1.0, description: 'Perfect connectivity (100%)' },
  { name: 'Excellent', reliability: 0.95, description: 'Excellent network (95%)' },
  { name: 'Good', reliability: 0.9, description: 'Good network (90%)' },
  { name: 'Fair', reliability: 0.85, description: 'Fair network (85%)' },
  { name: 'Poor', reliability: 0.7, description: 'Poor network (70%)' },
  { name: 'Very Poor', reliability: 0.6, description: 'Very poor network (60%)' },
  { name: 'Degraded', reliability: 0.5, description: 'Degraded network (50%)' },
  { name: 'Disaster', reliability: 0.3, description: 'Disaster scenario (30%)' }
];

export type DeviceComparisonResult = {
  kind: 'device-comparison';
  baseSeed: string;
  timestamp: number;
  scenario: string;
  reliability: number;
  durationSec: number;
  queryRatePerMin: number;
  comparisons: Array<{
    deviceProfile: DeviceProfile;
    policyComparison: PolicyComparisonResult;
  }>;
  info: string;
};

export type NetworkComparisonResult = {
  kind: 'network-comparison';
  baseSeed: string;
  timestamp: number;
  scenario: string;
  cacheSize: number;
  durationSec: number;
  queryRatePerMin: number;
  comparisons: Array<{
    networkProfile: NetworkProfile;
    policyComparison: PolicyComparisonResult;
  }>;
  info: string;
};

export type CombinedComparisonResult = {
  kind: 'combined-comparison';
  baseSeed: string;
  timestamp: number;
  scenario: string;
  durationSec: number;
  queryRatePerMin: number;
  comparisons: Array<{
    deviceProfile: DeviceProfile;
    networkProfile: NetworkProfile;
    policyComparison: PolicyComparisonResult;
  }>;
  info: string;
};

/**
 * Run all policies with the same conditions (seed, cache size, etc.)
 * This allows direct comparison of policies under identical circumstances
 */
export function runMultiPolicyBatch(baseOptions: RunOptions): PolicyComparisonResult {
  const policies: PolicyName[] = ['LRU', 'TTLOnly', 'PriorityFresh', 'PAFTinyLFU'];
  const runs: Array<{ policy: PolicyName; result: RunResult }> = [];
  const baseSeed = baseOptions.seed;

  for (const policy of policies) {
    const opts: RunOptions = {
      ...baseOptions,
      policy,
      // Reset replicates to 1 for this comparison
      replicates: 1,
      seedMode: 'Fixed'
    };
    
    const result = runSimulation(opts);
    runs.push({ policy, result });
  }

  const timestamp = Date.now();
  return {
    kind: 'multi-policy',
    baseSeed,
    timestamp,
    cacheSize: baseOptions.cacheSize,
    scenario: baseOptions.scenario,
    reliability: baseOptions.reliability,
    durationSec: baseOptions.durationSec,
    queryRatePerMin: baseOptions.queryRatePerMin,
    runs,
    info: `Compared ${policies.length} policies with seed "${baseSeed}" | cache=${baseOptions.cacheSize} | alerts=${baseOptions.alerts}`
  };
}

/**
 * Export multi-policy comparison results as CSV
 */
export function exportMultiPolicyCSV(comparison: PolicyComparisonResult): string {
  const rows: string[] = [];
  
  // Header
  rows.push('policy,seed,scenario,cacheSize,alerts,reliability,durationSec,queryRatePerMin,cacheHitRate,deliveryRate,avgFreshness,staleAccessRate,redundancyIndex,actionabilityFirstRatio,timelinessConsistency,pushesSent,pushSuppressRate,pushDuplicateRate,pushTimelyFirstRatio');
  
  // Data rows - one per policy
  for (const { policy, result } of comparison.runs) {
    const m = result.metrics;
    rows.push([
      policy,
      result.seed,
      result.scenario,
      comparison.cacheSize.toString(),
      result.issuedAlerts.length.toString(),
      comparison.reliability.toFixed(3),
      comparison.durationSec.toString(),
      comparison.queryRatePerMin.toString(),
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
  }
  
  return rows.join('\n');
}

/**
 * Export detailed timeline data for all policies
 */
export function exportMultiPolicyTimelineCSV(comparison: PolicyComparisonResult): string {
  const rows: string[] = [];
  rows.push('policy,time,cacheSize,hits,misses,hitRate');
  
  for (const { policy, result } of comparison.runs) {
    for (const sample of result.timeline) {
      const hitRate = sample.hits + sample.misses > 0 ? sample.hits / (sample.hits + sample.misses) : 0;
      rows.push([
        policy,
        sample.t.toFixed(2),
        sample.cacheSize.toString(),
        sample.hits.toString(),
        sample.misses.toString(),
        hitRate.toFixed(6)
      ].join(','));
    }
  }
  
  return rows.join('\n');
}

/**
 * Run device profile comparison: test all policies across multiple device types
 * This simulates "neighbors with different devices" scenario
 */
export function runDeviceComparison(
  baseOptions: RunOptions,
  deviceProfiles: DeviceProfile[] = DEVICE_PROFILES
): DeviceComparisonResult {
  const comparisons: DeviceComparisonResult['comparisons'] = [];
  
  for (const profile of deviceProfiles) {
    const opts: RunOptions = {
      ...baseOptions,
      cacheSize: profile.cacheSize
    };
    
    const policyComparison = runMultiPolicyBatch(opts);
    comparisons.push({ deviceProfile: profile, policyComparison });
  }
  
  return {
    kind: 'device-comparison',
    baseSeed: baseOptions.seed,
    timestamp: Date.now(),
    scenario: baseOptions.scenario,
    reliability: baseOptions.reliability,
    durationSec: baseOptions.durationSec,
    queryRatePerMin: baseOptions.queryRatePerMin,
    comparisons,
    info: `Compared ${deviceProfiles.length} device profiles with ${comparisons[0]?.policyComparison.runs.length ?? 4} policies each`
  };
}

/**
 * Export device comparison as CSV (metrics across all policies and devices)
 */
export function exportDeviceComparisonCSV(comparison: DeviceComparisonResult): string {
  const rows: string[] = [];
  
  // Header
  rows.push('device,policy,seed,scenario,cacheSize,alerts,reliability,durationSec,queryRatePerMin,cacheHitRate,deliveryRate,avgFreshness,staleAccessRate,redundancyIndex,actionabilityFirstRatio,timelinessConsistency,pushesSent,pushSuppressRate,pushDuplicateRate,pushTimelyFirstRatio');
  
  // Data rows
  for (const { deviceProfile, policyComparison } of comparison.comparisons) {
    for (const { policy, result } of policyComparison.runs) {
      const m = result.metrics;
      rows.push([
        deviceProfile.name,
        policy,
        result.seed,
        result.scenario,
        deviceProfile.cacheSize.toString(),
        result.issuedAlerts.length.toString(),
        comparison.reliability.toFixed(3),
        comparison.durationSec.toString(),
        comparison.queryRatePerMin.toString(),
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
    }
  }
  
  return rows.join('\n');
}

/**
 * Run network comparison: test all policies across multiple network reliability levels
 * This simulates "same location, different network conditions" scenario
 */
export function runNetworkComparison(
  baseOptions: RunOptions,
  networkProfiles: NetworkProfile[] = NETWORK_PROFILES
): NetworkComparisonResult {
  const comparisons: NetworkComparisonResult['comparisons'] = [];
  
  for (const profile of networkProfiles) {
    const opts: RunOptions = {
      ...baseOptions,
      reliability: profile.reliability
    };
    
    const policyComparison = runMultiPolicyBatch(opts);
    comparisons.push({ networkProfile: profile, policyComparison });
  }
  
  return {
    kind: 'network-comparison',
    baseSeed: baseOptions.seed,
    timestamp: Date.now(),
    scenario: baseOptions.scenario,
    cacheSize: baseOptions.cacheSize,
    durationSec: baseOptions.durationSec,
    queryRatePerMin: baseOptions.queryRatePerMin,
    comparisons,
    info: `Compared ${networkProfiles.length} network conditions with ${comparisons[0]?.policyComparison.runs.length ?? 4} policies each`
  };
}

/**
 * Export network comparison as CSV (metrics across all policies and network conditions)
 */
export function exportNetworkComparisonCSV(comparison: NetworkComparisonResult): string {
  const rows: string[] = [];
  
  // Header
  rows.push('network,policy,seed,scenario,cacheSize,alerts,reliability,durationSec,queryRatePerMin,cacheHitRate,deliveryRate,avgFreshness,staleAccessRate,redundancyIndex,actionabilityFirstRatio,timelinessConsistency,pushesSent,pushSuppressRate,pushDuplicateRate,pushTimelyFirstRatio');
  
  // Data rows
  for (const { networkProfile, policyComparison } of comparison.comparisons) {
    for (const { policy, result } of policyComparison.runs) {
      const m = result.metrics;
      rows.push([
        networkProfile.name,
        policy,
        result.seed,
        result.scenario,
        comparison.cacheSize.toString(),
        result.issuedAlerts.length.toString(),
        networkProfile.reliability.toFixed(3),
        comparison.durationSec.toString(),
        comparison.queryRatePerMin.toString(),
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
    }
  }
  
  return rows.join('\n');
}

/**
 * Run combined device × network comparison: test all policies across BOTH device types AND network conditions
 * This simulates "neighbors with different devices AND different network speeds" scenario
 * Tests the full solution space: every (device, network) combination
 */
export function runCombinedComparison(
  baseOptions: RunOptions,
  deviceProfiles: DeviceProfile[] = DEVICE_PROFILES,
  networkProfiles: NetworkProfile[] = NETWORK_PROFILES
): CombinedComparisonResult {
  const comparisons: CombinedComparisonResult['comparisons'] = [];
  
  // Iterate through all device × network combinations
  for (const deviceProfile of deviceProfiles) {
    for (const networkProfile of networkProfiles) {
      const opts: RunOptions = {
        ...baseOptions,
        cacheSize: deviceProfile.cacheSize,
        reliability: networkProfile.reliability
      };
      
      const policyComparison = runMultiPolicyBatch(opts);
      comparisons.push({ deviceProfile, networkProfile, policyComparison });
    }
  }
  
  return {
    kind: 'combined-comparison',
    baseSeed: baseOptions.seed,
    timestamp: Date.now(),
    scenario: baseOptions.scenario,
    durationSec: baseOptions.durationSec,
    queryRatePerMin: baseOptions.queryRatePerMin,
    comparisons,
    info: `Compared ${deviceProfiles.length} devices × ${networkProfiles.length} networks = ${comparisons.length} scenarios with ${comparisons[0]?.policyComparison.runs.length ?? 4} policies each (${comparisons.length * 4} total runs)`
  };
}

/**
 * Export combined comparison as CSV (metrics across all policies, devices, and network conditions)
 */
export function exportCombinedComparisonCSV(comparison: CombinedComparisonResult): string {
  const rows: string[] = [];
  
  // Header
  rows.push('device,network,policy,seed,scenario,cacheSize,alerts,reliability,durationSec,queryRatePerMin,cacheHitRate,deliveryRate,avgFreshness,staleAccessRate,redundancyIndex,actionabilityFirstRatio,timelinessConsistency,pushesSent,pushSuppressRate,pushDuplicateRate,pushTimelyFirstRatio');
  
  // Data rows
  for (const { deviceProfile, networkProfile, policyComparison } of comparison.comparisons) {
    for (const { policy, result } of policyComparison.runs) {
      const m = result.metrics;
      rows.push([
        deviceProfile.name,
        networkProfile.name,
        policy,
        result.seed,
        result.scenario,
        deviceProfile.cacheSize.toString(),
        result.issuedAlerts.length.toString(),
        networkProfile.reliability.toFixed(3),
        comparison.durationSec.toString(),
        comparison.queryRatePerMin.toString(),
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
    }
  }
  
  return rows.join('\n');
}

