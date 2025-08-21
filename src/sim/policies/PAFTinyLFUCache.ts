import { Alert } from '@sim/models/alert';
import { FrequencySketch } from './frequency-sketch';
// Note: Database imports removed for simulation mode - keeping cache in memory only

// Local type definitions for simulation mode
interface AlertRecord {
  id: string;
  alertId: string;
  alertType: string;
  priority: number;
  severity: number;
  area: string[];
  receivedAt: number;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  isDuplicate: boolean;
  shelterInfo?: string[];
}

interface ShelterRecord {
  id: string;
  shelterId: string;
  location: { lat: number; lon: number };
  capacity: number;
  currentOccupancy: number;
  lastUpdated: number;
  alertContext: string;
  size: number;
}

/**
 * Priority-Aware Freshness TinyLFU Cache Implementation
 * Combines priority-based admission with TinyLFU frequency tracking
 * Features segmented storage for alerts and shelter info with duplicate suppression
 */
export class PAFTinyLFUCache {
  private maxSize: number;
  private frequencySketch: FrequencySketch;
  
  // Segmented storage
  private alertSegment: Map<string, AlertRecord>;
  private shelterSegment: Map<string, ShelterRecord>;
  private alertSegmentMaxSize: number;
  
  // LRU tracking for segments
  private alertLRU: string[];
  private shelterLRU: string[];
  
  // Admission window for new items
  private admissionWindow: Set<string>;
  private admissionWindowSize: number = 100;
  
  // Metrics
  private hitCount: number = 0;
  private missCount: number = 0;
  private evictionCount: number = 0;

  constructor(_deviceId: string, maxSize: number) {
    // Note: _deviceId parameter kept for interface compatibility but not used in simulation mode
    this.maxSize = maxSize;
    this.frequencySketch = new FrequencySketch(maxSize);
    
    // Allocate 70% to alerts, 30% to shelter info
    this.alertSegmentMaxSize = Math.floor(maxSize * 0.7);
    
    this.alertSegment = new Map();
    this.shelterSegment = new Map();
    this.alertLRU = [];
    this.shelterLRU = [];
    this.admissionWindow = new Set();
    
    this.loadFromDatabase();
  }

  /**
   * Store an alert with priority-aware admission control
   */
  async put(alert: Alert): Promise<boolean> {
    // Convert Alert interface to AlertRecord with derived properties
    const priority = this.calculatePriority(alert);
    const severityScore = this.getSeverityScore(alert.severity);
    const area = this.getPolygonBounds(alert.polygon);
    
    const alertRecord: AlertRecord = {
      id: `alert-${alert.id}`,
      alertId: alert.id,
      alertType: alert.urgency, // Use urgency as type
      priority: priority,
      severity: severityScore,
      area: [area], // Convert bounds to area array
      receivedAt: Date.now(),
      expiresAt: alert.expireAt,
      lastAccessed: Date.now(),
      accessCount: 1,
      size: alert.sizeBytes,
      isDuplicate: this.checkDuplicate(alert),
      shelterInfo: [] // No shelter info in base Alert model
    };

    // Skip duplicates unless higher priority
    if (alertRecord.isDuplicate) {
      const existing = this.findExistingAlert(alert);
      if (existing && existing.priority >= priority) {
        return false;
      }
    }

    // Calculate admission score
    const admissionScore = this.calculateAdmissionScore(alertRecord);
    
    // Check if we should admit this alert
    if (!this.shouldAdmit(alertRecord, admissionScore)) {
      return false;
    }

    // Store alert
    await this.storeAlert(alertRecord);

    await this.persistToDatabase();
    return true;
  }

  /**
   * Retrieve an alert and update access tracking
   */
  async get(alertId: string): Promise<AlertRecord | null> {
    const key = `alert-${alertId}`;
    const record = this.alertSegment.get(key);
    
    if (record) {
      this.hitCount++;
      record.lastAccessed = Date.now();
      record.accessCount++;
      this.frequencySketch.increment(key);
      this.updateLRU(this.alertLRU, key);
      await this.persistToDatabase();
      return record;
    }
    
    this.missCount++;
    return null;
  }

  /**
   * Get shelter information for an alert context
   */
  async getShelterInfo(alertContext: string): Promise<ShelterRecord[]> {
    const shelters: ShelterRecord[] = [];
    
    for (const [key, record] of this.shelterSegment) {
      if (record.alertContext === alertContext) {
        shelters.push(record);
        this.frequencySketch.increment(key);
        this.updateLRU(this.shelterLRU, key);
      }
    }
    
    if (shelters.length > 0) {
      this.hitCount++;
      await this.persistToDatabase();
    } else {
      this.missCount++;
    }
    
    return shelters;
  }

  /**
   * Calculate priority-aware admission score
   */
  private calculateAdmissionScore(record: AlertRecord): number {
    const now = Date.now();
    const timeToExpiry = record.expiresAt - now;
    const maxTTL = 24 * 60 * 60 * 1000; // 24 hours
    
    // Freshness score (0-1, higher for fresher content)
    const freshnessScore = Math.min(1, timeToExpiry / maxTTL);
    
    // Priority score (0-1, normalized priority)
    const priorityScore = Math.min(1, record.priority / 10);
    
    // Severity score (0-1, normalized severity)
    const severityScore = Math.min(1, record.severity / 5);
    
    // Size penalty (smaller items preferred)
    const sizePenalty = Math.min(1, record.size / 1000);
    
    // Duplicate penalty
    const duplicatePenalty = record.isDuplicate ? 0.5 : 1.0;
    
    // Combined score with weights
    return (priorityScore * 0.4 + 
            severityScore * 0.3 + 
            freshnessScore * 0.2 + 
            (1 - sizePenalty) * 0.1) * duplicatePenalty;
  }

  /**
   * Determine if an alert should be admitted to cache
   */
  private shouldAdmit(record: AlertRecord, admissionScore: number): boolean {
    // Always admit high-priority emergency alerts
    if (record.priority >= 8 && record.severity >= 4) {
      return true;
    }

    // Check if already in admission window
    if (this.admissionWindow.has(record.id)) {
      return admissionScore > 0.5;
    }

    // Add to admission window for tracking
    if (this.admissionWindow.size >= this.admissionWindowSize) {
      const oldest = Array.from(this.admissionWindow)[0];
      if (oldest) {
        this.admissionWindow.delete(oldest);
      }
    }
    this.admissionWindow.add(record.id);

    // Check frequency against victim
    if (this.alertSegment.size >= this.alertSegmentMaxSize) {
      const victimKey = this.findEvictionVictim('alert');
      if (victimKey) {
        const victimFreq = this.frequencySketch.estimate(victimKey);
        const candidateFreq = this.frequencySketch.estimate(record.id);
        
        // Admit if candidate has higher frequency or significantly higher score
        return candidateFreq > victimFreq || admissionScore > 0.7;
      }
    }

    return admissionScore > 0.6;
  }

  /**
   * Store alert record in cache
   */
  private async storeAlert(record: AlertRecord): Promise<void> {
    // Evict if necessary
    while (this.alertSegment.size >= this.alertSegmentMaxSize) {
      const victimKey = this.findEvictionVictim('alert');
      if (victimKey) {
        this.alertSegment.delete(victimKey);
        this.removeFromLRU(this.alertLRU, victimKey);
        this.evictionCount++;
      } else {
        break;
      }
    }

    this.alertSegment.set(record.id, record);
    this.updateLRU(this.alertLRU, record.id);
    this.frequencySketch.increment(record.id);
  }

  /**
   * Calculate priority score based on alert properties
   */
  private calculatePriority(alert: Alert): number {
    let priority = 5; // Base priority
    
    // Higher priority for extreme severity
    if (alert.severity === 'Extreme') {
      priority += 4;
    } else if (alert.severity === 'Severe') {
      priority += 2;
    }
    
    // Higher priority for immediate urgency
    if (alert.urgency === 'Immediate') {
      priority += 1;
    }
    
    return Math.min(10, priority);
  }

  /**
   * Convert severity string to numeric score
   */
  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'Extreme': return 5;
      case 'Severe': return 3;
      case 'Moderate': return 1;
      default: return 0;
    }
  }

  /**
   * Get bounding box string from polygon
   */
  private getPolygonBounds(polygon: [number, number][]): string {
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

  /**
   * Find victim for eviction using frequency and recency
   */
  private findEvictionVictim(segment: 'alert' | 'shelter'): string | null {
    const lru = segment === 'alert' ? this.alertLRU : this.shelterLRU;
    const cache = segment === 'alert' ? this.alertSegment : this.shelterSegment;
    
    if (lru.length === 0) return null;

    // Find LRU item with lowest frequency
    let victimKey = lru[0];
    let lowestScore = this.getEvictionScore(victimKey, cache.get(victimKey));

    for (let i = 1; i < Math.min(lru.length, 5); i++) { // Check top 5 LRU items
      const key = lru[i];
      const record = cache.get(key);
      const score = this.getEvictionScore(key, record);
      
      if (score < lowestScore) {
        lowestScore = score;
        victimKey = key;
      }
    }

    return victimKey;
  }

  /**
   * Calculate eviction score (lower means more likely to evict)
   */
  private getEvictionScore(key: string, record: any): number {
    const frequency = this.frequencySketch.estimate(key);
    const now = Date.now();
    const timeSinceAccess = now - (record?.lastAccessed || 0);
    const priority = record?.priority || 0;
    
    // Higher frequency, recent access, and priority increase score
    return frequency * 0.5 + 
           Math.max(0, 1000 - timeSinceAccess / 1000) * 0.3 + 
           priority * 0.2;
  }

  /**
   * Check if alert is duplicate
   */
  private checkDuplicate(alert: Alert): boolean {
    const alertBounds = this.getPolygonBounds(alert.polygon);
    
    for (const [_, record] of this.alertSegment) {
      if (record.alertType === alert.urgency && 
          record.area.includes(alertBounds)) {
        const timeDiff = Math.abs(Date.now() - record.receivedAt);
        if (timeDiff < 60000) { // Within 1 minute
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find existing alert for duplicate checking
   */
  private findExistingAlert(alert: Alert): AlertRecord | null {
    const alertBounds = this.getPolygonBounds(alert.polygon);
    
    for (const [_, record] of this.alertSegment) {
      if (record.alertType === alert.urgency && 
          record.area.includes(alertBounds)) {
        const timeDiff = Math.abs(Date.now() - record.receivedAt);
        if (timeDiff < 60000) {
          return record;
        }
      }
    }
    return null;
  }

  /**
   * Update LRU order
   */
  private updateLRU(lru: string[], key: string): void {
    const index = lru.indexOf(key);
    if (index > -1) {
      lru.splice(index, 1);
    }
    lru.push(key);
  }

  /**
   * Remove from LRU order
   */
  private removeFromLRU(lru: string[], key: string): void {
    const index = lru.indexOf(key);
    if (index > -1) {
      lru.splice(index, 1);
    }
  }

  /**
   * Load cache state from database (optional for simulation)
   */
  private async loadFromDatabase(): Promise<void> {
    try {
      // Skip database loading for simulation - start fresh each time
      console.debug('PAFTinyLFU cache starting fresh (simulation mode)');
    } catch (error) {
      console.warn('Failed to load cache from database:', error);
    }
  }

  /**
   * Persist cache state to database (optional for simulation)
   */
  private async persistToDatabase(): Promise<void> {
    try {
      // Skip database persistence for simulation - keep everything in memory
      console.debug('PAFTinyLFU cache persistence skipped (simulation mode)');
    } catch (error) {
      console.warn('Failed to persist cache to database:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.alertSegment.size + this.shelterSegment.size,
      alertCount: this.alertSegment.size,
      shelterCount: this.shelterSegment.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: this.evictionCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      admissionWindowSize: this.admissionWindow.size
    };
  }

  /**
   * Clear cache
   */
  async clear(): Promise<void> {
    this.alertSegment.clear();
    this.shelterSegment.clear();
    this.alertLRU = [];
    this.shelterLRU = [];
    this.admissionWindow.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    this.frequencySketch = new FrequencySketch(this.maxSize);
    
    // Skip database operations for simulation
    console.debug('PAFTinyLFU cache cleared (simulation mode)');
  }
}
