import type { CachePolicy } from './cache';
import { Sector } from './sector';
import type { Alert } from './alert';
import { NetworkState, NETWORK_CONDITIONS } from './NetworkState';

export interface DeviceParams {
  id: number;
  lon: number; lat: number; // degrees
  sector: Sector;
  cache: CachePolicy;
}

export class Device {
  id!: number; lon!: number; lat!: number; sector!: Sector; cache!: CachePolicy;
  bytes = 0; hits = 0; reads = 0; receivedAt?: number; freshnessAtRead: number[] = [];
  private networkState: NetworkState = NetworkState.STABLE;
  
  constructor(p: DeviceParams){ Object.assign(this,p); }

  // Enhanced constructor for harness
  static create(id: string, sectorType: 'urban' | 'suburban' | 'rural'): Device {
    // Create a basic sector for simulation harness
    const sectorObj = new Sector({
      id: parseInt(id.split('_')[1]) || 0,
      mbps: sectorType === 'urban' ? 100 : sectorType === 'suburban' ? 50 : 25,
      degraded: false,
      rttMs: sectorType === 'urban' ? 20 : sectorType === 'suburban' ? 40 : 80,
      drop: 0.01
    });
    
    const basicCache: CachePolicy = {
      name: 'basic',
      get: () => undefined,
      put: () => {},
      evictIfNeeded: () => {},
      sizeBytes: () => 0
    };
    
    const device = new Device({
      id: parseInt(id.split('_')[1]) || 0,
      lon: 0,
      lat: 0,
      sector: sectorObj,
      cache: basicCache
    });
    
    // Store sector type for harness
    (device as any).sectorType = sectorType;
    
    return device;
  }

  // Network state management
  setNetworkState(state: NetworkState): void {
    this.networkState = state;
  }

  getNetworkState(): NetworkState {
    return this.networkState;
  }

  getId(): string {
    return `device_${this.id}`;
  }

  getSector(): string {
    return (this as any).sectorType || 'unknown';
  }

  // Check if device can receive alerts based on network state
  canReceiveAlert(): boolean {
    return this.networkState !== NetworkState.DISCONNECTED;
  }

  // Get effective latency based on network conditions
  getEffectiveLatency(): number {
    const conditions = NETWORK_CONDITIONS[this.networkState];
    return conditions.latencyMs;
  }

  // Simulate packet loss
  shouldDropPacket(rng: () => number): boolean {
    const conditions = NETWORK_CONDITIONS[this.networkState];
    return rng() < conditions.packetLossRate;
  }

  inside(polygon: [number,number][]) { return pointInPolygon([this.lon,this.lat], polygon); }

  async receiveAlert(alert: Alert, now: number, rand: ()=>number) {
    // try cache first
    const key = `alert:${alert.id}`;
    const hit = this.cache.get(key, now);
    if (hit) {
      this.hits++; this.reads++;
      this.freshnessAtRead.push(now - hit.putAt);
      if (this.receivedAt===undefined) this.receivedAt = now; // first time we "had" it
      return { cacheHit: true };
    }
    this.reads++;
    // simulate network transfer
    if (this.sector.shouldDrop(rand)) return { cacheHit:false, dropped:true };
    const transferTime = this.sector.transferMs(alert.sizeBytes);
    const networkLatency = this.getEffectiveLatency(); // Add device network latency
    const recvAt = now + transferTime + networkLatency;
    this.bytes += alert.sizeBytes;
    // store to cache
    this.cache.put({ key, bytes: alert.sizeBytes, putAt: recvAt, priority: priorityScore(alert, this), ttlMs: ttlFor(alert) }, recvAt);
    this.freshnessAtRead.push(0);
    if (this.receivedAt===undefined) this.receivedAt = recvAt;
    return { cacheHit:false, dropped:false, recvAt };
  }
}

// --- tiny geometry helpers ---
function pointInPolygon(pt:[number,number], poly:[number,number][]) {
  let [x,y] = pt, inside=false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
    const intersect = ((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+1e-9)+xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function priorityScore(a: Alert, _d: Device) {
  // Base priority calculation to give meaningful differences
  let priority = 5; // Base priority
  
  // Severity contribution (0-4 points)
  if (a.severity === 'Extreme') priority += 4;
  else if (a.severity === 'Severe') priority += 2;
  else if (a.severity === 'Moderate') priority += 1;
  
  // Urgency contribution (0-1 points)
  if (a.urgency === 'Immediate') priority += 1;
  
  // Scale to 1-10 range for cache policies
  return Math.min(10, Math.max(1, priority));
}
function ttlFor(a: Alert){
  // More differentiated TTL values for better cache behavior testing
  if (a.severity === 'Extreme') return 3*60_000;   // 3 minutes - very short for urgent alerts
  if (a.severity === 'Severe') return 8*60_000;    // 8 minutes - medium duration  
  return 20*60_000;                                 // 20 minutes - longer for moderate alerts
}
