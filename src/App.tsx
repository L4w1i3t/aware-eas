import { useMemo, useState } from 'react';
import Controls from './ui/Controls';
import Results from './ui/Results';
import { runSimulation, type RunOptions, type RunResult, type SeedMode } from './sim/run';
import { runBatch, type BatchRunResult } from './sim/batch';
import { runMultiPolicyBatch, runDeviceComparison, runNetworkComparison, runCombinedComparison, type PolicyComparisonResult, type DeviceComparisonResult, type NetworkComparisonResult, type CombinedComparisonResult } from './sim/multiPolicyBatch';
import { runRandomizedMultiPolicy, type RandomizedMultiPolicyResult } from './sim/randomizedBatch';
import { logRun, putReports, type RunMeta } from './db';
import RunsHistory from './ui/RunsHistory';
import ActiveAlerts from './ui/ActiveAlerts';
import NearbyShelters from './ui/NearbyShelters';
import EnvironmentView from './ui/EnvironmentView';
import ServicesPanel from './ui/ServicesPanel';
import { useSimulationContext, type SimulationSnapshot } from './state/SimulationContext';

const TABS = ['Simulate', 'Runs', 'Alerts', 'Shelters', 'Env', 'Services'] as const;

type SingleRunView = {
  kind: 'single';
  result: RunResult;
};

type SimulationView = SingleRunView | BatchRunResult | PolicyComparisonResult | DeviceComparisonResult | NetworkComparisonResult | CombinedComparisonResult | RandomizedMultiPolicyResult;

function makeSnapshot(run: RunResult, generatedAt: number): SimulationSnapshot {
  return {
    seed: run.seed,
    scenario: run.scenario,
    baselineReliability: run.baselineReliability,
    environment: run.environment,
    regionStats: run.regionStats,
    timeline: run.timeline,
    issuedAlerts: run.issuedAlerts,
    generatedAt,
    info: run.info
  };
}

type TabName = (typeof TABS)[number];

export default function App() {
  const { setSnapshot, snapshot } = useSimulationContext();
  const [running, setRunning] = useState(false);
  const defaultOpts: RunOptions = useMemo(
    () => ({
      scenario: 'Urban',
      policy: 'PriorityFresh',
      cacheSize: 128,
      alerts: 400,
      reliability: 0.85,
      seed: 'demo',
      durationSec: 900,
      queryRatePerMin: 60,
  wS: 2,
  wU: 3,
      wF: 4,
      // Push defaults (disabled unless rate > 0)
      pushRateLimitPerMin: 0,
      pushDedupWindowSec: 120,
      pushThreshold: 0.5,
      pfExplorationEpsilon: 0.05,
      // Delivery retries (default off: attempts=1)
      deliveryRetryIntervalSec: 0,
      deliveryMaxAttempts: 1,
      replicates: 1,
      seedMode: 'Fixed'
    }),
    []
  );
  const [options, setOptions] = useState<RunOptions>(defaultOpts);
  const [result, setResult] = useState<SimulationView | null>(null);
  const [tab, setTab] = useState<TabName>('Simulate');
  const [randomCount, setRandomCount] = useState<number>(20);

  async function onRun(opts: RunOptions) {
    setRunning(true);
    try {
      const replicates = Math.max(1, opts.replicates ?? 1);
      const seedMode: SeedMode = opts.seedMode ?? 'Fixed';
      const baseNowSec = Math.floor(Date.now() / 1000);

      if (replicates > 1 || seedMode !== 'Fixed') {
        const batch = runBatch(opts, { replicates, seedMode });
        setResult(batch);

        const lastRun = batch.runs[batch.runs.length - 1];
        if (lastRun) {
          await storeDeliveredAlerts(lastRun.result.deliveredAlerts, baseNowSec);
          const batchId = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
          for (const [idx, entry] of batch.runs.entries()) {
            await logRun(makeRunMeta(entry.result, {
              id: `${batchId}-${idx + 1}`,
              scenario: opts.scenario,
              policy: opts.policy,
              seed: entry.seed,
              seedMode,
              replicateIndex: idx + 1,
              replicates,
              batchId,
              timestamp: Date.now() + idx
            }));
          }
          setSnapshot(makeSnapshot(lastRun.result, Date.now()));
        }
      } else {
        const singleResult = runSimulation(opts);
        setResult({ kind: 'single', result: singleResult });

        await storeDeliveredAlerts(singleResult.deliveredAlerts, baseNowSec);

        await logRun(
          makeRunMeta(singleResult, {
            id: `${Date.now()}`,
            scenario: opts.scenario,
            policy: opts.policy,
            seedMode,
            replicateIndex: 1,
            replicates: 1,
            seed: singleResult.seed
          })
        );
        setSnapshot(makeSnapshot(singleResult, Date.now()));
      }
    } finally {
      setRunning(false);
    }
  }

  async function onRunRandomizedMultiPolicy(opts: RunOptions, n: number) {
    setRunning(true);
    try {
      const randomized = runRandomizedMultiPolicy(n);
      setResult(randomized);

      // For convenience, snapshot the last run's environment
      const last = randomized.runs[randomized.runs.length - 1];
      if (last) {
        const baseNowSec = Math.floor(Date.now() / 1000);
        await storeDeliveredAlerts(last.comparison.runs[last.comparison.runs.length - 1]?.result.deliveredAlerts ?? [], baseNowSec);
        setSnapshot(makeSnapshot(last.comparison.runs[last.comparison.runs.length - 1].result, Date.now()));
      }
    } finally {
      setRunning(false);
    }
  }

  async function onRunMultiPolicy(opts: RunOptions) {
    setRunning(true);
    try {
      const comparison = runMultiPolicyBatch(opts);
      setResult(comparison);

      const baseNowSec = Math.floor(Date.now() / 1000);
      const batchId = `multi-policy-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

      // Store alerts from the last policy run
      const lastRun = comparison.runs[comparison.runs.length - 1];
      if (lastRun) {
        await storeDeliveredAlerts(lastRun.result.deliveredAlerts, baseNowSec);
        setSnapshot(makeSnapshot(lastRun.result, Date.now()));
      }

      // Log all policy runs
      for (const [idx, { policy, result }] of comparison.runs.entries()) {
        await logRun(makeRunMeta(result, {
          id: `${batchId}-${policy}`,
          scenario: opts.scenario,
          policy,
          seed: result.seed,
          seedMode: 'Fixed',
          replicateIndex: idx + 1,
          replicates: comparison.runs.length,
          batchId,
          timestamp: comparison.timestamp + idx
        }));
      }
    } finally {
      setRunning(false);
    }
  }

  async function onRunDeviceComparison(opts: RunOptions) {
    setRunning(true);
    try {
      const deviceComparison = runDeviceComparison(opts);
      setResult(deviceComparison);

      const baseNowSec = Math.floor(Date.now() / 1000);
      const batchId = `device-comparison-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

      // Store alerts from the last device's last policy run
      const lastDevice = deviceComparison.comparisons[deviceComparison.comparisons.length - 1];
      if (lastDevice) {
        const lastRun = lastDevice.policyComparison.runs[lastDevice.policyComparison.runs.length - 1];
        if (lastRun) {
          await storeDeliveredAlerts(lastRun.result.deliveredAlerts, baseNowSec);
          setSnapshot(makeSnapshot(lastRun.result, Date.now()));
        }
      }

      // Log all device+policy runs
      let runIdx = 0;
      for (const { deviceProfile, policyComparison } of deviceComparison.comparisons) {
        for (const { policy, result } of policyComparison.runs) {
          await logRun(makeRunMeta(result, {
            id: `${batchId}-${deviceProfile.name.replace(/\s+/g, '-')}-${policy}`,
            scenario: opts.scenario,
            policy,
            seed: result.seed,
            seedMode: 'Fixed',
            replicateIndex: runIdx + 1,
            replicates: deviceComparison.comparisons.length * policyComparison.runs.length,
            batchId,
            timestamp: deviceComparison.timestamp + runIdx
          }));
          runIdx++;
        }
      }
    } finally {
      setRunning(false);
    }
  }

  async function onRunNetworkComparison(opts: RunOptions) {
    setRunning(true);
    try {
      const networkComparison = runNetworkComparison(opts);
      setResult(networkComparison);

      const baseNowSec = Math.floor(Date.now() / 1000);
      const batchId = `network-comparison-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

      // Store alerts from the last network's last policy run
      const lastNetwork = networkComparison.comparisons[networkComparison.comparisons.length - 1];
      if (lastNetwork) {
        const lastRun = lastNetwork.policyComparison.runs[lastNetwork.policyComparison.runs.length - 1];
        if (lastRun) {
          await storeDeliveredAlerts(lastRun.result.deliveredAlerts, baseNowSec);
          setSnapshot(makeSnapshot(lastRun.result, Date.now()));
        }
      }

      // Log all network+policy runs
      let runIdx = 0;
      for (const { networkProfile, policyComparison } of networkComparison.comparisons) {
        for (const { policy, result } of policyComparison.runs) {
          await logRun(makeRunMeta(result, {
            id: `${batchId}-${networkProfile.name.replace(/\s+/g, '-')}-${policy}`,
            scenario: opts.scenario,
            policy,
            seed: result.seed,
            seedMode: 'Fixed',
            replicateIndex: runIdx + 1,
            replicates: networkComparison.comparisons.length * policyComparison.runs.length,
            batchId,
            timestamp: networkComparison.timestamp + runIdx
          }));
          runIdx++;
        }
      }
    } finally {
      setRunning(false);
    }
  }

  async function onRunCombinedComparison(opts: RunOptions) {
    setRunning(true);
    try {
      const combinedComparison = runCombinedComparison(opts);
      setResult(combinedComparison);

      const baseNowSec = Math.floor(Date.now() / 1000);
      const batchId = `combined-comparison-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

      // Store alerts from the last combination's last policy run
      const lastCombo = combinedComparison.comparisons[combinedComparison.comparisons.length - 1];
      if (lastCombo) {
        const lastRun = lastCombo.policyComparison.runs[lastCombo.policyComparison.runs.length - 1];
        if (lastRun) {
          await storeDeliveredAlerts(lastRun.result.deliveredAlerts, baseNowSec);
          setSnapshot(makeSnapshot(lastRun.result, Date.now()));
        }
      }

      // Log all device+network+policy runs
      let runIdx = 0;
      for (const { deviceProfile, networkProfile, policyComparison } of combinedComparison.comparisons) {
        for (const { policy, result } of policyComparison.runs) {
          await logRun(makeRunMeta(result, {
            id: `${batchId}-${deviceProfile.name.replace(/\s+/g, '-')}-${networkProfile.name.replace(/\s+/g, '-')}-${policy}`,
            scenario: opts.scenario,
            policy,
            seed: result.seed,
            seedMode: 'Fixed',
            replicateIndex: runIdx + 1,
            replicates: combinedComparison.comparisons.length * policyComparison.runs.length,
            batchId,
            timestamp: combinedComparison.timestamp + runIdx
          }));
          runIdx++;
        }
      }
    } finally {
      setRunning(false);
    }
  }

  function handleShowEnvironment(run: RunResult) {
    setSnapshot(makeSnapshot(run, Date.now()));
    setTab('Env');
  }

  function handleReplayFromHistory(meta: RunMeta) {
    if (!meta.fullResults) return;
    const run = meta.fullResults;
    setResult({ kind: 'single', result: run });
    setOptions((prev) => ({
      ...prev,
      scenario: run.scenario,
      policy: meta.policy as RunOptions['policy'],
      reliability: run.baselineReliability,
      seed: run.seed
    }));
    setSnapshot(makeSnapshot(run, meta.timestamp));
    setTab('Env');
  }

  return (
    <div className="app">
      <header>
        <h3>AWARE EAS Simulation</h3>
      </header>
      <div style={{ padding: 12, display: 'flex', gap: 8 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? 'var(--accent)' : '#203256',
              color: tab === t ? '#042c2c' : '#d7e1f7'
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {snapshot && (
        <div className="muted" style={{ margin: '0 12px 12px', fontSize: 13 }}>
          Live environment: {snapshot.scenario} | seed - {snapshot.seed} | baseline rel {snapshot.baselineReliability.toFixed(2)}
        </div>
      )}

      <main>
        {tab === 'Simulate' && (
          <>
            <div className="card">
              <Controls 
                options={options} 
                onChange={setOptions} 
                onRun={onRun} 
                onRunMultiPolicy={onRunMultiPolicy}
                onRunDeviceComparison={onRunDeviceComparison}
                onRunNetworkComparison={onRunNetworkComparison}
                onRunCombinedComparison={onRunCombinedComparison}
                randomCount={randomCount}
                onChangeRandomCount={setRandomCount}
                onRunRandomizedMultiPolicy={onRunRandomizedMultiPolicy}
                running={running} 
              />
            </div>
            <div className="card">
              <Results result={result} onShowEnvironment={handleShowEnvironment} />
            </div>
          </>
        )}
        {tab === 'Runs' && (
          <div className="card" style={{ gridColumn: '1 / span 2' }}>
            <RunsHistory onReplay={handleReplayFromHistory} />
          </div>
        )}
        {tab === 'Alerts' && (
          <div className="card" style={{ gridColumn: '1 / span 2' }}>
            <ActiveAlerts />
          </div>
        )}
        {tab === 'Shelters' && (
          <div className="card" style={{ gridColumn: '1 / span 2' }}>
            <NearbyShelters />
          </div>
        )}
        {tab === 'Env' && (
          <div className="card" style={{ gridColumn: '1 / span 2' }}>
            <EnvironmentView scenario={options.scenario} baselineReliability={options.reliability} />
          </div>
        )}
        {tab === 'Services' && (
          <div className="card" style={{ gridColumn: '1 / span 2' }}>
            <ServicesPanel />
          </div>
        )}
      </main>
    </div>
  );
}

async function storeDeliveredAlerts(alerts: RunResult['deliveredAlerts'], baseNowSec: number) {
  if (alerts.length === 0) return;
  await putReports(
    alerts.map((a) => ({
      id: a.id,
      eventType: a.eventType,
      severity: a.severity,
      urgency: a.urgency,
      issuedAt: baseNowSec + a.issuedAt,
      expiresAt: baseNowSec + a.issuedAt + a.ttlSec,
      headline: a.headline,
      instruction: a.instruction,
      sizeBytes: a.sizeBytes,
      geokey: a.geokey,
      regionId: a.regionId
    }))
  );
}

function makeRunMeta(
  run: RunResult,
  base: {
    id: string;
    scenario: string;
    policy: string;
    seed: string;
    timestamp?: number;
    seedMode?: SeedMode;
    replicateIndex?: number;
    replicates?: number;
    batchId?: string;
  }
): RunMeta {
  return {
    id: base.id,
    scenario: base.scenario,
    policy: base.policy,
    seed: base.seed,
    timestamp: base.timestamp ?? Date.now(),
    metrics: run.metrics,
    samplesCount: run.timeline.length,
    fullResults: run,
    batchId: base.batchId,
    seedMode: base.seedMode,
    replicateIndex: base.replicateIndex,
    replicates: base.replicates
  };
}

