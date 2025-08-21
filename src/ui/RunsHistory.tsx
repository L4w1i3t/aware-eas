import { useState, useEffect } from 'react';
import { db, RunSummary } from '../db';

export default function RunsHistory() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  async function loadRuns() {
    try {
      const storedRuns = await db.runs.orderBy('timestamp').reverse().toArray();
      setRuns(storedRuns);
    } catch (error) {
      console.error('Failed to load runs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteRun(id: string) {
    if (confirm('Are you sure you want to delete this run?')) {
      try {
        await db.runs.delete(id);
        await loadRuns();
        if (selectedRun?.id === id) {
          setSelectedRun(null);
        }
      } catch (error) {
        console.error('Failed to delete run:', error);
      }
    }
  }

  async function clearAllRuns() {
    if (confirm('Are you sure you want to delete ALL run history? This cannot be undone.')) {
      try {
        await db.runs.clear();
        await loadRuns();
        setSelectedRun(null);
      } catch (error) {
        console.error('Failed to clear runs:', error);
      }
    }
  }

  function exportRun(run: RunSummary) {
    const data = {
      metadata: {
        id: run.id,
        scenario: run.scenario,
        policy: run.policy,
        seed: run.seed,
        timestamp: run.timestamp,
        date: new Date(run.timestamp).toISOString()
      },
      metrics: run.metrics,
      samplesCount: run.samplesCount,
      fullResults: run.fullResults
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run-${run.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportAllRunsCSV() {
    if (runs.length === 0) return;

    const headers = [
      'ID',
      'Date',
      'Scenario',
      'Policy',
      'Seed',
      'Samples',
      'Delivery Ratio',
      'Cache Hit Rate',
      'Avg Latency (ms)',
      'Alerts Generated',
      'Duplicates Filtered'
    ];

    const rows = runs.map(run => [
      run.id,
      new Date(run.timestamp).toISOString(),
      run.scenario,
      run.policy,
      run.seed,
      run.samplesCount,
      (run.metrics.deliveryRatio * 100).toFixed(2),
      (run.metrics.cacheHitRatio * 100).toFixed(2),
      run.metrics.averageLatency?.toFixed(2) || 'N/A',
      run.metrics.alertsGenerated || 'N/A',
      run.metrics.duplicatesFiltered || 'N/A'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-runs-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div>Loading run history...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0 }}>Run History</h3>
          <p className="text-muted" style={{ margin: 0 }}>
            {runs.length} saved experiment runs
          </p>
        </div>
        <div>
          {runs.length > 0 && (
            <>
              <button onClick={exportAllRunsCSV} style={{ marginRight: 8 }}>
                📊 Export All CSV
              </button>
              <button 
                onClick={clearAllRuns}
                style={{ backgroundColor: '#dc3545', color: 'white' }}
              >
                🗑️ Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {runs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#666' }}>
          <div style={{ fontSize: '3em', marginBottom: 16 }}>📊</div>
          <h4>No experiment runs yet</h4>
          <p>Run some experiments to see results here!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <h4>Run List</h4>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {runs.map(run => (
                <div 
                  key={run.id}
                  className="card"
                  style={{ 
                    margin: '0 0 8px 0',
                    cursor: 'pointer',
                    border: selectedRun?.id === run.id ? '2px solid #0066cc' : undefined
                  }}
                  onClick={() => setSelectedRun(run)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{run.scenario}</div>
                      <div style={{ fontSize: '0.9em', color: '#666' }}>
                        {new Date(run.timestamp).toLocaleDateString()} {new Date(run.timestamp).toLocaleTimeString()}
                      </div>
                      <div style={{ fontSize: '0.8em', color: '#888' }}>
                        {run.samplesCount} samples • {run.policy}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); exportRun(run); }}
                        style={{ padding: '4px 8px', fontSize: '0.8em' }}
                        title="Export JSON"
                      >
                        📄
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteRun(run.id); }}
                        style={{ padding: '4px 8px', fontSize: '0.8em', backgroundColor: '#dc3545', color: 'white' }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {selectedRun ? (
              <div>
                <h4>Run Details</h4>
                <div className="card" style={{ margin: 0 }}>
                  <table style={{ width: '100%' }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600, width: '40%' }}>ID:</td>
                        <td style={{ fontSize: '0.9em', fontFamily: 'monospace' }}>{selectedRun.id}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Date:</td>
                        <td>{new Date(selectedRun.timestamp).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Scenario:</td>
                        <td>{selectedRun.scenario}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Policy:</td>
                        <td>{selectedRun.policy}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Seed:</td>
                        <td style={{ fontFamily: 'monospace' }}>{selectedRun.seed}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Samples:</td>
                        <td>{selectedRun.samplesCount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h5 style={{ marginTop: 16 }}>Performance Metrics</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="card" style={{ margin: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>Delivery Ratio</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#28a745' }}>
                      {(selectedRun.metrics.deliveryRatio * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="card" style={{ margin: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>Cache Hit Rate</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#17a2b8' }}>
                      {(selectedRun.metrics.cacheHitRatio * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="card" style={{ margin: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>Avg Latency</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#ffc107' }}>
                      {selectedRun.metrics.averageLatency?.toFixed(0) || 'N/A'}ms
                    </div>
                  </div>
                  <div className="card" style={{ margin: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>Alerts Generated</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#6f42c1' }}>
                      {selectedRun.metrics.alertsGenerated || 'N/A'}
                    </div>
                  </div>
                </div>

                {selectedRun.fullResults && (
                  <details style={{ marginTop: 16 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      View Full Results JSON
                    </summary>
                    <pre style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: 12, 
                      borderRadius: 4, 
                      fontSize: '0.8em',
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}>
                      {JSON.stringify(selectedRun.fullResults, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: '#666' }}>
                <div style={{ fontSize: '2em', marginBottom: 8 }}>👈</div>
                <p>Select a run from the list to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
