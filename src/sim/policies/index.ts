export { lru } from './lru';
export { priorityFresh } from './priorityFresh';
export { ttlOnly } from './ttlOnly';
export { pafTinyLFU } from './pafTinyLFUBridge';
export { pafTinyLFUSim } from './pafTinyLFUSim';
export { PAFTinyLFUCache } from './PAFTinyLFUCache';
export { FrequencySketch } from './frequency-sketch';

export type CachePolicyType = 'lru' | 'priority-fresh' | 'ttl-only' | 'paf-tinylfu' | 'paf-tinylfu-sim';
