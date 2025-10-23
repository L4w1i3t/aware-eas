import { useMemo } from 'react';
import type { Alert } from '../sim/types';
import type { RunResult } from '../sim/run';

type Props = {
  result: RunResult;
};

type TimelineEvent = {
  time: number;
  alert: Alert;
  severity: Alert['severity'];
  urgency: Alert['urgency'];
  region: string;
};

export default function AlertTimeline({ result }: Props) {
  const events = useMemo(() => {
    return result.issuedAlerts.map(alert => ({
      time: alert.issuedAt,
      alert,
      severity: alert.severity,
      urgency: alert.urgency,
      region: alert.regionId ?? alert.geokey ?? 'unknown',
    })).sort((a, b) => a.time - b.time);
  }, [result]);

  const timeRange = useMemo(() => {
    if (events.length === 0) return { min: 0, max: 100 };
    const maxTime = Math.max(...result.timeline.map(s => s.t), ...events.map(e => e.time));
    return { min: 0, max: maxTime };
  }, [events, result.timeline]);

  const alertsByRegion = useMemo(() => {
    const byRegion = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      if (!byRegion.has(event.region)) {
        byRegion.set(event.region, []);
      }
      byRegion.get(event.region)!.push(event);
    }
    return Array.from(byRegion.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [events]);

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'Extreme': return '#dc2626';
      case 'Severe': return '#f59e0b';
      case 'Moderate': return '#eab308';
      case 'Minor': return '#84cc16';
      default: return '#64748b';
    }
  };

  const getUrgencyLabel = (urgency: Alert['urgency']) => {
    switch (urgency) {
      case 'Immediate': return 'IMM';
      case 'Expected': return 'EXP';
      case 'Future': return 'FUT';
      case 'Past': return 'PST';
      default: return '';
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (events.length === 0) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <h4>Alert Timeline</h4>
        <div className="muted">No alerts issued in this run.</div>
      </div>
    );
  }

  const finalSample = result.timeline[result.timeline.length - 1];
  const cacheHits = finalSample?.hits ?? 0;
  const cacheMisses = finalSample?.misses ?? 0;

  // SVG dimensions - use fixed width for proper scaling
  const svgWidth = 1200;
  const svgHeight = Math.min(events.length * 18 + 60, 500);
  const margin = { top: 40, right: 120, bottom: 20, left: 80 };
  const plotWidth = svgWidth - margin.left - margin.right;

  const toX = (time: number) => {
    return margin.left + ((time - timeRange.min) / (timeRange.max - timeRange.min)) * plotWidth;
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h4>Alert Timeline & Regional Distribution</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Chronological view of all {events.length} alerts over {formatTime(timeRange.max)}
      </div>

      {/* Alert Distribution by Region */}
      <div style={{ marginBottom: 12 }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Top Regions by Alert Count</h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {alertsByRegion.slice(0, 10).map(([region, regionEvents]) => (
            <div key={region} className="stat-card" style={{ padding: 8 }}>
              <div className="muted" style={{ fontSize: 10 }}>{region}</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{regionEvents.length}</div>
              <div className="muted" style={{ fontSize: 9 }}>
                {regionEvents.filter(e => e.severity === 'Extreme' || e.severity === 'Severe').length} high
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline visualization */}
      <div style={{ 
        overflowX: 'auto', 
        overflowY: events.length > 25 ? 'auto' : 'visible',
        maxHeight: events.length > 25 ? 500 : undefined,
        border: '1px solid #2a3b63', 
        borderRadius: 4, 
        background: '#0b132b' 
      }}>
        <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
          {/* Time axis */}
          <line 
            x1={margin.left} 
            y1={margin.top} 
            x2={svgWidth - margin.right} 
            y2={margin.top} 
            stroke="#2a3b63" 
            strokeWidth={2} 
          />
          
          {/* Time markers with grid lines */}
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((frac, i) => {
            const t = timeRange.min + frac * (timeRange.max - timeRange.min);
            const x = toX(t);
            return (
              <g key={i}>
                <line x1={x} y1={margin.top - 5} x2={x} y2={margin.top + 5} stroke="#64748b" strokeWidth={1} />
                <line x1={x} y1={margin.top} x2={x} y2={svgHeight - margin.bottom} stroke="#1e293b" strokeWidth={1} strokeDasharray="2,3" opacity={0.3} />
                <text x={x} y={margin.top - 10} fill="#94a3b8" fontSize={11} textAnchor="middle">
                  {formatTime(t)}
                </text>
              </g>
            );
          })}

          {/* Alert events */}
          {events.map((event, i) => {
            const x = toX(event.time);
            const y = margin.top + 10 + i * 18;
            const sevColor = getSeverityColor(event.severity);

            return (
              <g key={i}>
                {/* Dot */}
                <circle cx={x} cy={y} r={4} fill={sevColor} stroke="#0b132b" strokeWidth={1.5} />
                
                {/* Region label on left */}
                <text x={margin.left - 10} y={y + 4} fill="#94a3b8" fontSize={10} textAnchor="end">
                  {event.region}
                </text>
                
                {/* Severity and urgency on right */}
                <text x={svgWidth - margin.right + 10} y={y + 4} fill="#e0e6f2" fontSize={9} textAnchor="start">
                  {event.severity.substring(0, 3).toUpperCase()} / {getUrgencyLabel(event.urgency)}
                </text>
                
                {/* Connection line from left margin to dot */}
                <line x1={margin.left} y1={y} x2={x - 4} y2={y} stroke={sevColor} strokeWidth={0.5} opacity={0.3} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626' }} />
          <span className="muted">Extreme</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
          <span className="muted">Severe</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }} />
          <span className="muted">Moderate</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#84cc16' }} />
          <span className="muted">Minor</span>
        </div>
      </div>

      {/* Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 12 }}>
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Total Alerts</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{result.issuedAlerts.length}</div>
        </div>
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Delivered</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#22c55e' }}>
            {result.deliveredAlerts.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Cache Hits</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#3b82f6' }}>
            {cacheHits}
          </div>
        </div>
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Cache Misses</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#ef4444' }}>
            {cacheMisses}
          </div>
        </div>
        <div className="stat-card">
          <div className="muted" style={{ fontSize: 11 }}>Hit Rate</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {((result.metrics.cacheHitRate ?? 0) * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
