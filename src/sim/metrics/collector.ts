import { quantile } from './quantiles';
import type { DeviceSample, Metrics } from './types';

export function summarize(samples: DeviceSample[]): Metrics {
  const inside = samples.filter(s=>s.inside);
  const outside = samples.filter(s=>!s.inside);
  const gotIn = inside.filter(s=>s.receivedAt!==undefined);
  const gotOut = outside.filter(s=>s.receivedAt!==undefined);
  const coverageIn = gotIn.length / Math.max(1, inside.length);
  const overshoot = gotOut.length / Math.max(1, outside.length);
  const missRate = 1 - coverageIn;

  // Filter out invalid latencies (negative or undefined)
  const validLatencies = gotIn
    .map(s => s.latency)
    .filter((lat): lat is number => lat !== undefined && lat >= 0)
    .sort((a,b) => a-b);
  
  // Debug: Log first few latencies to see what we're getting
  if (validLatencies.length > 0) {
    const sampleLatencies = validLatencies.slice(0, 5);
    console.log(`Debug: Sample latencies: [${sampleLatencies.join(', ')}]ms`);
    console.log(`Debug: Total valid latencies: ${validLatencies.length}, min: ${validLatencies[0]}, max: ${validLatencies[validLatencies.length-1]}`);
  } else {
    console.log('Debug: No valid latencies found!');
  }
  
  const latencyP50 = validLatencies.length > 0 ? quantile(validLatencies, 0.5) : 0;
  const latencyP95 = validLatencies.length > 0 ? quantile(validLatencies, 0.95) : 0;

  const hits = samples.reduce((a,s)=>a+s.hits,0);
  const reads = samples.reduce((a,s)=>a+s.reads,0);
  const hitRate = reads ? hits/reads : 0;

  const freshnessVals = samples.flatMap(s=>s.freshnessAtRead);
  const freshnessMean = freshnessVals.length ? freshnessVals.reduce((a,b)=>a+b,0)/freshnessVals.length : 0;
  const staleRate = freshnessVals.length ? freshnessVals.filter(v=>v>5*60_000).length / freshnessVals.length : 0; // >5min old

  const bytesPerDevice = samples.reduce((a,s)=>a+s.bytes,0) / Math.max(1,samples.length);

  return { coverageIn, overshoot, missRate, latencyP50, latencyP95, hitRate, freshnessMean, staleRate, bytesPerDevice };
}
