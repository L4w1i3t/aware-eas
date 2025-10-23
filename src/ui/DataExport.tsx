import { useMemo } from 'react';
import type { RunResult } from '../sim/run';
import type { PolicyComparisonResult, DeviceComparisonResult, NetworkComparisonResult, CombinedComparisonResult } from '../sim/multiPolicyBatch';
import type { RandomizedMultiPolicyResult } from '../sim/randomizedBatch';
import { exportRandomizedMultiPolicyCSV } from '../sim/randomizedBatch';
import { exportMultiPolicyCSV, exportMultiPolicyTimelineCSV, exportDeviceComparisonCSV, exportNetworkComparisonCSV, exportCombinedComparisonCSV } from '../sim/multiPolicyBatch';

type Props = {
  result: RunResult | PolicyComparisonResult | DeviceComparisonResult | NetworkComparisonResult | CombinedComparisonResult | RandomizedMultiPolicyResult | null;
};

function isMultiPolicyResult(result: RunResult | PolicyComparisonResult | DeviceComparisonResult | NetworkComparisonResult | CombinedComparisonResult | RandomizedMultiPolicyResult): result is PolicyComparisonResult {
  return 'kind' in result && result.kind === 'multi-policy';
}

function isDeviceComparisonResult(result: RunResult | PolicyComparisonResult | DeviceComparisonResult | NetworkComparisonResult | CombinedComparisonResult | RandomizedMultiPolicyResult): result is DeviceComparisonResult {
  return 'kind' in result && result.kind === 'device-comparison';
}

function isNetworkComparisonResult(result: RunResult | PolicyComparisonResult | DeviceComparisonResult | NetworkComparisonResult | CombinedComparisonResult | RandomizedMultiPolicyResult): result is NetworkComparisonResult {
  return 'kind' in result && result.kind === 'network-comparison';
}

function isCombinedComparisonResult(result: RunResult | PolicyComparisonResult | DeviceComparisonResult | NetworkComparisonResult | CombinedComparisonResult | RandomizedMultiPolicyResult): result is CombinedComparisonResult {
  return 'kind' in result && result.kind === 'combined-comparison';
}

function isRandomizedMultiPolicyResult(result: RunResult | PolicyComparisonResult | DeviceComparisonResult | NetworkComparisonResult | CombinedComparisonResult | RandomizedMultiPolicyResult): result is RandomizedMultiPolicyResult {
  return 'kind' in result && result.kind === 'randomized-multi-policy';
}

export default function DataExport({ result }: Props) {
  if (!result) {
    return null;
  }

  const isMultiPolicy = isMultiPolicyResult(result);
  const isDeviceComparison = isDeviceComparisonResult(result);
  const isNetworkComparison = isNetworkComparisonResult(result);
  const isCombinedComparison = isCombinedComparisonResult(result);
      const isRandomized = isRandomizedMultiPolicyResult(result); 
      
      const randomizedSummary = isRandomized ? (
        <>
          <div>Randomized runs: {result.count}</div>
          <div>Total policy runs: {result.count * 4}</div>
          <div>Timestamp: {new Date(result.timestamp).toLocaleString()}</div>
        </>
      ) : null;

  const csvData = useMemo(() => {
    if (isRandomized) {
      return exportRandomizedMultiPolicyCSV(result);
    }

    if (isCombinedComparison) {
      return exportCombinedComparisonCSV(result);
    }
    
    if (isNetworkComparison) {
      return exportNetworkComparisonCSV(result);
    }
    
    if (isDeviceComparison) {
      return exportDeviceComparisonCSV(result);
    }
    
    if (isMultiPolicy) {
      return exportMultiPolicyCSV(result);
    }

    // Export detailed timeline for single result
    const rows: string[] = [];
    rows.push('time,cacheSize,hits,misses,hitRate');
    
    for (const sample of result.timeline) {
      const hitRate = sample.hits + sample.misses > 0 ? sample.hits / (sample.hits + sample.misses) : 0;
      rows.push([
        sample.t.toFixed(2),
        sample.cacheSize.toString(),
        sample.hits.toString(),
        sample.misses.toString(),
        hitRate.toFixed(4),
      ].join(','));
    }
    
    return rows.join('\n');
  }, [result, isMultiPolicy, isDeviceComparison, isNetworkComparison]);

  const timelineCSV = useMemo(() => {
    if (!isMultiPolicy) return null;
    return exportMultiPolicyTimelineCSV(result);
  }, [result, isMultiPolicy]);

  const jsonData = useMemo(() => {
    if (isRandomized) {
      return JSON.stringify({
        type: 'randomized-multi-policy',
        timestamp: result.timestamp,
        count: result.count,
        runs: result.runs.map((r, idx) => ({
          index: idx + 1,
          options: {
            scenario: r.options.scenario,
            cacheSize: r.options.cacheSize,
            alerts: r.options.alerts,
            reliability: r.options.reliability,
            durationSec: r.options.durationSec,
            queryRatePerMin: r.options.queryRatePerMin,
            wS: r.options.wS, wU: r.options.wU, wF: r.options.wF,
            pushRateLimitPerMin: r.options.pushRateLimitPerMin,
            pushDedupWindowSec: r.options.pushDedupWindowSec,
            pushThreshold: r.options.pushThreshold,
            pfExplorationEpsilon: r.options.pfExplorationEpsilon,
            pfHashBuckets: r.options.pfHashBuckets,
            pfTemperature: r.options.pfTemperature,
            pfDecay: r.options.pfDecay,
            pfLearningRate: r.options.pfLearningRate,
            pfRegularization: r.options.pfRegularization
          },
          policies: r.comparison.runs.map(({ policy, result: run }) => ({ policy, metrics: run.metrics }))
        }))
      }, null, 2);
    }

    if (isCombinedComparison) {
      return JSON.stringify({
        type: 'combined-comparison',
        baseSeed: result.baseSeed,
        timestamp: result.timestamp,
        scenario: result.scenario,
        comparisons: result.comparisons.map(({ deviceProfile, networkProfile, policyComparison }) => ({
          device: deviceProfile.name,
          cacheSize: deviceProfile.cacheSize,
          network: networkProfile.name,
          reliability: networkProfile.reliability,
          policies: policyComparison.runs.map(({ policy, result: run }) => ({
            policy,
            metrics: run.metrics,
          })),
        })),
      }, null, 2);
    }
    
    if (isNetworkComparison) {
      return JSON.stringify({
        type: 'network-comparison',
        baseSeed: result.baseSeed,
        timestamp: result.timestamp,
        scenario: result.scenario,
        comparisons: result.comparisons.map(({ networkProfile, policyComparison }) => ({
          network: networkProfile.name,
          reliability: networkProfile.reliability,
          policies: policyComparison.runs.map(({ policy, result: run }) => ({
            policy,
            metrics: run.metrics,
          })),
        })),
      }, null, 2);
    }
    
    if (isDeviceComparison) {
      return JSON.stringify({
        type: 'device-comparison',
        baseSeed: result.baseSeed,
        timestamp: result.timestamp,
        scenario: result.scenario,
        comparisons: result.comparisons.map(({ deviceProfile, policyComparison }) => ({
          device: deviceProfile.name,
          cacheSize: deviceProfile.cacheSize,
          policies: policyComparison.runs.map(({ policy, result: run }) => ({
            policy,
            metrics: run.metrics,
          })),
        })),
      }, null, 2);
    }
    
    if (isMultiPolicy) {
      return JSON.stringify({
        type: 'multi-policy',
        baseSeed: result.baseSeed,
        timestamp: result.timestamp,
        runs: result.runs.map(({ policy, result: run }) => ({
          policy,
          scenario: run.scenario,
          seed: run.seed,
          metrics: run.metrics,
          regionStats: run.regionStats,
        })),
      }, null, 2);
    }

    return JSON.stringify({
      type: 'single',
      scenario: result.scenario,
      baselineReliability: result.baselineReliability,
      seed: result.seed,
      metrics: result.metrics,
      regionStats: result.regionStats,
      timeline: result.timeline,
      issuedAlerts: result.issuedAlerts.map(a => ({
        id: a.id,
        regionId: a.regionId ?? a.geokey,
        severity: a.severity,
        urgency: a.urgency,
        issuedAt: a.issuedAt,
        ttlSec: a.ttlSec,
        eventType: a.eventType,
      })),
      environment: {
        regions: result.environment.regions.map(r => ({
          id: r.id,
          severity: r.severity,
          localFactor: r.localFactor,
        })),
      },
      pfState: result.pfState,
    }, null, 2);
  }, [result, isMultiPolicy, isDeviceComparison, isNetworkComparison, isCombinedComparison]);

  const downloadCSV = () => {
    if (!csvData) return;
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = isRandomized
      ? `randomized-comparison-${Date.now()}.csv`
      : isCombinedComparison
      ? `combined-comparison-${Date.now()}.csv`
      : isNetworkComparison
      ? `network-comparison-${Date.now()}.csv`
      : isDeviceComparison 
      ? `device-comparison-${Date.now()}.csv`
      : isMultiPolicy 
      ? `multi-policy-comparison-${Date.now()}.csv` 
      : `simulation-data-${Date.now()}.csv`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTimelineCSV = () => {
    if (!timelineCSV) return;
    const blob = new Blob([timelineCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi-policy-timeline-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    if (!jsonData) return;
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (data: string) => {
    try {
      await navigator.clipboard.writeText(data);
      alert('Data copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  if (!result) {
    return null;
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h4>Export Data for Figures</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        {isMultiPolicy 
          ? 'Download policy comparison metrics and timelines for paper figures'
          : 'Download detailed timeline and metrics for paper figures'
        }
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={downloadCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isMultiPolicy ? 'Download Metrics CSV' : 'Download CSV'}
        </button>
        {isMultiPolicy && (
          <button onClick={downloadTimelineCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Download Timeline CSV
          </button>
        )}
        <button onClick={downloadJSON} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Download JSON
        </button>
        <button onClick={() => csvData && copyToClipboard(csvData)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Copy CSV
        </button>
        <button onClick={() => jsonData && copyToClipboard(jsonData)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Copy JSON
        </button>
      </div>

      {/* Preview */}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: '#94a3b8' }}>
          Show data preview
        </summary>
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>CSV Preview:</strong>
            <pre style={{ 
              fontSize: 10, 
              background: '#0b132b', 
              padding: 8, 
              borderRadius: 4, 
              maxHeight: 200, 
              overflow: 'auto',
              border: '1px solid #2a3b63',
            }}>
              {csvData?.split('\n').slice(0, 10).join('\n')}
              {csvData && csvData.split('\n').length > 10 && '\n...'}
            </pre>
          </div>
          <div>
            <strong>JSON Preview:</strong>
            <pre style={{ 
              fontSize: 10, 
              background: '#0b132b', 
              padding: 8, 
              borderRadius: 4, 
              maxHeight: 200, 
              overflow: 'auto',
              border: '1px solid #2a3b63',
            }}>
              {jsonData?.split('\n').slice(0, 20).join('\n')}
              {jsonData && jsonData.split('\n').length > 20 && '\n...'}
            </pre>
          </div>
        </div>
      </details>

      {/* Data summary */}
      <div style={{ marginTop: 12, fontSize: 12 }}>
        <div className="muted">
          {isCombinedComparison ? (
            <>
              <div>Device × Network combinations: {result.comparisons.length}</div>
              <div>Total policy runs: {result.comparisons.length * (result.comparisons[0]?.policyComparison.runs.length ?? 4)}</div>
              <div>Base seed: {result.baseSeed}</div>
              <div>Scenario: {result.scenario}</div>
            </>
          ) : isNetworkComparison ? (
            <>
              <div>Network conditions compared: {result.comparisons.length}</div>
              <div>Total policy runs: {result.comparisons.length * (result.comparisons[0]?.policyComparison.runs.length ?? 4)}</div>
              <div>Base seed: {result.baseSeed}</div>
            </>
          ) : isDeviceComparison ? (
            <>
              <div>Devices compared: {result.comparisons.length}</div>
              <div>Total policy runs: {result.comparisons.length * (result.comparisons[0]?.policyComparison.runs.length ?? 4)}</div>
              <div>Base seed: {result.baseSeed}</div>
            </>
          ) : isMultiPolicy ? (
            <>
              <div>Policies compared: {result.runs.length}</div>
              <div>Base seed: {result.baseSeed}</div>
            </>
            ) : isRandomized ? (
              randomizedSummary
          ) : (
            <>
              <div>Timeline samples: {result.timeline.length}</div>
              <div>Alerts issued: {result.issuedAlerts.length}</div>
              <div>Regions: {result.environment.regions.length}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
