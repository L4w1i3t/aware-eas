import React, { useMemo } from 'react';
import type { RunResult } from '../sim/run';
import type { BatchRunResult } from '../sim/batch';
import type { PolicyComparisonResult, DeviceComparisonResult, NetworkComparisonResult, CombinedComparisonResult } from '../sim/multiPolicyBatch';
import type { RandomizedMultiPolicyResult } from '../sim/randomizedBatch';
import { useSimulationContext } from '../state/SimulationContext';
import PFInspector from './PFInspector';
import AlertTimeline from './AlertTimeline';
import DataExport from './DataExport';
import PolicyDiagnostics from './PolicyDiagnostics';

const TimeChart = React.lazy(() => import('./charts/TimeChart'));

type SingleRunView = {
  kind: 'single';
  result: RunResult;
};

type SimulationView = SingleRunView | BatchRunResult | PolicyComparisonResult | DeviceComparisonResult | NetworkComparisonResult | CombinedComparisonResult | RandomizedMultiPolicyResult;

type Props = {
  result: SimulationView | null;
  onShowEnvironment?: (run: RunResult) => void;
};

const metricDefs = [
  { key: 'cacheHitRate' as const, label: 'Cache Hit Rate', format: 'percent' as const },
  { key: 'deliveryRate' as const, label: 'Delivery Rate', format: 'percent' as const },
  { key: 'avgFreshness' as const, label: 'Avg Freshness', format: 'number' as const },
  { key: 'staleAccessRate' as const, label: 'Stale Access Rate', format: 'percent' as const },
  { key: 'redundancyIndex' as const, label: 'Redundancy Index', format: 'percent' as const },
  { key: 'actionabilityFirstRatio' as const, label: 'Actionability-First', format: 'percent' as const },
  { key: 'timelinessConsistency' as const, label: 'Timeliness Consistency', format: 'percent' as const },
  { key: 'pushesSent' as const, label: 'Pushes Sent', format: 'number' as const },
  { key: 'pushSuppressRate' as const, label: 'Push Suppress Rate', format: 'percent' as const },
  { key: 'pushDuplicateRate' as const, label: 'Push Duplicate Rate', format: 'percent' as const },
  { key: 'pushTimelyFirstRatio' as const, label: 'Push Timely First', format: 'percent' as const }
];

export default function Results({ result, onShowEnvironment }: Props) {
  const { snapshot } = useSimulationContext();

  // Hooks must be called unconditionally and in the same order on every render.
  // Compute topRegions via useMemo regardless of the render path; return [] when not applicable.
  const topRegions = useMemo(() => {
    if (!result || result.kind === 'batch' || result.kind === 'multi-policy' || result.kind === 'device-comparison' || result.kind === 'network-comparison' || result.kind === 'combined-comparison' || result.kind === 'randomized-multi-policy') return [];
    const run = result.result;
    return [...run.regionStats].sort((a, b) => b.delivered - a.delivered).slice(0, 5);
  }, [result]);

  if (!result) {
    return <div className="muted">Run a simulation to see results.</div>;
  }

  if (result.kind === 'randomized-multi-policy') {
    const totalPolicyRuns = result.count * 4;
    return (
      <div>
        <h3>Randomized Multi-Policy Comparisons</h3>
        {snapshot && (
          <div className="muted" style={{ marginBottom: 6, fontSize: 13 }}>
            Live environment: {snapshot.scenario} - seed {snapshot.seed}
          </div>
        )}
        <div className="muted" style={{ marginBottom: 12 }}>
          {result.info}
        </div>

        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          Each run randomizes scenario, cache size, alerts, reliability, duration, query rate, PF weights, and push controls, then compares LRU, TTLOnly, PriorityFresh, and PAFTinyLFU under identical conditions.
        </div>

        <DataExport result={result} />

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Show first 5 randomized setups (of {result.count})
          </summary>
          {result.runs.slice(0, 5).map((r, idx) => (
            <div key={idx} style={{ marginTop: 12, paddingLeft: 12, borderLeft: '3px solid #14b8a6' }}>
              <h4 style={{ marginBottom: 4, color: '#14b8a6' }}>Run #{idx + 1}</h4>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                Scenario {r.options.scenario} | cache {r.options.cacheSize} | alerts {r.options.alerts} | rel {r.options.reliability.toFixed(2)} | duration {r.options.durationSec}s | qpm {r.options.queryRatePerMin}
              </div>
              <div className="metrics" style={{ marginBottom: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {['cacheHitRate','deliveryRate','actionabilityFirstRatio'].map((key) => {
                  const k = key as keyof RunResult['metrics'];
                  return (
                    <div key={key} className="metric" style={{ padding: 6 }}>
                      <h5 style={{ fontSize: 10, marginBottom: 3 }}>{key}</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                        {r.comparison.runs.map(({ policy, result }) => (
                          <div key={policy} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#94a3b8', minWidth: 80 }}>{policy}:</span>
                            <span style={{ fontWeight: 'bold' }}>{formatMetric(key === 'cacheHitRate' || key.includes('Rate') || key.includes('Ratio') ? 'percent' : 'number', result.metrics[k] as number)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </details>

        <div className="muted" style={{ marginTop: 12, padding: 12, background: '#1a2744', borderRadius: 4 }}>
          <div>Total policy runs: {totalPolicyRuns}</div>
          <div>Tip: Export CSV and use your plotting scripts to analyze policy robustness across randomized conditions.</div>
        </div>
      </div>
    );
  }

  if (result.kind === 'device-comparison') {
    return (
      <div>
        <h3>Device Profile Comparison</h3>
        {snapshot && (
          <div className="muted" style={{ marginBottom: 6, fontSize: 13 }}>
            Live environment: {snapshot.scenario} - seed {snapshot.seed}
          </div>
        )}
        <div className="muted" style={{ marginBottom: 12 }}>
          {result.info}
        </div>
        
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          Comparing all policies across {result.comparisons.length} device types to analyze how cache size impacts performance.
        </div>

        <DataExport result={result} />

        <details style={{ marginTop: 12 }} open>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Device Profiles & Results</summary>
          {result.comparisons.map(({ deviceProfile, policyComparison }) => (
            <div key={deviceProfile.name} style={{ marginTop: 16, paddingLeft: 12, borderLeft: '3px solid #22c55e' }}>
              <h4 style={{ marginBottom: 4, color: '#22c55e' }}>
                {deviceProfile.name} (Cache: {deviceProfile.cacheSize} entries)
              </h4>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {deviceProfile.description}
              </div>
              
              <div className="metrics" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {['cacheHitRate', 'actionabilityFirstRatio', 'timelinessConsistency', 'avgFreshness'].map((key) => {
                  const def = metricDefs.find((d) => d.key === key);
                  if (!def) return null;
                  return (
                    <div key={def.key} className="metric" style={{ padding: 8 }}>
                      <h5 style={{ fontSize: 11, marginBottom: 4 }}>{def.label}</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                        {policyComparison.runs.map(({ policy, result: run }) => {
                          const value = run.metrics[def.key];
                          const formatted = formatMetric(def.format, value);
                          // Find if this policy has the best value for this metric
                          const allValues = policyComparison.runs.map((r) => r.result.metrics[def.key]);
                          const best = Math.max(...allValues);
                          const isBest = value === best;
                          return (
                            <div key={policy} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8', minWidth: 80, fontSize: 11 }}>{policy}:</span>
                              <span style={{ fontWeight: isBest ? 'bold' : 'normal', color: isBest ? '#22c55e' : 'inherit' }}>
                                {formatted}
                                {isBest && ' ★'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </details>

        <div className="muted" style={{ marginTop: 12, padding: 12, background: '#1a2744', borderRadius: 4 }}>
          <strong>Analysis Tips:</strong>
          <ul style={{ marginTop: 6, marginLeft: 18, fontSize: 13 }}>
            <li>Export as CSV and use <code>plot_cache_size_comparison.py</code> to generate scaling curves</li>
            <li>Look for policies that maintain performance even with small caches</li>
            <li>Identify the minimum cache size where performance plateaus</li>
            <li>Compare efficiency: which policy delivers best results per cache entry?</li>
          </ul>
        </div>
      </div>
    );
  }

  if (result.kind === 'network-comparison') {
    return (
      <div>
        <h3>Network Reliability Comparison</h3>
        {snapshot && (
          <div className="muted" style={{ marginBottom: 6, fontSize: 13 }}>
            Live environment: {snapshot.scenario} - seed {snapshot.seed}
          </div>
        )}
        <div className="muted" style={{ marginBottom: 12 }}>
          {result.info}
        </div>
        
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          Comparing all policies across {result.comparisons.length} network conditions to analyze how policies handle degraded networks and disaster scenarios.
        </div>

        <DataExport result={result} />

        <details style={{ marginTop: 12 }} open>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Network Conditions & Results</summary>
          {result.comparisons.map(({ networkProfile, policyComparison }) => (
            <div key={networkProfile.name} style={{ marginTop: 16, paddingLeft: 12, borderLeft: '3px solid #f97316' }}>
              <h4 style={{ marginBottom: 4, color: '#f97316' }}>
                {networkProfile.name} ({(networkProfile.reliability * 100).toFixed(0)}% reliability)
              </h4>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {networkProfile.description}
              </div>
              
              <div className="metrics" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {['deliveryRate', 'actionabilityFirstRatio', 'timelinessConsistency', 'cacheHitRate'].map((key) => {
                  const def = metricDefs.find((d) => d.key === key);
                  if (!def) return null;
                  return (
                    <div key={def.key} className="metric" style={{ padding: 8 }}>
                      <h5 style={{ fontSize: 11, marginBottom: 4 }}>{def.label}</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                        {policyComparison.runs.map(({ policy, result: run }) => {
                          const value = run.metrics[def.key];
                          const formatted = formatMetric(def.format, value);
                          // Find if this policy has the best value for this metric
                          const allValues = policyComparison.runs.map((r) => r.result.metrics[def.key]);
                          const best = Math.max(...allValues);
                          const isBest = value === best;
                          return (
                            <div key={policy} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8', minWidth: 80, fontSize: 11 }}>{policy}:</span>
                              <span style={{ fontWeight: isBest ? 'bold' : 'normal', color: isBest ? '#f97316' : 'inherit' }}>
                                {formatted}
                                {isBest && ' ★'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </details>

        <div className="muted" style={{ marginTop: 12, padding: 12, background: '#1a2744', borderRadius: 4 }}>
          <strong>Analysis Tips:</strong>
          <ul style={{ marginTop: 6, marginLeft: 18, fontSize: 13 }}>
            <li>Export as CSV and use <code>plot_network_reliability_comparison.py</code> to generate resilience curves</li>
            <li>Look for policies that maintain high delivery rates even under poor network conditions</li>
            <li>Identify which policies benefit most from caching during network degradation</li>
            <li>Compare cache hit rates: higher means better network resilience through caching</li>
            <li>Perfect for disaster scenarios: shows which policy works best when networks fail</li>
          </ul>
        </div>
      </div>
    );
  }

  if (result.kind === 'combined-comparison') {
    const totalRuns = result.comparisons.length * (result.comparisons[0]?.policyComparison.runs.length ?? 4);
    
    return (
      <div>
        <h3>Combined Device × Network Comparison</h3>
        {snapshot && (
          <div className="muted" style={{ marginBottom: 6, fontSize: 13 }}>
            Live environment: {snapshot.scenario} - seed {snapshot.seed}
          </div>
        )}
        <div className="muted" style={{ marginBottom: 12 }}>
          {result.info}
        </div>
        
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          Full solution space: Testing all {totalRuns} combinations to find optimal policies for every (device, network) scenario. This simulates real-world neighborhoods where users have different devices AND network conditions.
        </div>

        <DataExport result={result} />

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            All Device × Network Combinations ({result.comparisons.length} scenarios)
          </summary>
          
          {result.comparisons.map(({ deviceProfile, networkProfile, policyComparison }, idx) => (
            <div 
              key={`${deviceProfile.name}-${networkProfile.name}`} 
              style={{ 
                marginTop: idx === 0 ? 12 : 16, 
                paddingLeft: 12, 
                borderLeft: '4px solid #dc2626' 
              }}
            >
              <h4 style={{ marginBottom: 4, color: '#dc2626' }}>
                {deviceProfile.name} + {networkProfile.name}
              </h4>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                Cache: {deviceProfile.cacheSize} entries | Network: {(networkProfile.reliability * 100).toFixed(0)}% reliability
              </div>
              
              <div className="metrics" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {['deliveryRate', 'actionabilityFirstRatio', 'cacheHitRate'].map((key) => {
                  const def = metricDefs.find((d) => d.key === key);
                  if (!def) return null;
                  
                  const allValues = policyComparison.runs.map((r) => r.result.metrics[def.key]);
                  const best = Math.max(...allValues);
                  
                  return (
                    <div key={def.key} className="metric" style={{ padding: 6, fontSize: 11 }}>
                      <h5 style={{ fontSize: 10, marginBottom: 3 }}>{def.label}</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {policyComparison.runs.map(({ policy, result: run }) => {
                          const value = run.metrics[def.key];
                          const formatted = formatMetric(def.format, value);
                          const isBest = value === best;
                          return (
                            <div key={policy} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                              <span style={{ color: '#94a3b8', minWidth: 70 }}>{policy}:</span>
                              <span style={{ fontWeight: isBest ? 'bold' : 'normal', color: isBest ? '#dc2626' : 'inherit' }}>
                                {formatted}{isBest && ' ★'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </details>

        <div className="muted" style={{ marginTop: 12, padding: 12, background: '#1a2744', borderRadius: 4 }}>
          <strong>Analysis Tips:</strong>
          <ul style={{ marginTop: 6, marginLeft: 18, fontSize: 13 }}>
            <li>Export as CSV and use <code>plot_combined_comparison.py</code> to generate 3D surfaces and heatmaps</li>
            <li>Look for policies that perform well across ALL scenarios (robust generalists)</li>
            <li>Identify device/network combinations where policy choice matters most</li>
            <li>Use winner cubes to create decision trees: "Which policy for which scenario?"</li>
            <li>Extreme scenarios reveal policy strengths: best-case performance vs disaster resilience</li>
            <li>This is the ultimate real-world test: heterogeneous devices + unreliable networks</li>
          </ul>
        </div>
      </div>
    );
  }

  if (result.kind === 'multi-policy') {
    return (
      <div>
        <h3>Multi-Policy Comparison</h3>
        {snapshot && (
          <div className="muted" style={{ marginBottom: 6, fontSize: 13 }}>
            Live environment: {snapshot.scenario} - seed {snapshot.seed}
          </div>
        )}
        <div className="muted" style={{ marginBottom: 12 }}>
          {result.info}
        </div>
        
        <div className="metrics" style={{ marginBottom: 12 }}>
          {metricDefs.map((def) => (
            <div key={def.key} className="metric">
              <h4>{def.label}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                {result.runs.map(({ policy, result: run }) => (
                  <div key={policy} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', minWidth: 100 }}>{policy}:</span>
                    <span style={{ fontWeight: 'bold' }}>{formatMetric(def.format, run.metrics[def.key])}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {onShowEnvironment && result.runs[0] && (
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => onShowEnvironment(result.runs[0].result)}>Show Environment</button>
          </div>
        )}

        <DataExport result={result} />

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer' }}>Individual Policy Details</summary>
          {result.runs.map(({ policy, result: run }) => (
            <div key={policy} style={{ marginTop: 12, paddingLeft: 12, borderLeft: '2px solid #2a3b63' }}>
              <h4 style={{ marginBottom: 8 }}>{policy}</h4>
              <React.Suspense fallback={<div className="muted">Loading chart...</div>}>
                <TimeChart data={run.timeline} />
              </React.Suspense>
              <PolicyDiagnostics result={run} />
              <AlertTimeline result={run} />
              {policy === 'PriorityFresh' && <PFInspector result={run} />}
            </div>
          ))}
        </details>
      </div>
    );
  }

  if (result.kind === 'batch') {
    const lastRun = result.runs[result.runs.length - 1];
    return (
      <div>
        <h3>Batch Results</h3>
        {snapshot && (
          <div className="muted" style={{ marginBottom: 6, fontSize: 13 }}>
            Live environment: {snapshot.scenario} - seed {snapshot.seed}
          </div>
        )}
        <div className="muted" style={{ marginBottom: 8 }}>
          {result.info}. Showing timeline for seed {lastRun ? lastRun.seed : 'n/a'}.
        </div>
        <div style={{ marginBottom: 12, fontSize: 13, color: '#9fb3d9' }}>
          <span>Replicates: {result.replicates}</span>
          <span style={{ marginLeft: 16 }}>Seed mode: {result.seedMode}</span>
        </div>
        {onShowEnvironment && lastRun && (
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => onShowEnvironment(lastRun.result)}>Show last run in Environment</button>
          </div>
        )}
        <div className="metrics" style={{ marginBottom: 12 }}>
          {metricDefs.map((def) => (
            <div key={def.key} className="metric">
              <h4>{def.label}</h4>
              <div className="val">
                {formatMetric(def.format, result.aggregate.mean[def.key])}
                <span style={{ fontSize: 12, color: '#9fb3d9' }}>
                  {' '}+/- {formatMetric(def.format, result.aggregate.stdev[def.key])}
                </span>
              </div>
            </div>
          ))}
        </div>
        {result.runs.length > 0 && (
          <details style={{ marginBottom: 12 }}>
            <summary style={{ cursor: 'pointer' }}>Seeds used</summary>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              {result.runs.map((entry, idx) => (
                <li key={entry.seed} style={{ listStyle: 'disc', color: '#d7e1f7' }}>
                  #{idx + 1}: {entry.seed}
                </li>
              ))}
            </ul>
          </details>
        )}
        <React.Suspense fallback={<div className="muted">Loading chart...</div>}>
          <TimeChart data={lastRun ? lastRun.result.timeline : []} />
        </React.Suspense>

        {lastRun && (
          <>
            <div className="muted" style={{ marginTop: 12, fontSize: 13, fontStyle: 'italic' }}>
              Detailed analytics below are for the last run (seed: {lastRun.seed})
            </div>

            <PolicyDiagnostics result={lastRun.result} />

            <DataExport result={lastRun.result} />

            <AlertTimeline result={lastRun.result} />

            <PFInspector result={lastRun.result} />
          </>
        )}
      </div>
    );
  }

  if (result.kind !== 'single') {
    return null;
  }

  const run = result.result;
  const { metrics, timeline, info } = run;

  return (
    <div>
      <h3>Results</h3>
      {snapshot && (
        <div className="muted" style={{ marginBottom: 6, fontSize: 13 }}>
          Live environment: {snapshot.scenario} - seed {snapshot.seed}
        </div>
      )}
      {onShowEnvironment && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => onShowEnvironment(run)}>Show in Environment</button>
        </div>
      )}
      <div className="metrics" style={{ marginBottom: 12 }}>
        {metricDefs.map((def) => (
          <div key={def.key} className="metric">
            <h4>{def.label}</h4>
            <div className="val">{formatMetric(def.format, metrics[def.key])}</div>
          </div>
        ))}
      </div>

      <React.Suspense fallback={<div className="muted">Loading chart...</div>}>
        <TimeChart data={timeline} />
      </React.Suspense>

      <div className="muted" style={{ marginTop: 8 }}>{info}</div>

      {topRegions.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer' }}>Region delivery stats (top 5)</summary>
          <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
            {topRegions.map((stat) => (
              <li key={stat.regionId} style={{ listStyle: 'disc', color: '#d7e1f7', marginBottom: 4 }}>
                {stat.regionId}: delivered {stat.delivered}, dropped {stat.dropped}, first retrievals {stat.firstRetrievals}, avg latency {formatLatency(stat.avgFirstRetrievalLatencySec)}s
              </li>
            ))}
          </ul>
        </details>
      )}

      <PolicyDiagnostics result={run} />

      <DataExport result={run} />

      <AlertTimeline result={run} />

      <PFInspector result={run} />
    </div>
  );
}

function formatMetric(format: 'percent' | 'number', value: number) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }
  if (format === 'percent') {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(2);
}

function formatLatency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }
  return value.toFixed(1);
}
