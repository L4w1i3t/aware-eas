import { runSim } from '@sim/run';
import { db } from '../db';
import { urban } from '@sim/scenarios/urban';
import { suburban } from '@sim/scenarios/suburban';
import { rural } from '@sim/scenarios/rural';
import { lru } from '@sim/policies/lru';
import { priorityFresh } from '@sim/policies/priorityFresh';
import { ttlOnly } from '@sim/policies/ttlOnly';

export async function runMatrix({ 
  seeds = ['s1', 's2', 's3'],
  onProgress 
}: { 
  seeds?: string[], 
  onProgress?: (current: number, total: number, description: string) => void 
} = {}) {
  const scenarios = { urban, suburban, rural };
  const policies = { LRU: lru, PriorityFresh: priorityFresh, 'TTL-Only': ttlOnly };
  
  const total = Object.keys(scenarios).length * Object.keys(policies).length * seeds.length;
  let current = 0;
  
  for (const [scName, sc] of Object.entries(scenarios)) {
    for (const [polName, pol] of Object.entries(policies)) {
      for (const seed of seeds) {
        current++;
        const description = `Running ${scName} × ${polName} × ${seed}`;
        onProgress?.(current, total, description);
        
        try {
          const { summary, samples } = await runSim({ 
            scenario: sc, 
            policy: pol, 
            seed,
            timeScale: 50 
          });
          
          const id = `${scName}-${polName}-${seed}-${Date.now()}`;
          await db.runs.add({ 
            id, 
            scenario: scName, 
            policy: polName, 
            seed, 
            timestamp: Date.now(), 
            metrics: summary, 
            samplesCount: samples.length 
          });
          
          console.log(`✓ Completed ${description}`);
        } catch (error) {
          console.error(`✗ Failed ${description}:`, error);
        }
      }
    }
  }
  
  console.log(`Matrix complete: ${current}/${total} runs`);
}

export async function exportAllRuns() {
  const runs = await db.runs.toArray();
  const csv = [
    'id,scenario,policy,seed,timestamp,coverageIn,overshoot,latencyP50,latencyP95,hitRate,freshnessMean,bytesPerDevice',
    ...runs.map(r => [
      r.id,
      r.scenario,
      r.policy,
      r.seed,
      r.timestamp,
      r.metrics.coverageIn?.toFixed(4) || '',
      r.metrics.overshoot?.toFixed(4) || '',
      r.metrics.latencyP50?.toFixed(2) || '',
      r.metrics.latencyP95?.toFixed(2) || '',
      r.metrics.hitRate?.toFixed(4) || '',
      r.metrics.freshnessMean?.toFixed(2) || '',
      r.metrics.bytesPerDevice?.toFixed(2) || ''
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aware-all-runs-${Date.now()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
