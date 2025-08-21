import type { CacheEntry, CachePolicy } from '@sim/models/cache';

interface EnhancedCacheEntry extends CacheEntry {
  redundancyCount: number;
  lastAccessed: number;
  accessCount: number;
}

export function priorityFresh(capacityBytes = 50_000): CachePolicy {
  const items: EnhancedCacheEntry[] = [];
  let used = 0;
  
  // Enhanced scoring algorithm: α·priority + β·time-since-received - γ·redundancy
  function score(e: EnhancedCacheEntry, now: number) {
    const age = now - e.putAt;
    const freshness = e.ttlMs ? Math.max(0, 1 - age / e.ttlMs) : 1;
    const timeSinceReceived = age / (1000 * 60); // minutes
    
    // Weights for the research algorithm
    const α = 0.6; // priority weight
    const β = 0.3; // time weight  
    const γ = 0.4; // redundancy penalty
    
    const priorityScore = α * e.priority;
    const timeScore = β * Math.max(0, 1 - timeSinceReceived / 30); // decay over 30 min
    const redundancyPenalty = γ * e.redundancyCount;
    
    return priorityScore + timeScore - redundancyPenalty + 0.1 * freshness;
  }
  
  function evict(now: number) {
    // Sort by score, lowest first (for eviction)
    items.sort((a, b) => score(a, now) - score(b, now));
    
    while (used > capacityBytes && items.length) {
      const victim = items.shift()!; 
      used -= victim.bytes;
    }
  }

  function detectRedundancy(newEntry: CacheEntry): number {
    let redundancyCount = 0;
    
    for (const existing of items) {
      // Check for duplicate alerts (same base ID)
      const newId = newEntry.key.replace(/alert:/, '').replace(/_dup_\d+$/, '');
      const existingId = existing.key.replace(/alert:/, '').replace(/_dup_\d+$/, '');
      
      if (newId === existingId) {
        redundancyCount++;
        existing.redundancyCount++;
      }
      
      // Check for temporal redundancy (similar alerts within time window)
      const timeDiff = Math.abs(newEntry.putAt - existing.putAt);
      if (timeDiff < 5 * 60 * 1000 && newEntry.priority === existing.priority) {
        redundancyCount++;
      }
    }
    
    return redundancyCount;
  }
  
  return {
    name: 'PriorityFresh',
    get(key, now) {
      const e = items.find(x => x.key === key);
      if (!e) return undefined;
      
      // Update access statistics
      e.lastAccessed = now;
      e.accessCount++;
      
      return e;
    },
    put(e, now) { 
      // Convert to enhanced entry
      const redundancyCount = detectRedundancy(e);
      const enhancedEntry: EnhancedCacheEntry = {
        ...e,
        redundancyCount,
        lastAccessed: now,
        accessCount: 0
      };
      
      items.push(enhancedEntry); 
      used += e.bytes; 
      evict(now); 
    },
    evictIfNeeded(now) { 
      evict(now); 
    },
    sizeBytes() { 
      return used; 
    }
  };
}
