import { useId } from 'react';
import type { RunOptions, SeedMode } from '../sim/run';

type Props = {
  options: RunOptions;
  onChange: (v: RunOptions) => void;
  onRun: (v: RunOptions) => void | Promise<void>;
  onRunMultiPolicy: (v: RunOptions) => void | Promise<void>;
  onRunDeviceComparison?: (v: RunOptions) => void | Promise<void>;
  onRunNetworkComparison?: (v: RunOptions) => void | Promise<void>;
  onRunCombinedComparison?: (v: RunOptions) => void | Promise<void>;
  // Randomized runs
  randomCount?: number;
  onChangeRandomCount?: (n: number) => void;
  onRunRandomizedMultiPolicy?: (v: RunOptions, n: number) => void | Promise<void>;
  running: boolean;
};

const scenarios = ['Rural', 'Suburban', 'Urban'] as const;
const policies = ['LRU', 'TTLOnly', 'PriorityFresh', 'PAFTinyLFU'] as const;
const seedModes: SeedMode[] = ['Fixed', 'DeterministicJitter', 'Randomized'];

export default function Controls({ options, onChange, onRun, onRunMultiPolicy, onRunDeviceComparison, onRunNetworkComparison, onRunCombinedComparison, randomCount = 10, onChangeRandomCount, onRunRandomizedMultiPolicy, running }: Props) {
  const ids = {
    scenario: useId(),
    policy: useId(),
    cacheSize: useId(),
    alerts: useId(),
    reliability: useId(),
    seed: useId(),
    seedMode: useId(),
    replicates: useId(),
    durationSec: useId(),
    qpm: useId(),
    pushRate: useId(),
    pushDedup: useId(),
    pushTau: useId(),
    pfEps: useId(),
    randCount: useId(),
    retryInterval: useId(),
    retryAttempts: useId()
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onRun(options);
      }}
    >
      <h3>Simulation Controls</h3>
      <div className="row">
        <div>
          <label htmlFor={ids.scenario}>Scenario</label>
          <select
            id={ids.scenario}
            value={options.scenario}
            onChange={(e) => onChange({ ...options, scenario: e.target.value as (typeof scenarios)[number] })}
          >
            {scenarios.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.policy}>Policy</label>
          <select
            id={ids.policy}
            value={options.policy}
            onChange={(e) => onChange({ ...options, policy: e.target.value as (typeof policies)[number] })}
          >
            {policies.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor={ids.cacheSize}>Cache size</label>
          <input
            id={ids.cacheSize}
            type="number"
            min={8}
            max={4096}
            value={options.cacheSize}
            onChange={(e) => onChange({ ...options, cacheSize: Number(e.target.value) })}
          />
        </div>
        <div>
          <label htmlFor={ids.alerts}>Alerts</label>
          <input
            id={ids.alerts}
            type="number"
            min={10}
            max={10000}
            value={options.alerts}
            onChange={(e) => onChange({ ...options, alerts: Number(e.target.value) })}
          />
        </div>
      </div>

      {options.policy === 'PriorityFresh' && (
        <div className="row">
          <div>
            <label>Severity weight (wS)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={options.wS ?? 2}
              onChange={(e) => onChange({ ...options, wS: Number(e.target.value) })}
            />
          </div>
          <div>
            <label>Urgency weight (wU)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={options.wU ?? 3}
              onChange={(e) => onChange({ ...options, wU: Number(e.target.value) })}
            />
          </div>
        </div>
      )}
      {options.policy === 'PriorityFresh' && (
        <div className="row">
          <div>
            <label>Freshness weight (wF)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={options.wF ?? 4}
              onChange={(e) => onChange({ ...options, wF: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div className="row">
        <div>
          <label htmlFor={ids.reliability}>Network reliability [0-1]</label>
          <input
            id={ids.reliability}
            type="number"
            step={0.01}
            min={0}
            max={1}
            value={options.reliability}
            onChange={(e) => onChange({ ...options, reliability: Number(e.target.value) })}
          />
        </div>
        <div>
          <label htmlFor={ids.seed}>Seed</label>
          <input
            id={ids.seed}
            type="text"
            value={options.seed}
            onChange={(e) => onChange({ ...options, seed: e.target.value })}
          />
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor={ids.seedMode}>Seed mode</label>
          <select
            id={ids.seedMode}
            value={options.seedMode ?? 'Fixed'}
            onChange={(e) => onChange({ ...options, seedMode: e.target.value as SeedMode })}
          >
            {seedModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode === 'Fixed' ? 'Fixed (single seed)' : mode === 'DeterministicJitter' ? 'Deterministic jitter' : 'Randomized'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.replicates}>Replicates</label>
          <input
            id={ids.replicates}
            type="number"
            min={1}
            max={100}
            value={options.replicates ?? 1}
            onChange={(e) => onChange({ ...options, replicates: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor={ids.durationSec}>Duration (sec)</label>
          <input
            id={ids.durationSec}
            type="number"
            min={60}
            max={86400}
            value={options.durationSec}
            onChange={(e) => onChange({ ...options, durationSec: Number(e.target.value) })}
          />
        </div>
        <div>
          <label htmlFor={ids.qpm}>Query rate (/min)</label>
          <input
            id={ids.qpm}
            type="number"
            min={0}
            max={10000}
            value={options.queryRatePerMin}
            onChange={(e) => onChange({ ...options, queryRatePerMin: Number(e.target.value) })}
          />
        </div>
      </div>

      <fieldset style={{ marginTop: 12 }}>
        <legend>Push controls</legend>
        <div className="row">
          <div>
            <label htmlFor={ids.pushRate}>Rate limit (pushes/min)</label>
            <input
              id={ids.pushRate}
              type="number"
              min={0}
              max={600}
              value={options.pushRateLimitPerMin ?? 0}
              onChange={(e) => onChange({ ...options, pushRateLimitPerMin: Number(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor={ids.pushDedup}>Dedup window (sec)</label>
            <input
              id={ids.pushDedup}
              type="number"
              min={0}
              max={3600}
              value={options.pushDedupWindowSec ?? 0}
              onChange={(e) => onChange({ ...options, pushDedupWindowSec: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label htmlFor={ids.pushTau}>PF threshold (τ)</label>
            <input
              id={ids.pushTau}
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={options.pushThreshold ?? 0.5}
              onChange={(e) => onChange({ ...options, pushThreshold: Number(e.target.value) })}
            />
          </div>
          {options.policy === 'PriorityFresh' && (
            <div>
              <label htmlFor={ids.pfEps}>Exploration ε</label>
              <input
                id={ids.pfEps}
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={options.pfExplorationEpsilon ?? 0}
                onChange={(e) => onChange({ ...options, pfExplorationEpsilon: Number(e.target.value) })}
              />
            </div>
          )}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          Set rate limit R to enable push simulation; D suppresses rapid repeats per thread; τ is the PF probability threshold.
        </div>
      </fieldset>

      <fieldset style={{ marginTop: 12 }}>
        <legend>Delivery</legend>
        <div className="row">
          <div>
            <label htmlFor={ids.retryInterval}>Retry interval (sec)</label>
            <input
              id={ids.retryInterval}
              type="number"
              min={0}
              max={3600}
              value={options.deliveryRetryIntervalSec ?? 0}
              onChange={(e) => onChange({ ...options, deliveryRetryIntervalSec: Math.max(0, Number(e.target.value)) })}
            />
          </div>
          <div>
            <label htmlFor={ids.retryAttempts}>Max attempts</label>
            <input
              id={ids.retryAttempts}
              type="number"
              min={1}
              max={50}
              value={options.deliveryMaxAttempts ?? 1}
              onChange={(e) => onChange({ ...options, deliveryMaxAttempts: Math.max(1, Number(e.target.value)) })}
            />
          </div>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          Retries simulate re-attempting network delivery when the first try fails. Set attempts to 1 to disable retries.
        </div>
      </fieldset>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" disabled={running}>
          {running ? 'Running...' : 'Run Simulation'}
        </button>
        <button 
          type="button" 
          disabled={running}
          onClick={(e) => {
            e.preventDefault();
            onRunMultiPolicy(options);
          }}
          style={{ 
            background: '#1e4d8b',
            borderColor: '#2563eb'
          }}
        >
          {running ? 'Running...' : 'Compare All Policies'}
        </button>
        {onRunRandomizedMultiPolicy && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor={ids.randCount} style={{ fontSize: 12, color: '#9fb3d9' }}>Random runs</label>
            <input
              id={ids.randCount}
              type="number"
              min={1}
              max={1000}
              value={randomCount}
              onChange={(e) => onChangeRandomCount && onChangeRandomCount(Math.max(1, Number(e.target.value)))}
              style={{ width: 80 }}
            />
            <button 
              type="button" 
              disabled={running}
              onClick={(e) => {
                e.preventDefault();
                onRunRandomizedMultiPolicy(options, randomCount);
              }}
              style={{ 
                background: '#0f766e',
                borderColor: '#14b8a6'
              }}
            >
              {running ? 'Running...' : 'Randomized Policy Comparisons'}
            </button>
          </div>
        )}
        {onRunDeviceComparison && (
          <button 
            type="button" 
            disabled={running}
            onClick={(e) => {
              e.preventDefault();
              onRunDeviceComparison(options);
            }}
            style={{ 
              background: '#15803d',
              borderColor: '#22c55e'
            }}
          >
            {running ? 'Running...' : 'Device Profile Comparison'}
          </button>
        )}
        {onRunNetworkComparison && (
          <button 
            type="button" 
            disabled={running}
            onClick={(e) => {
              e.preventDefault();
              onRunNetworkComparison(options);
            }}
            style={{ 
              background: '#c2410c',
              borderColor: '#f97316'
            }}
          >
            {running ? 'Running...' : 'Network Reliability Comparison'}
          </button>
        )}
        {onRunCombinedComparison && (
          <button 
            type="button" 
            disabled={running}
            onClick={(e) => {
              e.preventDefault();
              onRunCombinedComparison(options);
            }}
            style={{ 
              background: '#7c2d12',
              borderColor: '#dc2626'
            }}
          >
            {running ? 'Running...' : 'Combined (Device × Network) Comparison'}
          </button>
        )}
      </div>

      <div className="muted" style={{ marginTop: 8 }}>
        <div>Run Simulation: Execute with selected policy and settings.</div>
        <div>Compare All Policies: Run LRU, TTLOnly, PriorityFresh, and PAFTinyLFU with identical conditions (same seed, cache size, etc.) for direct comparison.</div>
        {onRunDeviceComparison && (
          <div>Device Profile Comparison: Test all policies across 5 device types (32 to 1024 cache entries) to analyze scaling behavior.</div>
        )}
        {onRunNetworkComparison && (
          <div>Network Reliability Comparison: Test all policies across 8 network conditions (100% to 30% reliability) to analyze resilience under degraded networks.</div>
        )}
        {onRunCombinedComparison && (
          <div>Combined Comparison: Test all policies across ALL combinations of 5 device types × 8 network conditions (160 total runs) for comprehensive real-world analysis.</div>
        )}
        <div style={{ marginTop: 4 }}>Deterministic jitter derives repeatable seeds from the base seed; randomized mode records generated seeds in run history for replay.</div>
      </div>
    </form>
  );
}
