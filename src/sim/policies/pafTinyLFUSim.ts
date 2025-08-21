import { Alert } from '@sim/models/alert';
import { CachePolicy, CacheEntry } from '@sim/models/cache';
import { FrequencySketch } from './frequency-sketch';

interface SimplifiedAlertRecord {
  id: string;
  alertId: string;
  alertType: string;
  priority: number;
  severity: number;
  area: string;
  receivedAt: number;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  isDuplicate: boolean;
}

/**
 * Simplified PAF-TinyLFU cache for simulation (synchronous, no database)
 * Focuses on core algorithm without persistence overhead
 */
export function pafTinyLFUSim(capacityBytes = 250_000): CachePolicy {
  const maxItems = Math.floor(capacityBytes / 1000); // Estimate items from bytes
  const frequencySketch = new FrequencySketch(maxItems);
  
  // Simplified storage
  const alertCache = new Map<string, SimplifiedAlertRecord>();
  const syncCache = new Map<string, CacheEntry>();
  const alertLRU: string[] = [];
  const admissionWindow = new Set<string>();
  const admissionWindowSize = 100;
  
  // Metrics
  let hitCount = 0;
  let missCount = 0;
  let evictionCount = 0;

  function calculatePriority(alert: Alert): number {
    let priority = 5; // Base priority
    
    if (alert.severity === 'Extreme') priority += 4;
    else if (alert.severity === 'Severe') priority += 2;
    
    if (alert.urgency === 'Immediate') priority += 1;
    
    return Math.min(10, priority);
  }

  function getSeverityScore(severity: string): number {
    switch (severity) {
      case 'Extreme': return 5;
      case 'Severe': return 3;
      case 'Moderate': return 1;
      default: return 0;
    }
  }

  function getPolygonBounds(polygon: [number, number][]): string {
    if (polygon.length === 0) return 'unknown';
    
    let minLon = polygon[0][0], maxLon = polygon[0][0];
    let minLat = polygon[0][1], maxLat = polygon[0][1];
    
    for (const [lon, lat] of polygon) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    
    return `${minLon.toFixed(3)},${minLat.toFixed(3)},${maxLon.toFixed(3)},${maxLat.toFixed(3)}`;
  }

  function calculateAdmissionScore(record: SimplifiedAlertRecord): number {
    const now = Date.now();
    const timeToExpiry = record.expiresAt - now;
    const maxTTL = 24 * 60 * 60 * 1000; // 24 hours
    
    const freshnessScore = Math.min(1, timeToExpiry / maxTTL);
    const priorityScore = Math.min(1, record.priority / 10);
    const severityScore = Math.min(1, record.severity / 5);
    const sizePenalty = Math.min(1, record.size / 1000);
    const duplicatePenalty = record.isDuplicate ? 0.5 : 1.0;
    
    return (priorityScore * 0.4 + 
            severityScore * 0.3 + 
            freshnessScore * 0.2 + 
            (1 - sizePenalty) * 0.1) * duplicatePenalty;
  }

  function shouldAdmit(record: SimplifiedAlertRecord, admissionScore: number): boolean {
    // Always admit high-priority emergency alerts
    if (record.priority >= 8 && record.severity >= 4) {
      return true;
    }

    // Check if already in admission window
    if (admissionWindow.has(record.id)) {
      return admissionScore > 0.5;
    }

    // Add to admission window for tracking
    if (admissionWindow.size >= admissionWindowSize) {
      const oldest = Array.from(admissionWindow)[0];
      if (oldest) {
        admissionWindow.delete(oldest);
      }
    }
    admissionWindow.add(record.id);

    // Check frequency against victim
    if (alertCache.size >= maxItems) {
      const victimKey = findEvictionVictim();
      if (victimKey) {
        const victimFreq = frequencySketch.estimate(victimKey);
        const candidateFreq = frequencySketch.estimate(record.id);
        
        return candidateFreq > victimFreq || admissionScore > 0.7;
      }
    }

    return admissionScore > 0.6;
  }

  function findEvictionVictim(): string | null {
    if (alertLRU.length === 0) return null;

    let victimKey = alertLRU[0];
    let lowestScore = getEvictionScore(victimKey);

    for (let i = 1; i < Math.min(alertLRU.length, 5); i++) {
      const key = alertLRU[i];
      const score = getEvictionScore(key);
      
      if (score < lowestScore) {
        lowestScore = score;
        victimKey = key;
      }
    }

    return victimKey;
  }

  function getEvictionScore(key: string): number {
    const frequency = frequencySketch.estimate(key);
    const record = alertCache.get(key);
    const now = Date.now();
    const timeSinceAccess = now - (record?.lastAccessed || 0);
    const priority = record?.priority || 0;
    
    return frequency * 0.5 + 
           Math.max(0, 1000 - timeSinceAccess / 1000) * 0.3 + 
           priority * 0.2;
  }

  function updateLRU(key: string): void {
    const index = alertLRU.indexOf(key);
    if (index > -1) {
      alertLRU.splice(index, 1);
    }
    alertLRU.push(key);
  }

  function removeFromLRU(key: string): void {
    const index = alertLRU.indexOf(key);
    if (index > -1) {
      alertLRU.splice(index, 1);
    }
  }

  function checkDuplicate(alert: Alert): boolean {
    const alertBounds = getPolygonBounds(alert.polygon);
    
    for (const [_, record] of alertCache) {
      if (record.alertType === alert.urgency && 
          record.area === alertBounds) {
        const timeDiff = Math.abs(Date.now() - record.receivedAt);
        if (timeDiff < 60000) { // Within 1 minute
          return true;
        }
      }
    }
    return false;
  }

  return {
    name: 'paf-tinylfu-sim',
    
    get(key: string, _now: number): CacheEntry | undefined {
      const cached = syncCache.get(key);
      if (cached) {
        hitCount++;
        const alertId = key.replace('alert:', '');
        const alertKey = `alert-${alertId}`;
        const record = alertCache.get(alertKey);
        
        if (record) {
          record.lastAccessed = Date.now();
          record.accessCount++;
          frequencySketch.increment(alertKey);
          updateLRU(alertKey);
        }
        
        return cached;
      }
      
      missCount++;
      return undefined;
    },

    put(entry: CacheEntry, _now: number): void {
      const alertId = entry.key.replace('alert:', '');
      
      // Create Alert object from CacheEntry
      const alert: Alert = {
        id: alertId,
        polygon: [],
        sizeBytes: entry.bytes,
        issuedAt: entry.putAt,
        expireAt: entry.putAt + entry.ttlMs,
        urgency: entry.priority > 7 ? 'Immediate' : 'Expected',
        severity: entry.priority > 8 ? 'Extreme' : entry.priority > 5 ? 'Severe' : 'Moderate'
      };
      
      const priority = calculatePriority(alert);
      const severityScore = getSeverityScore(alert.severity);
      const area = getPolygonBounds(alert.polygon);
      
      const alertRecord: SimplifiedAlertRecord = {
        id: `alert-${alert.id}`,
        alertId: alert.id,
        alertType: alert.urgency,
        priority: priority,
        severity: severityScore,
        area: area,
        receivedAt: Date.now(),
        expiresAt: alert.expireAt,
        lastAccessed: Date.now(),
        accessCount: 1,
        size: alert.sizeBytes,
        isDuplicate: checkDuplicate(alert)
      };

      // Check admission
      const admissionScore = calculateAdmissionScore(alertRecord);
      if (!shouldAdmit(alertRecord, admissionScore)) {
        return; // Rejected
      }

      // Evict if necessary
      while (alertCache.size >= maxItems) {
        const victimKey = findEvictionVictim();
        if (victimKey) {
          alertCache.delete(victimKey);
          syncCache.delete(`alert:${victimKey.replace('alert-', '')}`);
          removeFromLRU(victimKey);
          evictionCount++;
        } else {
          break;
        }
      }

      // Store
      alertCache.set(alertRecord.id, alertRecord);
      syncCache.set(entry.key, entry);
      updateLRU(alertRecord.id);
      frequencySketch.increment(alertRecord.id);
    },

    evictIfNeeded(_now: number): void {
      // Handled internally during put
    },

    sizeBytes(): number {
      let totalBytes = 0;
      for (const entry of syncCache.values()) {
        totalBytes += entry.bytes;
      }
      return totalBytes;
    }
  };
}
