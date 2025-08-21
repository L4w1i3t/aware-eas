import { Alert } from '@sim/models/alert';
import { CachePolicy, CacheEntry } from '@sim/models/cache';
import { PAFTinyLFUCache } from './PAFTinyLFUCache';

/**
 * Bridge between PAFTinyLFU cache and existing CachePolicy interface
 * Converts between Alert objects and CacheEntry objects
 * Note: This bridges async PAF cache with sync CachePolicy interface
 */
export function pafTinyLFU(capacityBytes = 250_000): CachePolicy {
  const deviceId = `device_${Math.random().toString(36).substr(2, 9)}`;
  const pafCache = new PAFTinyLFUCache(deviceId, Math.floor(capacityBytes / 1000)); // Convert bytes to item count
  
  // Store for CacheEntry to Alert conversion and sync cache
  const entryStore = new Map<string, Alert>();
  const syncCache = new Map<string, CacheEntry>();

  return {
    name: 'paf-tinylfu',
    
    get(key: string, _now: number): CacheEntry | undefined {
      // Check sync cache first for immediate response
      const cached = syncCache.get(key);
      if (cached) {
        // Async update access tracking in background
        const alertId = key.replace('alert:', '');
        pafCache.get(alertId).catch(console.warn);
        return cached;
      }
      return undefined;
    },

    put(entry: CacheEntry, _now: number): void {
      // Extract alert ID from key
      const alertId = entry.key.replace('alert:', '');
      
      // Create Alert object from CacheEntry
      const alert: Alert = {
        id: alertId,
        polygon: [], // Empty polygon - would need to be restored from cache if needed
        sizeBytes: entry.bytes,
        issuedAt: entry.putAt,
        expireAt: entry.putAt + entry.ttlMs,
        urgency: entry.priority > 7 ? 'Immediate' : 'Expected',
        severity: entry.priority > 8 ? 'Extreme' : entry.priority > 5 ? 'Severe' : 'Moderate'
      };
      
      // Store in both sync cache and entry store
      syncCache.set(entry.key, entry);
      entryStore.set(alertId, alert);
      
      // Async put in PAF cache
      pafCache.put(alert).then(success => {
        if (!success) {
          // Remove from sync cache if PAF cache rejected it
          syncCache.delete(entry.key);
          entryStore.delete(alertId);
        }
      }).catch(console.warn);
    },

    evictIfNeeded(_now: number): void {
      // PAF-TinyLFU handles eviction internally during put operations
      // This is a no-op as the PAF cache manages its own eviction
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
