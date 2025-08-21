import { urban } from '@sim/scenarios/urban';
import { lru } from '@sim/policies/lru';
import { priorityFresh } from '@sim/policies/priorityFresh';
import { runSim } from '@sim/run';

export async function testFixes() {
  console.log('🧪 Testing simulation fixes...');
  
  // Test 1: Check if alerts have proper polygons now
  console.log('\n📍 Alert Polygon Check:');
  urban.alerts.forEach(alert => {
    console.log(`${alert.id}: ${alert.polygon.length} polygon points`);
  });
  
  // Test 2: Run simulation with LRU (smaller cache for more evictions)
  console.log('\n🔄 Running LRU simulation...');
  const lruResult = await runSim({
    scenario: urban,
    policy: (_cap) => lru(50_000), // Smaller cache to force evictions
    seed: 'test-lru-123',
    timeScale: 1
  });
  
  console.log('LRU Results:');
  console.log(`- Total devices: ${lruResult.samples.length}`);
  console.log(`- Devices inside polygon: ${lruResult.samples.filter(s => s.inside).length}`);
  console.log(`- Devices with data: ${lruResult.samples.filter(s => s.bytes > 0).length}`);
  console.log(`- Total hits: ${lruResult.samples.reduce((sum, s) => sum + s.hits, 0)}`);
  console.log(`- Total reads: ${lruResult.samples.reduce((sum, s) => sum + s.reads, 0)}`);
  console.log(`- Hit rate: ${(lruResult.summary.hitRate * 100).toFixed(2)}%`);
  console.log(`- Coverage: ${(lruResult.summary.coverageIn * 100).toFixed(2)}%`);
  console.log(`- Latency P50: ${lruResult.summary.latencyP50}ms`);
  
  // Test 3: Run simulation with PriorityFresh (same small cache)
  console.log('\n🔄 Running PriorityFresh simulation...');
  const pfResult = await runSim({
    scenario: urban,
    policy: (_cap) => priorityFresh(50_000), // Same small cache
    seed: 'test-pf-456',
    timeScale: 1
  });
  
  console.log('PriorityFresh Results:');
  console.log(`- Hit rate: ${(pfResult.summary.hitRate * 100).toFixed(2)}%`);
  console.log(`- Coverage: ${(pfResult.summary.coverageIn * 100).toFixed(2)}%`);
  console.log(`- Latency P50: ${pfResult.summary.latencyP50}ms`);
  
  // Test 4: Compare results
  console.log('\n📊 Policy Comparison:');
  console.log(`LRU vs PriorityFresh hit rate: ${(lruResult.summary.hitRate * 100).toFixed(2)}% vs ${(pfResult.summary.hitRate * 100).toFixed(2)}%`);
  console.log(`Different results: ${lruResult.summary.hitRate !== pfResult.summary.hitRate ? '✅ YES' : '❌ NO'}`);
  
  return {
    alertsHavePolygons: urban.alerts.every(a => a.polygon.length > 0),
    lruHitRate: lruResult.summary.hitRate,
    pfHitRate: pfResult.summary.hitRate,
    differentResults: lruResult.summary.hitRate !== pfResult.summary.hitRate,
    validLatencies: lruResult.summary.latencyP50 >= 0 && pfResult.summary.latencyP50 >= 0
  };
}
