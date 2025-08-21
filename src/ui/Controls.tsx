import { useState } from 'react';
import { urban } from '@sim/scenarios/urban';
import { suburban } from '@sim/scenarios/suburban';
import { rural } from '@sim/scenarios/rural';
import { lru } from '@sim/policies/lru';
import { priorityFresh } from '@sim/policies/priorityFresh';
import { ttlOnly } from '@sim/policies/ttlOnly';
import { pafTinyLFUSim } from '@sim/policies/pafTinyLFUSim';
import { runSim } from '@sim/run';
import { db } from '../db';

const SCENARIOS = { urban, suburban, rural };
const POLICIES = { 
  LRU: lru, 
  PriorityFresh: priorityFresh, 
  'TTL-Only': ttlOnly,
  'PAF-TinyLFU': pafTinyLFUSim
};

export default function Controls({ onRun }: { onRun: (res: any) => void }) {
  const [scenario, setScenario] = useState<keyof typeof SCENARIOS>('urban');
  const [policy, setPolicy] = useState<keyof typeof POLICIES>('PriorityFresh');
  const [seed, setSeed] = useState<string>('baseline');
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      const res = await runSim({ 
        scenario: SCENARIOS[scenario], 
        policy: POLICIES[policy], 
        seed,
        timeScale: 50 
      });
      
      const id = `${scenario}-${policy}-${seed}-${Date.now()}`;
      
      // Robust database write with error handling
      try {
        await db.runs.add({ 
          id, 
          scenario, 
          policy, 
          seed, 
          timestamp: Date.now(), 
          metrics: res.summary, 
          samplesCount: res.samples.length 
        });
        console.log('Run saved to database:', id);
      } catch (dbError) {
        console.warn('Failed to save run to database:', dbError);
        // Continue without database save - don't block the UI
      }
      
      onRun({ id, ...res, scenario, policy, seed });
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 16 }}>
      <label>
        Scenario:
        <select value={scenario} onChange={e => setScenario(e.target.value as any)}>
          {Object.keys(SCENARIOS).map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>
      
      <label>
        Policy:
        <select value={policy} onChange={e => setPolicy(e.target.value as any)}>
          {Object.keys(POLICIES).map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>
      
      <label>
        Seed:
        <input 
          value={seed} 
          onChange={e => setSeed(e.target.value)} 
          placeholder="seed"
          style={{ marginLeft: 4 }}
        />
      </label>
      
      <button 
        onClick={handleRun} 
        disabled={running}
        style={{ padding: '8px 16px', marginLeft: 8 }}
      >
        {running ? 'Running...' : 'Run Simulation'}
      </button>
    </div>
  );
}
