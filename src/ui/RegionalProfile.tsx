import type { Region } from '../sim/geo/types';
import type { RegionAnomalyHistory, RegionWeatherRecord } from '../sim/learning/pfModel';

type Props = {
  region: Region | null;
  weatherData?: RegionWeatherRecord;
  anomalyData?: RegionAnomalyHistory;
  stats?: {
    delivered: number;
    dropped: number;
    firstRetrievals: number;
    avgFirstRetrievalLatencySec: number | null;
  };
};

export default function RegionalProfile({ region, weatherData, anomalyData, stats }: Props) {
  if (!region) {
    return (
      <div className="regional-profile">
        <h4>Regional Profile</h4>
        <div className="muted">Select a region to view its characteristics.</div>
      </div>
    );
  }

  return (
    <div className="regional-profile" style={{ padding: 12, backgroundColor: '#1a2842', borderRadius: 6 }}>
      <h4 style={{ marginTop: 0, marginBottom: 12 }}>Region {region.id}</h4>
      
      <div className="profile-section">
        <h5>Geography & Infrastructure</h5>
        <div className="profile-grid">
          <div className="profile-item">
            <span className="profile-label">Severity Class:</span>
            <span className={`severity-badge ${region.severity.toLowerCase()}`}>{region.severity}</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Local Reliability:</span>
            <span className="profile-value">{region.localFactor.toFixed(2)}x</span>
            <span className="profile-hint">
              {region.localFactor > 1.1 ? '(High)' : region.localFactor < 0.9 ? '(Low)' : '(Normal)'}
            </span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Center:</span>
            <span className="profile-value">
              ({region.center[0].toFixed(0)}, {region.center[1].toFixed(0)})
            </span>
          </div>
        </div>
      </div>

      {weatherData && (
        <div className="profile-section">
          <h5>Weather & Hydrology</h5>
          <div className="profile-grid">
            <div className="profile-item">
              <span className="profile-label">Flood Frequency:</span>
              <span className="profile-value">{(weatherData.floodFrequency * 100).toFixed(0)}%</span>
              <div className="profile-bar">
                <div 
                  className="profile-bar-fill" 
                  style={{ width: `${weatherData.floodFrequency * 100}%`, backgroundColor: '#f59e0b' }}
                />
              </div>
            </div>
            <div className="profile-item">
              <span className="profile-label">Mean Rainfall:</span>
              <span className="profile-value">{weatherData.rainfallMeanMm.toFixed(0)}mm</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Rainfall Volatility:</span>
              <span className="profile-value">{(weatherData.rainfallVolatility * 100).toFixed(0)}%</span>
              <div className="profile-bar">
                <div 
                  className="profile-bar-fill" 
                  style={{ width: `${weatherData.rainfallVolatility * 100}%`, backgroundColor: '#3b82f6' }}
                />
              </div>
            </div>
            <div className="profile-item">
              <span className="profile-label">Drainage Quality:</span>
              <span className="profile-value">{(weatherData.drainageScore * 100).toFixed(0)}%</span>
              <div className="profile-bar">
                <div 
                  className="profile-bar-fill" 
                  style={{ width: `${weatherData.drainageScore * 100}%`, backgroundColor: '#10b981' }}
                />
              </div>
            </div>
            <div className="profile-item">
              <span className="profile-label">Shelter Demand:</span>
              <span className="profile-value">{(weatherData.shelterDemandIndex * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {anomalyData && (
        <div className="profile-section">
          <h5>Historical Patterns & Anomalies</h5>
          <div className="profile-grid">
            <div className="profile-item">
              <span className="profile-label">False Alarm Rate:</span>
              <span className="profile-value warn">{(anomalyData.falseAlarmRate * 100).toFixed(1)}%</span>
              <div className="profile-bar">
                <div 
                  className="profile-bar-fill" 
                  style={{ width: `${anomalyData.falseAlarmRate * 100}%`, backgroundColor: '#ef4444' }}
                />
              </div>
            </div>
            <div className="profile-item">
              <span className="profile-label">Last-Min Diversion:</span>
              <span className="profile-value warn">{(anomalyData.lastMinuteDiversionRate * 100).toFixed(1)}%</span>
              <div className="profile-bar">
                <div 
                  className="profile-bar-fill" 
                  style={{ width: `${anomalyData.lastMinuteDiversionRate * 100}%`, backgroundColor: '#f97316' }}
                />
              </div>
              <span className="profile-hint">storms divert away unexpectedly</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Historical Accuracy:</span>
              <span className="profile-value success">{(anomalyData.historicalAccuracy * 100).toFixed(1)}%</span>
              <div className="profile-bar">
                <div 
                  className="profile-bar-fill" 
                  style={{ width: `${anomalyData.historicalAccuracy * 100}%`, backgroundColor: '#22c55e' }}
                />
              </div>
            </div>
            <div className="profile-item">
              <span className="profile-label">Typical Lead Time:</span>
              <span className="profile-value">{Math.floor(anomalyData.typicalLeadTimeSec / 60)}min</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Underestimation:</span>
              <span className="profile-value">{(anomalyData.underestimationRate * 100).toFixed(1)}%</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Overestimation:</span>
              <span className="profile-value">{(anomalyData.overestimationRate * 100).toFixed(1)}%</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Accuracy Trend:</span>
              <span className={`profile-value ${anomalyData.accuracyTrend > 1.05 ? 'success' : anomalyData.accuracyTrend < 0.95 ? 'warn' : ''}`}>
                {anomalyData.accuracyTrend > 1.05 ? '↑ Improving' : anomalyData.accuracyTrend < 0.95 ? '↓ Degrading' : '→ Stable'}
              </span>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="profile-section">
          <h5>Simulation Performance</h5>
          <div className="profile-grid">
            <div className="profile-item">
              <span className="profile-label">Delivered:</span>
              <span className="profile-value success">{stats.delivered}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Dropped:</span>
              <span className="profile-value warn">{stats.dropped}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">First Retrievals:</span>
              <span className="profile-value">{stats.firstRetrievals}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Avg Latency:</span>
              <span className="profile-value">
                {stats.avgFirstRetrievalLatencySec !== null ? `${stats.avgFirstRetrievalLatencySec.toFixed(1)}s` : 'n/a'}
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .regional-profile .profile-section {
          margin-bottom: 16px;
        }
        .regional-profile .profile-section:last-child {
          margin-bottom: 0;
        }
        .regional-profile h5 {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #9fb3d9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .regional-profile .profile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          font-size: 13px;
        }
        .regional-profile .profile-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .regional-profile .profile-label {
          color: #9fb3d9;
          font-size: 12px;
        }
        .regional-profile .profile-value {
          color: #d7e1f7;
          font-weight: 600;
        }
        .regional-profile .profile-value.success {
          color: #22c55e;
        }
        .regional-profile .profile-value.warn {
          color: #f59e0b;
        }
        .regional-profile .profile-hint {
          color: #6b7280;
          font-size: 11px;
        }
        .regional-profile .profile-bar {
          height: 4px;
          background: #0f172a;
          border-radius: 2px;
          overflow: hidden;
        }
        .regional-profile .profile-bar-fill {
          height: 100%;
          transition: width 0.3s ease;
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
      `}</style>
    </div>
  );
}
