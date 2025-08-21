import { Clock } from '@sim/core/clock';
import { rng } from '@sim/core/rng';
import { summarize } from '@sim/metrics/collector';
import type { Scenario } from '@sim/scenarios/types';
import { Sector } from '@sim/models/sector';
import { Device } from '@sim/models/device';
import { NetworkState } from '@sim/models/NetworkState';
import type { CachePolicy } from '@sim/models/cache';
import type { DeviceSample } from '@sim/metrics/types';

export async function runSim({ scenario, policy, seed, timeScale=50 }:
  { scenario: Scenario, policy: (cap?:number)=>CachePolicy, seed: string, timeScale?: number }) {
  const clock = new Clock(timeScale);
  const R = rng(seed);

  // sectors
  const sectors: Sector[] = [];
  for (let i=0;i<scenario.sectors.count;i++){
    const degraded = (R() < scenario.sectors.degradedPct);
    sectors.push(new Sector({
      id: i,
      mbps: degraded? scenario.sectors.degradedMbps : scenario.sectors.mbps,
      degraded,
      rttMs: scenario.sectors.rttMs * (0.7 + 0.6*R()),
      drop: scenario.sectors.drop
    }));
  }

  // devices
  const samples: DeviceSample[] = [];
  const devices: Device[] = [];
  for (let i=0;i<scenario.devices;i++){
    const inside = i < scenario.devices * scenario.insideRatio;
    const [lon0,lat0] = jitterPoint(scenario.polygon, inside, R);
    const d = new Device({ id:i, lon: lon0, lat: lat0, sector: sectors[Math.floor(R()*sectors.length)], cache: policy(50_000) });
    
    // Assign random network state for realistic latency distribution
    const networkStates = [NetworkState.STABLE, NetworkState.CONGESTED, NetworkState.PARTIAL_OUTAGE];
    const randomNetworkState = networkStates[Math.floor(R() * networkStates.length)];
    d.setNetworkState(randomNetworkState);
    
    devices.push(d);
    samples.push({ inside, bytes:0, hits:0, reads:0, freshnessAtRead:[] });
  }

  // dispatch alerts
  for (const a of scenario.alerts){
    await clock.sleep(a.issuedAt - clock.now());
    console.log(`Dispatching alert ${a.id} at ${clock.now()}ms to devices in polygon`);
    
    // Store re-request events to process later
    const reRequestEvents: Array<{device: Device, alertTime: number, reRequestTime: number}> = [];
    
    // Only send alerts to devices that are inside the alert polygon
    let devicesInAlert = 0;
    for (let i=0;i<devices.length;i++){
      const d = devices[i];
      
      // Check if device is inside alert polygon
      if (d.inside(a.polygon)) {
        devicesInAlert++;
        const alertStartTime = clock.now();
        const result = await d.receiveAlert(a, alertStartTime, R);
        
        // Calculate latency for THIS specific alert only
        if (result.recvAt !== undefined) {
          // Device received the alert via network - calculate actual latency
          samples[i].latency = result.recvAt - alertStartTime;
        } else if (result.cacheHit) {
          // Cache hit - minimal latency (just device network latency)
          samples[i].latency = d.getEffectiveLatency();
        }
        // If dropped, don't set latency for this alert
        
        // Schedule re-requests for cache testing (30% chance to request again after 1-5 minutes)
        if (!result.dropped && R() < 0.3) {
          const reRequestDelay = 60_000 + R() * 4 * 60_000; // 1-5 minutes
          reRequestEvents.push({
            device: d,
            alertTime: clock.now(),
            reRequestTime: clock.now() + reRequestDelay
          });
        }
      }
      
      // Update samples for all devices (even those not receiving this alert)
      samples[i].bytes = d.bytes;
      samples[i].hits = d.hits;
      samples[i].reads = d.reads;
      samples[i].freshnessAtRead = d.freshnessAtRead;
      if (d.receivedAt !== undefined) samples[i].receivedAt = d.receivedAt;
    }
    
    console.log(`Alert ${a.id} sent to ${devicesInAlert} devices, ${reRequestEvents.length} re-requests scheduled`);
    
    // Process re-requests without advancing global clock
    for (const reRequest of reRequestEvents) {
      // Simulate re-request at the scheduled time
      await reRequest.device.receiveAlert(a, reRequest.reRequestTime, R);
    }
  }

  const summary = summarize(samples);
  return { summary, samples };
}

// --- helpers ---
function bbox(poly: [number,number][]) {
  const xs = poly.map(p=>p[0]), ys = poly.map(p=>p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function jitterPoint(poly:[number,number][], inside:boolean, R:()=>number): [number,number]{
  const [minx,miny,maxx,maxy] = bbox(poly);
  for (let k=0;k<1000;k++){
    const x = minx + (maxx-minx)*R();
    const y = miny + (maxy-miny)*R();
    const pt:[number,number]=[x,y];
    const inPoly = pointInPolygon(pt, poly);
    if ((inside && inPoly) || (!inside && !inPoly)) return pt;
  }
  return [minx, miny];
}
function pointInPolygon(pt:[number,number], poly:[number,number][]) {
  let [x,y] = pt, inside=false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
    const intersect = ((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+1e-9)+xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
