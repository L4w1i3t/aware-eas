import { Alert } from '@sim/models/alert';
import { RandomGenerator } from '@sim/core/RandomGenerator';

export interface AlertInjectionConfig {
  baseRatePerHour: number; // alerts per hour under normal conditions
  burstMultiplier: number; // multiplier during emergency bursts
  duplicateRatio: number; // 0-1, ratio of duplicate alerts
  priorityDistribution: {
    extreme: number; // 0-1
    severe: number;  // 0-1
    // remainder is moderate
  };
  urgencyDistribution: {
    immediate: number; // 0-1
    // remainder is expected
  };
}

export interface AlertBurst {
  startTime: number;
  durationMs: number;
  multiplier: number;
  affectedSectors?: ('urban' | 'suburban' | 'rural')[];
}

export class AlertInjector {
  private config: AlertInjectionConfig;
  private rng: RandomGenerator;
  private nextAlertId = 1;
  private alertHistory: Alert[] = [];
  private activeBursts: AlertBurst[] = [];

  constructor(config: AlertInjectionConfig, rng: RandomGenerator) {
    this.config = config;
    this.rng = rng;
  }

  // Schedule a burst of alerts (for testing congestion scenarios)
  scheduleBurst(burst: AlertBurst) {
    this.activeBursts.push(burst);
  }

  // Generate alerts for a time window
  generateAlertsForWindow(startTime: number, endTime: number): Alert[] {
    const alerts: Alert[] = [];
    const durationMs = endTime - startTime;
    const durationHours = durationMs / (1000 * 60 * 60);
    
    // Calculate effective rate considering active bursts
    const effectiveRate = this.calculateEffectiveRate(startTime, endTime);
    const expectedCount = effectiveRate * durationHours;
    
    // Use Poisson process to generate alert times
    const alertCount = this.poissonRandom(expectedCount);
    
    for (let i = 0; i < alertCount; i++) {
      const alertTime = startTime + this.rng.next() * durationMs;
      const alert = this.generateAlert(alertTime);
      alerts.push(alert);
    }
    
    // Generate duplicates
    const duplicateCount = Math.floor(alerts.length * this.config.duplicateRatio);
    for (let i = 0; i < duplicateCount; i++) {
      const originalAlert = this.rng.choice(alerts);
      const duplicate = this.createDuplicateAlert(originalAlert);
      alerts.push(duplicate);
    }
    
    // Sort by time
    alerts.sort((a, b) => (a as any).timestamp - (b as any).timestamp);
    
    this.alertHistory.push(...alerts);
    return alerts;
  }

  private calculateEffectiveRate(startTime: number, endTime: number): number {
    let baseRate = this.config.baseRatePerHour;
    
    // Check for active bursts
    for (const burst of this.activeBursts) {
      const burstEnd = burst.startTime + burst.durationMs;
      
      // Check if burst overlaps with our time window
      if (burst.startTime < endTime && burstEnd > startTime) {
        const overlapStart = Math.max(startTime, burst.startTime);
        const overlapEnd = Math.min(endTime, burstEnd);
        const overlapRatio = (overlapEnd - overlapStart) / (endTime - startTime);
        
        baseRate += (burst.multiplier - 1) * this.config.baseRatePerHour * overlapRatio;
      }
    }
    
    return baseRate;
  }

  private generateAlert(timestamp: number): Alert {
    const severity = this.randomSeverity();
    const urgency = this.randomUrgency();
    
    const alert: Alert = {
      id: `alert_${this.nextAlertId++}`,
      polygon: this.generatePolygon(),
      severity,
      urgency,
      issuedAt: timestamp,
      expireAt: timestamp + this.getTTL(severity),
      sizeBytes: this.rng.nextInt(500, 2000) // Realistic CAP message size
    };
    
    // Store timestamp for sorting
    (alert as any).timestamp = timestamp;
    
    return alert;
  }

  private randomSeverity(): 'Extreme' | 'Severe' | 'Moderate' {
    const roll = this.rng.next();
    const { extreme, severe } = this.config.priorityDistribution;
    
    if (roll < extreme) return 'Extreme';
    if (roll < extreme + severe) return 'Severe';
    return 'Moderate';
  }

  private randomUrgency(): 'Immediate' | 'Expected' {
    const roll = this.rng.next();
    const { immediate } = this.config.urgencyDistribution;
    
    if (roll < immediate) return 'Immediate';
    return 'Expected';
  }

  private generatePolygon(): [number, number][] {
    // Generate simple rectangular polygon for testing
    const centerLon = this.rng.nextFloat(-180, 180);
    const centerLat = this.rng.nextFloat(-90, 90);
    const size = this.rng.nextFloat(0.01, 0.1); // Small area
    
    return [
      [centerLon - size, centerLat - size],
      [centerLon + size, centerLat - size],
      [centerLon + size, centerLat + size],
      [centerLon - size, centerLat + size],
      [centerLon - size, centerLat - size] // Close polygon
    ];
  }

  private createDuplicateAlert(original: Alert): Alert {
    const duplicate = { ...original };
    duplicate.id = `${original.id}_dup_${this.rng.nextInt(1, 1000)}`;
    // Slight variation in issue time
    const originalTime = original.issuedAt;
    const newTime = originalTime + this.rng.nextInt(-30000, 30000); // ±30 seconds
    duplicate.issuedAt = newTime;
    duplicate.expireAt = newTime + this.getTTL(duplicate.severity);
    (duplicate as any).timestamp = newTime;
    
    return duplicate;
  }

  private getTTL(severity: string): number {
    switch (severity) {
      case 'Extreme': return 5 * 60 * 1000; // 5 minutes
      case 'Severe': return 10 * 60 * 1000; // 10 minutes
      default: return 15 * 60 * 1000; // 15 minutes
    }
  }

  private poissonRandom(lambda: number): number {
    if (lambda === 0) return 0;
    
    let count = 0;
    let p = 1.0;
    const threshold = Math.exp(-lambda);
    
    do {
      count++;
      p *= this.rng.next();
    } while (p > threshold);
    
    return count - 1;
  }

  // Get statistics about generated alerts
  getStatistics() {
    const stats = {
      totalGenerated: this.alertHistory.length,
      bySeverity: { Extreme: 0, Severe: 0, Moderate: 0 },
      byUrgency: { Immediate: 0, Expected: 0, Future: 0 },
      duplicates: 0
    };
    
    this.alertHistory.forEach(alert => {
      stats.bySeverity[alert.severity as keyof typeof stats.bySeverity]++;
      stats.byUrgency[alert.urgency as keyof typeof stats.byUrgency]++;
      if (alert.id.includes('_dup_')) {
        stats.duplicates++;
      }
    });
    
    return stats;
  }

  // Clear history for new simulation run
  reset() {
    this.alertHistory = [];
    this.activeBursts = [];
    this.nextAlertId = 1;
  }
}
