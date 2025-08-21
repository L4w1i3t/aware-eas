import type { CacheEntry, CachePolicy } from '@sim/models/cache';

export function ttlOnly(capacityBytes = 50_000): CachePolicy {
  const items: CacheEntry[] = [];
  let used = 0;
  
  function evict(now: number) {
    // First remove expired items
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (now - item.putAt > item.ttlMs) {
        used -= item.bytes;
        items.splice(i, 1);
      }
    }
    
    // If still over capacity, remove oldest items
    items.sort((a, b) => a.putAt - b.putAt); // oldest first
    while (used > capacityBytes && items.length) {
      const gone = items.shift()!;
      used -= gone.bytes;
    }
  }
  
  return {
    name: 'TTL-Only',
    get(key, now) {
      const e = items.find(x => x.key === key);
      if (!e) return;
      
      // Check if expired
      if (now - e.putAt > e.ttlMs) {
        const index = items.indexOf(e);
        items.splice(index, 1);
        used -= e.bytes;
        return;
      }
      
      return e;
    },
    put(e, now) { 
      items.push(e); 
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
