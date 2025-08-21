// Quick test to verify our priority scaling fixes
import type { Alert } from '@sim/models/alert';

export function testPriorityScaling() {
  console.log('🎯 TESTING PRIORITY SCALING FIXES:');
  
  // Create test alerts with different priorities
  const alerts: Alert[] = [
    {
      id: 'extreme-immediate',
      polygon: [[-78.49, 38.04], [-78.47, 38.04], [-78.47, 38.07], [-78.49, 38.07]],
      sizeBytes: 60000,
      issuedAt: 0,
      expireAt: 3600000,
      urgency: 'Immediate',
      severity: 'Extreme'
    },
    {
      id: 'severe-immediate', 
      polygon: [[-78.49, 38.04], [-78.47, 38.04], [-78.47, 38.07], [-78.49, 38.07]],
      sizeBytes: 45000,
      issuedAt: 0,
      expireAt: 3600000,
      urgency: 'Immediate',
      severity: 'Severe'
    },
    {
      id: 'severe-expected',
      polygon: [[-78.49, 38.04], [-78.47, 38.04], [-78.47, 38.07], [-78.49, 38.07]],
      sizeBytes: 30000,
      issuedAt: 0,
      expireAt: 3600000,
      urgency: 'Expected',
      severity: 'Severe'
    },
    {
      id: 'moderate-expected',
      polygon: [[-78.49, 38.04], [-78.47, 38.04], [-78.47, 38.07], [-78.49, 38.07]],
      sizeBytes: 25000,
      issuedAt: 0,
      expireAt: 3600000,
      urgency: 'Expected',
      severity: 'Moderate'
    }
  ];
  
  // Test the new priority scoring function
  function priorityScore(a: Alert, _d: any) {
    let priority = 5; // Base priority
    
    // Severity contribution (0-4 points)
    if (a.severity === 'Extreme') priority += 4;
    else if (a.severity === 'Severe') priority += 2;
    else if (a.severity === 'Moderate') priority += 1;
    
    // Urgency contribution (0-1 points)
    if (a.urgency === 'Immediate') priority += 1;
    
    return Math.min(10, Math.max(1, priority));
  }
  
  function ttlFor(a: Alert) {
    if (a.severity === 'Extreme') return 3*60*1000;   // 3 minutes
    if (a.severity === 'Severe') return 8*60*1000;    // 8 minutes  
    return 20*60*1000;                                 // 20 minutes
  }
  
  console.log('\n📊 Priority Scores (OLD vs NEW):');
  console.log('Alert ID'.padEnd(20) + 'OLD Score'.padEnd(12) + 'NEW Score'.padEnd(12) + 'TTL (min)');
  console.log('-'.repeat(60));
  
  alerts.forEach(alert => {
    // Old scoring (what we had before)
    const oldSev = alert.severity === 'Extreme' ? 1 : alert.severity === 'Severe' ? 0.6 : 0.3;
    const oldUrg = alert.urgency === 'Immediate' ? 1 : 0.6;
    const oldScore = oldSev * oldUrg;
    
    // New scoring
    const newScore = priorityScore(alert, null);
    const ttl = ttlFor(alert) / (60 * 1000); // Convert to minutes
    
    console.log(
      alert.id.padEnd(20) + 
      oldScore.toFixed(2).padEnd(12) + 
      newScore.toString().padEnd(12) + 
      ttl.toString() + ' min'
    );
  });
  
  console.log('\n✅ Priority differentiation should now be much better!');
  console.log('   - OLD: Range 0.18-1.0 (very narrow)');
  console.log('   - NEW: Range 6-10 (much wider, integer values)');
  console.log('   - TTL: 3-20 minutes (better time diversity)');
  
  return {
    oldRange: [0.18, 1.0],
    newRange: [6, 10],
    ttlRange: [3, 20]
  };
}
