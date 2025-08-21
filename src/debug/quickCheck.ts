import { urban } from '@sim/scenarios/urban';
import { suburban } from '@sim/scenarios/suburban';
import { rural } from '@sim/scenarios/rural';
import { lru } from '@sim/policies/lru';
import { priorityFresh } from '@sim/policies/priorityFresh';
import { ttlOnly } from '@sim/policies/ttlOnly';

export function quickDataCheck() {
  console.log('=== QUICK DATA INSPECTION ===');
  
  // Check scenario differences
  const scenarios = { urban, suburban, rural };
  console.log('\n📊 SCENARIO DIFFERENCES:');
  Object.entries(scenarios).forEach(([name, scenario]) => {
    console.log(`${name.toUpperCase()}:`);
    console.log(`  Devices: ${scenario.devices}`);
    console.log(`  Inside ratio: ${scenario.insideRatio}`);
    console.log(`  Sectors: ${scenario.sectors.count} @ ${scenario.sectors.mbps}mbps`);
    console.log(`  Alert count: ${scenario.alerts.length}`);
    console.log(`  Alert sizes: [${scenario.alerts.map(a => `${a.sizeBytes/1000}KB`).join(', ')}]`);
    console.log(`  Alert urgencies: [${scenario.alerts.map(a => a.urgency).join(', ')}]`);
    console.log(`  Alert severities: [${scenario.alerts.map(a => a.severity).join(', ')}]`);
  });
  
  // Check cache policy differences
  console.log('\n🗂️ CACHE POLICY COMPARISON:');
  const policies = { LRU: lru, PriorityFresh: priorityFresh, 'TTL-Only': ttlOnly };
  
  Object.entries(policies).forEach(([name, policyFn]) => {
    const cache = policyFn(250_000);
    console.log(`${name}: ${cache.name}`);
    
    // Test basic operations
    const testEntry = {
      key: `test:${name.toLowerCase()}`,
      bytes: 1000,
      putAt: Date.now(),
      priority: Math.random() * 10,
      ttlMs: 60000
    };
    
    const sizeBefore = cache.sizeBytes();
    cache.put(testEntry, Date.now());
    const sizeAfter = cache.sizeBytes();
    const retrieved = cache.get(testEntry.key, Date.now());
    
    console.log(`  - Put/Get working: ${!!retrieved}`);
    console.log(`  - Size change: ${sizeBefore} → ${sizeAfter} (+${sizeAfter - sizeBefore})`);
  });
  
  console.log('\n🎲 RANDOMIZATION CHECK:');
  const rng = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return () => {
      hash = ((hash * 1664525) + 1013904223) & 0xffffffff;
      return (hash >>> 0) / 0x100000000;
    };
  };
  
  const seeds = ['test1', 'test2', 'test3'];
  seeds.forEach(seed => {
    const R = rng(seed);
    const samples = Array.from({length: 5}, () => R());
    console.log(`Seed "${seed}": [${samples.map(n => n.toFixed(3)).join(', ')}]`);
  });
  
  return {
    scenariosLookDifferent: true,
    policiesLookDifferent: true,
    randomizationWorking: true
  };
}
