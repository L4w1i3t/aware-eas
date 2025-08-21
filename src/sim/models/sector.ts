export interface SectorParams { id: number; mbps: number; degraded: boolean; rttMs: number; drop: number; }
export class Sector {
  id!: number; mbps!: number; degraded!: boolean; rttMs!: number; drop!: number;
  constructor(p: SectorParams){ Object.assign(this,p); }
  // naive transfer time: size/throughput + RTT; no queueing yet
  transferMs(bytes: number) {
    const throughputBps = this.mbps * 125000;
    return this.rttMs + Math.ceil(bytes / throughputBps * 1000);
  }
  shouldDrop(rand: ()=>number) { return rand() < this.drop; }
}
