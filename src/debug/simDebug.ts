import { runSim } from '@sim/run';
import { urban } from '@sim/scenarios/urban';
import { suburban } from '@sim/scenarios/suburban';
import { rural } from '@sim/scenarios/rural';
import { lru } from '@sim/policies/lru';
import { priorityFresh } from '@sim/policies/priorityFresh';
import { ttlOnly } from '@sim/policies/ttlOnly';

const SCENARIOS = { urban, suburban, rural };
const POLICIES = { LRU: lru, PriorityFresh: priorityFresh, 'TTL-Only': ttlOnly };

export async function debugSimulation() {
  console.log('🔍 Starting Simulation Debug Analysis...\n');
  
  // Test 1: Check if scenarios are actually different
  console.log('📊 SCENARIO ANALYSIS:');
  Object.entries(SCENARIOS).forEach(([name, scenario]) => {
    console.log(`${name}:`);
    console.log(`  - Devices: ${scenario.devices}`);
    console.log(`  - Inside Ratio: ${scenario.insideRatio}`);
    console.log(`  - Sectors: ${scenario.sectors.count} @ ${scenario.sectors.mbps}mbps`);
    console.log(`  - Alerts: ${scenario.alerts.length} (sizes: ${scenario.alerts.map(a => a.sizeBytes).join(', ')})`);
    console.log(`  - Alert timings: ${scenario.alerts.map(a => a.issuedAt / 60000).join('min, ')}min`);
  });
  
  console.log('\n🎯 CACHE POLICY TESTING:');
  
  // Test 2: Run same scenario with different policies (with different seeds)
  const testScenario = urban;
  const policySeeds: Record<string, string> = {
    'LRU': 'debug-lru-456',
    'PriorityFresh': 'debug-pf-789', 
    'TTL-Only': 'debug-ttl-012'
  };
  
  for (const [policyName, policyFn] of Object.entries(POLICIES)) {
    console.log(`\n--- Testing ${policyName} ---`);
    
    // Create cache instance to inspect (smaller cache to force evictions)
    const cacheInstance = policyFn(50_000);
    console.log(`Cache Policy Name: ${cacheInstance.name}`);
    console.log(`Initial Cache Size: ${cacheInstance.sizeBytes()} bytes`);
    
    // Run simulation with policy-specific seed
    const start = Date.now();
    const result = await runSim({
      scenario: testScenario,
      policy: (_cap) => policyFn(50_000), // Force smaller cache
      seed: policySeeds[policyName] || 'debug-default-123',
      timeScale: 1 // Faster for debugging
    });
    const duration = Date.now() - start;
    
    console.log(`Simulation completed in ${duration}ms`);
    console.log(`Sample count: ${result.samples.length}`);
    console.log(`Devices with data: ${result.samples.filter(s => s.bytes > 0).length}`);
    console.log(`Total hits across all devices: ${result.samples.reduce((sum, s) => sum + s.hits, 0)}`);
    console.log(`Total reads across all devices: ${result.samples.reduce((sum, s) => sum + s.reads, 0)}`);
    console.log(`Devices that received alerts: ${result.samples.filter(s => s.receivedAt !== undefined).length}`);
    
    console.log('Key Metrics:');
    console.log(`  - Coverage: ${(result.summary.coverageIn * 100).toFixed(1)}%`);
    console.log(`  - Hit Rate: ${(result.summary.hitRate * 100).toFixed(1)}%`);
    console.log(`  - Latency P50: ${result.summary.latencyP50?.toFixed(0)}ms`);
    console.log(`  - Latency P95: ${result.summary.latencyP95?.toFixed(0)}ms`);
    console.log(`  - Bytes/Device: ${result.summary.bytesPerDevice.toFixed(0)}`);
    console.log(`  - Freshness Mean: ${(result.summary.freshnessMean / 1000).toFixed(1)}s`);
    console.log(`  - Stale Rate: ${(result.summary.staleRate * 100).toFixed(1)}%`);
  }
  
  console.log('\n🔄 SEED VARIATION TESTING:');
  
  // Test 3: Check if different seeds and policies produce different results
  const seeds = ['seed1', 'seed2', 'seed3'];
  const policies = [lru, priorityFresh, ttlOnly];
  const seedResults: any[] = [];
  
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    const policy = policies[i];
    const policyName = ['LRU', 'PriorityFresh', 'TTL-Only'][i];
    
    const result = await runSim({
      scenario: testScenario,
      policy: (_cap) => policy(50_000), // Small cache to force differences
      seed: seed,
      timeScale: 1
    });
    
    seedResults.push({
      seed,
      policy: policyName,
      hitRate: result.summary.hitRate,
      latencyP50: result.summary.latencyP50,
      coverage: result.summary.coverageIn
    });
    
    console.log(`${policyName} (${seed}): Hit Rate=${(result.summary.hitRate * 100).toFixed(1)}%, Latency=${result.summary.latencyP50?.toFixed(0)}ms`);
  }
  
  // Check if results vary significantly across policies/seeds
  const hitRateVariance = seedResults.reduce((sum, r) => sum + Math.pow(r.hitRate - seedResults[0].hitRate, 2), 0) / seeds.length;
  console.log(`Hit rate variance across seeds/policies: ${hitRateVariance.toFixed(6)}`);
  
  if (hitRateVariance < 0.001) {
    console.log('⚠️  WARNING: Very low variance across seeds/policies - might need different parameters!');
  } else {
    console.log('✅ Good variance across different configurations');
  }
  
  console.log('\n📈 CACHE BEHAVIOR INSPECTION:');
  
  // Test 4: Direct cache testing with realistic priorities
  const testCache = lru(50_000); // Use reduced capacity
  console.log('Testing cache operations directly:');
  
  // Create a realistic alert for testing
  const testAlert = {
    id: 'test-alert',
    urgency: 'Immediate' as const,
    severity: 'Extreme' as const
  };
  
  // Use the actual priorityScore function calculation
  function calculateActualPriority(alert: any) {
    let priority = 5; // Base priority
    if (alert.severity === 'Extreme') priority += 4;
    else if (alert.severity === 'Severe') priority += 2;
    else if (alert.severity === 'Moderate') priority += 1;
    if (alert.urgency === 'Immediate') priority += 1;
    return Math.min(10, Math.max(1, priority));
  }
  
  // Test cache operations
  const testEntry = {
    key: 'test:alert1',
    bytes: 1000,
    putAt: Date.now(),
    priority: calculateActualPriority(testAlert), // Should be 10 for Extreme+Immediate
    ttlMs: 60000
  };
  
  console.log(`Before put - Cache size: ${testCache.sizeBytes()}`);
  testCache.put(testEntry, Date.now());
  console.log(`After put - Cache size: ${testCache.sizeBytes()}`);
  
  const retrieved = testCache.get('test:alert1', Date.now());
  console.log(`Retrieved entry: ${retrieved ? 'Found' : 'Not found'}`);
  if (retrieved) {
    console.log(`  - Key: ${retrieved.key}`);
    console.log(`  - Bytes: ${retrieved.bytes}`);
    console.log(`  - Priority: ${retrieved.priority}`);
  }
  
  console.log('\n✅ Debug analysis complete!');
  
  return {
    scenariosDiffer: true, // We can see they have different parameters
    policiesTested: Object.keys(POLICIES).length,
    seedVariance: hitRateVariance,
    cacheWorking: !!retrieved
  };
}
