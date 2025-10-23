import type { RunResult } from '../sim/run';

type Props = {
  result: RunResult | null;
};

export default function PolicyDiagnostics({ result }: Props) {
  if (!result) return null;

  const timeline = result.timeline;
  const finalSample = timeline[timeline.length - 1];
  const maxCacheSize = Math.max(...timeline.map(s => s.cacheSize));
  const avgCacheSize = timeline.reduce((sum, s) => sum + s.cacheSize, 0) / timeline.length;
  
  // Calculate cache churn (how often cache size changes)
  let sizeChanges = 0;
  for (let i = 1; i < timeline.length; i++) {
    if (timeline[i].cacheSize !== timeline[i - 1].cacheSize) {
      sizeChanges++;
    }
  }
  const churnRate = sizeChanges / timeline.length;

  // Calculate when cache filled up
  let fillTime = null;
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].cacheSize >= 128) { // Assuming default cache size
      fillTime = timeline[i].t;
      break;
    }
  }

  // Distribution of cache sizes over time
  const sizeHistogram = new Map<number, number>();
  for (const sample of timeline) {
    sizeHistogram.set(sample.cacheSize, (sizeHistogram.get(sample.cacheSize) || 0) + 1);
  }
  const topSizes = Array.from(sizeHistogram.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h4>Policy Diagnostics</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Internal metrics to verify policy behavior and detect potential biases
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Final Cache Size</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{finalSample?.cacheSize ?? 0}</div>
        </div>
        
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Max Cache Size</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{maxCacheSize}</div>
        </div>
        
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Avg Cache Size</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{avgCacheSize.toFixed(1)}</div>
        </div>
        
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Cache Churn Rate</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{(churnRate * 100).toFixed(1)}%</div>
          <div className="muted" style={{ fontSize: 9 }}>size changes / samples</div>
        </div>
        
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Cache Fill Time</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {fillTime !== null ? `${fillTime.toFixed(0)}s` : 'Never'}
          </div>
        </div>

        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Total Requests</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {(finalSample?.hits ?? 0) + (finalSample?.misses ?? 0)}
          </div>
        </div>

        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Alerts Issued</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{result.issuedAlerts.length}</div>
        </div>

        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Alerts Delivered</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{result.deliveredAlerts.length}</div>
        </div>

        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Dropped Alerts</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {result.issuedAlerts.length - result.deliveredAlerts.length}
          </div>
        </div>
      </div>

      {/* Cache size distribution */}
      <div style={{ marginTop: 16 }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Cache Size Distribution</h5>
        <div style={{ fontSize: 12 }}>
          {topSizes.map(([size, count]) => {
            const pct = (count / timeline.length) * 100;
            return (
              <div key={size} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>Size {size}:</span>
                  <span>{pct.toFixed(1)}% ({count} samples)</span>
                </div>
                <div style={{ 
                  height: 4, 
                  background: '#2a3b63', 
                  borderRadius: 2,
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${pct}%`, 
                    background: '#5bc0be'
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interpretation guide */}
      <details style={{ marginTop: 12, fontSize: 12 }}>
        <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>
          How to interpret these metrics
        </summary>
        <div style={{ marginTop: 8, color: '#9fb3d9', lineHeight: 1.6 }}>
          <p><strong>Cache Churn Rate:</strong> High churn (&gt;10%) means the policy is actively evicting. Low churn means the cache rarely fills.</p>
          <p><strong>Cache Fill Time:</strong> When cache first reaches capacity. If "Never", cache is too large for workload.</p>
          <p><strong>Cache Size Distribution:</strong> If one size dominates (&gt;80%), the cache is either always full or always empty - policies may not differ.</p>
          <p><strong>Dropped Alerts:</strong> If this matches between policies, the workload is deterministic and not testing admission decisions.</p>
        </div>
      </details>

      {/* Warnings */}
      {churnRate < 0.05 && (
        <div style={{ 
          marginTop: 12, 
          padding: 12, 
          background: '#2a1810', 
          border: '1px solid #ff6b6b',
          borderRadius: 4,
          fontSize: 13
        }}>
          <div style={{ fontWeight: 600, color: '#ff8787', marginBottom: 4 }}>Low Cache Pressure</div>
          <div style={{ color: '#ffb3b3' }}>
            Cache churn is very low ({(churnRate * 100).toFixed(1)}%). 
            This means the cache rarely evicts, so different policies may perform similarly.
            Try reducing cache size or increasing alert volume to stress-test policies.
          </div>
        </div>
      )}

      {avgCacheSize < 50 && maxCacheSize < 100 && (
        <div style={{ 
          marginTop: 12, 
          padding: 12, 
          background: '#2a1810', 
          border: '1px solid #ff6b6b',
          borderRadius: 4,
          fontSize: 13
        }}>
          <div style={{ fontWeight: 600, color: '#ff8787', marginBottom: 4 }}>Cache Underutilization</div>
          <div style={{ color: '#ffb3b3' }}>
            Average cache size is only {avgCacheSize.toFixed(0)}, well below capacity. 
            Policies may not have opportunities to make different eviction decisions.
            Consider increasing alert volume or reducing TTLs.
          </div>
        </div>
      )}
    </div>
  );
}
