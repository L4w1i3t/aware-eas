import { useMemo, useState } from 'react';
import type { Alert } from '../sim/types';
import type { RunResult } from '../sim/run';
import type { RegionAnomalyHistory, RegionWeatherRecord, ScoreDetail } from '../sim/learning/pfModel';

type PFDecisionLog = {
  t: number;
  alert: Alert;
  score?: ScoreDetail;
  action: 'cached' | 'evicted' | 'dropped' | 'pushed';
  freshness: number;
};

type Props = {
  result: RunResult | null;
  weatherHistory?: Map<string, RegionWeatherRecord>;
  anomalyHistory?: Map<string, RegionAnomalyHistory>;
  decisionLog?: PFDecisionLog[];
};

export default function PFInspector({ result, weatherHistory, anomalyHistory, decisionLog }: Props) {
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [showWeights, setShowWeights] = useState(false);

  const recentDecisions = useMemo(() => {
    if (!decisionLog) return [];
    return decisionLog.slice(-20).reverse();
  }, [decisionLog]);

  const selectedDecision = useMemo(() => {
    if (!selectedAlert || !decisionLog) return null;
    return decisionLog.find(d => d.alert.id === selectedAlert);
  }, [selectedAlert, decisionLog]);

  if (!result || result.metrics.cacheHitRate === undefined) {
    return (
      <div className="pf-inspector">
        <h3>PF Model Inspector</h3>
        <div className="muted">Run a simulation to inspect the PF model.</div>
      </div>
    );
  }

  const pfState = result.pfState;
  const hasModel = !!pfState;

  return (
    <div className="pf-inspector" style={{ marginTop: 20 }}>
      <h3>PF Model Inspector</h3>
      
      {!hasModel && (
        <div className="muted" style={{ padding: 12, background: '#1a2847', borderRadius: 4, border: '1px solid #2a3b63' }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>PF model not available</div>
          <div style={{ fontSize: 13 }}>
            The PF (Priority Forecasting) model is only active when using the <strong>PriorityFresh</strong> caching policy.
            {' '}Select PriorityFresh in the Controls and run a simulation to see model analytics.
          </div>
        </div>
      )}

      {hasModel && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div className="stat-card">
                <div className="stat-label">Features</div>
                <div className="stat-value">{pfState.featureCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Hash Buckets</div>
                <div className="stat-value">{pfState.hashBucketCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Temperature</div>
                <div className="stat-value">{pfState.temperature.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Learning Rate</div>
                <div className="stat-value">{pfState.learningRate.toFixed(3)}</div>
              </div>
            </div>
          </div>

          {decisionLog && decisionLog.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4>Recent Decisions ({recentDecisions.length})</h4>
              <div className="decision-log" style={{ maxHeight: 300, overflowY: 'auto', fontSize: 13 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #4a5f8c' }}>
                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Time</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Region</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Severity</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Urgency</th>
                      <th style={{ padding: '4px 8px', textAlign: 'right' }}>Probability</th>
                      <th style={{ padding: '4px 8px', textAlign: 'right' }}>Boost</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDecisions.map((decision) => (
                      <tr
                        key={decision.alert.id}
                        onClick={() => setSelectedAlert(decision.alert.id)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedAlert === decision.alert.id ? '#2a3f5f' : 'transparent',
                          borderBottom: '1px solid #3a4f6c'
                        }}
                      >
                        <td style={{ padding: '4px 8px' }}>{Math.floor(decision.t)}s</td>
                        <td style={{ padding: '4px 8px' }}>{decision.alert.regionId || '-'}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <span className={`severity-badge ${decision.alert.severity.toLowerCase()}`}>
                            {decision.alert.severity}
                          </span>
                        </td>
                        <td style={{ padding: '4px 8px' }}>{decision.alert.urgency}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                          {decision.score ? (decision.score.probability * 100).toFixed(1) + '%' : '-'}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: decision.score && decision.score.boost > 0 ? '#4ade80' : '#f87171' }}>
                          {decision.score ? (decision.score.boost > 0 ? '+' : '') + decision.score.boost.toFixed(1) : '-'}
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <span className={`action-badge ${decision.action}`}>{decision.action}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedDecision && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#1a2842', borderRadius: 4 }}>
              <h4>Selected Alert Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div><strong>ID:</strong> {selectedDecision.alert.id}</div>
                <div><strong>Event:</strong> {selectedDecision.alert.eventType}</div>
                <div><strong>Region:</strong> {selectedDecision.alert.regionId || 'Unknown'}</div>
                <div><strong>Freshness:</strong> {(selectedDecision.freshness * 100).toFixed(1)}%</div>
                {selectedDecision.score && (
                  <>
                    <div><strong>Base Score:</strong> {selectedDecision.score.base.toFixed(2)}</div>
                    <div><strong>Total Score:</strong> {selectedDecision.score.total.toFixed(2)}</div>
                    <div><strong>Exploration:</strong> {selectedDecision.score.exploration.toFixed(2)}</div>
                    <div><strong>Probability:</strong> {(selectedDecision.score.probability * 100).toFixed(1)}%</div>
                  </>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button onClick={() => setShowWeights(!showWeights)}>
              {showWeights ? 'Hide' : 'Show'} Model Weights
            </button>
          </div>

          {showWeights && pfState.weights && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: '#1a2842', borderRadius: 4, maxHeight: 300, overflowY: 'auto' }}>
              <h4>Weight Vector (first 20)</h4>
              <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {pfState.weights.slice(0, 20).map((w, idx) => (
                  <div key={idx} style={{ marginBottom: 2 }}>
                    <span style={{ color: '#9fb3d9' }}>w[{idx}]:</span>{' '}
                    <span style={{ color: w > 0 ? '#4ade80' : '#f87171' }}>
                      {w.toFixed(4)}
                    </span>
                  </div>
                ))}
                {pfState.weights.length > 20 && (
                  <div className="muted">... and {pfState.weights.length - 20} more</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .pf-inspector .stat-card {
          flex: 1;
          padding: 8px 12px;
          background: #1a2842;
          border-radius: 4px;
        }
        .pf-inspector .stat-label {
          font-size: 11px;
          color: #9fb3d9;
          margin-bottom: 4px;
        }
        .pf-inspector .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: #d7e1f7;
        }
        .severity-badge {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .severity-badge.extreme { background: #dc2626; color: white; }
        .severity-badge.severe { background: #ea580c; color: white; }
        .severity-badge.moderate { background: #f59e0b; color: white; }
        .severity-badge.minor { background: #84cc16; color: white; }
        .severity-badge.unknown { background: #6b7280; color: white; }
        .action-badge {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .action-badge.cached { background: #059669; color: white; }
        .action-badge.pushed { background: #2563eb; color: white; }
        .action-badge.evicted { background: #dc2626; color: white; }
        .action-badge.dropped { background: #6b7280; color: white; }
      `}</style>
    </div>
  );
}
