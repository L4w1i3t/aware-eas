import { useState } from 'react';
import { ExperimentRunner, RESEARCH_EXPERIMENTS } from '@sim/harness/ExperimentRunner';
import { runQuickExperiment } from '@sim/harness';
import { db } from '../db';

export default function ExperimentRunnerUI() {
  const [running, setRunning] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<keyof typeof RESEARCH_EXPERIMENTS>('quickBaseline');
  const [progress, setProgress] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);

  async function handleRunExperiment() {
    if (running) return;
    
    setRunning(true);
    setProgress('Starting experiment...');
    
    try {
      const experimentConfig = RESEARCH_EXPERIMENTS[selectedExperiment];
      const runner = new ExperimentRunner(experimentConfig);
      
      setProgress('Running experiment scenarios...');
      const results = await runner.runExperiment();
      
      setProgress('Saving results to database...');
      // Save to Dexie
      await db.runs.put({
        id: `${results.config.name}-${Date.now()}`,
        scenario: results.config.scenarios.join('+'),
        policy: 'Multi-Policy', // Will be enhanced when we add policy comparison
        seed: results.config.seeds.join(','),
        timestamp: Date.now(),
        metrics: results.summary.averageMetrics,
        samplesCount: results.results.length,
        experimentName: results.config.name,
        fullResults: results
      });
      
      setLastResult(results);
      setProgress(`Completed! ${results.summary.totalRuns} simulations across ${results.config.scenarios.length} scenarios`);
      
    } catch (error) {
      console.error('Experiment failed:', error);
      setProgress(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  }

  async function handleQuickTest() {
    if (running) return;
    
    setRunning(true);
    setProgress('Running quick experiment...');
    
    try {
      const results = await runQuickExperiment();
      
      // Save to Dexie
      await db.runs.put({
        id: `quick-test-${Date.now()}`,
        scenario: 'Quick Test',
        policy: 'Multi-Policy',
        seed: '42,123,456',
        timestamp: Date.now(),
        metrics: results.summary?.averageMetrics || {},
        samplesCount: results.results?.length || 0,
        experimentName: 'Quick Baseline Test',
        fullResults: results
      });
      
      setLastResult(results);
      setProgress('Quick test completed!');
      
    } catch (error) {
      console.error('Quick test failed:', error);
      setProgress(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  }

  function downloadCSV() {
    if (!lastResult) return;
    
    const runner = new ExperimentRunner(lastResult.config);
    const csvData = runner.exportToCSV(lastResult);
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lastResult.config.name}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadSummaryCSV() {
    if (!lastResult) return;
    
    const runner = new ExperimentRunner(lastResult.config);
    const csvData = runner.exportSummaryToCSV(lastResult);
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lastResult.config.name}-summary-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h3>Predefined Research Experiments</h3>
        <p className="text-muted">
          Run comprehensive experiments designed for academic research with multiple scenarios and seeds.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
            Select Experiment:
          </label>
          <select 
            value={selectedExperiment}
            onChange={(e) => setSelectedExperiment(e.target.value as keyof typeof RESEARCH_EXPERIMENTS)}
            disabled={running}
            style={{ width: '100%' }}
          >
            {Object.entries(RESEARCH_EXPERIMENTS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
          </select>
          
          {selectedExperiment && (
            <div style={{ marginTop: 8, fontSize: '0.9em', color: '#666' }}>
              <strong>Description:</strong> {RESEARCH_EXPERIMENTS[selectedExperiment].description}
              <br />
              <strong>Scenarios:</strong> {RESEARCH_EXPERIMENTS[selectedExperiment].scenarios.length}
              <br />
              <strong>Seeds:</strong> {RESEARCH_EXPERIMENTS[selectedExperiment].seeds.length}
              <br />
              <strong>Total Runs:</strong> {RESEARCH_EXPERIMENTS[selectedExperiment].scenarios.length * RESEARCH_EXPERIMENTS[selectedExperiment].seeds.length}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
            Quick Actions:
          </label>
          <button 
            onClick={handleQuickTest}
            disabled={running}
            style={{ width: '100%', marginBottom: 8 }}
          >
            🚀 Quick Test (3 scenarios × 3 seeds)
          </button>
          <button 
            onClick={handleRunExperiment}
            disabled={running}
            style={{ width: '100%' }}
          >
            🔬 Run Full Experiment
          </button>
        </div>
      </div>

      {progress && (
        <div style={{ 
          padding: 12, 
          backgroundColor: running ? '#fff3cd' : '#d4edda',
          border: `1px solid ${running ? '#ffeaa7' : '#c3e6cb'}`,
          borderRadius: 4,
          marginBottom: 16
        }}>
          {running && <span>⏳ </span>}
          {progress}
        </div>
      )}

      {lastResult && (
        <div style={{ marginTop: 24 }}>
          <h3>Latest Results</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div className="card" style={{ margin: 0, textAlign: 'center' }}>
              <h4>Total Runs</h4>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#1c2541' }}>
                {lastResult.summary.totalRuns}
              </div>
            </div>
            <div className="card" style={{ margin: 0, textAlign: 'center' }}>
              <h4>Avg Delivery Ratio</h4>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#28a745' }}>
                {(lastResult.summary.averageMetrics.deliveryRatio * 100).toFixed(1)}%
              </div>
            </div>
            <div className="card" style={{ margin: 0, textAlign: 'center' }}>
              <h4>Avg Cache Hit Rate</h4>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#17a2b8' }}>
                {(lastResult.summary.averageMetrics.cacheHitRatio * 100).toFixed(1)}%
              </div>
            </div>
            <div className="card" style={{ margin: 0, textAlign: 'center' }}>
              <h4>Avg Latency</h4>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#ffc107' }}>
                {lastResult.summary.averageMetrics.averageLatency.toFixed(0)}ms
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button onClick={downloadCSV} style={{ marginRight: 8 }}>
              📊 Download Full CSV
            </button>
            <button onClick={downloadSummaryCSV}>
              📈 Download Summary CSV
            </button>
          </div>

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              View Scenario Comparison
            </summary>
            <table style={{ width: '100%', marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Delivery Ratio</th>
                  <th>Cache Hit Rate</th>
                  <th>Avg Latency (ms)</th>
                  <th>Alerts Generated</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(lastResult.summary.scenarioComparison).map(([scenario, metrics]) => (
                  <tr key={scenario}>
                    <td>{scenario}</td>
                    <td>{((metrics as any).deliveryRatio * 100).toFixed(1)}%</td>
                    <td>{((metrics as any).cacheHitRatio * 100).toFixed(1)}%</td>
                    <td>{(metrics as any).averageLatency.toFixed(0)}</td>
                    <td>{(metrics as any).alertsGenerated.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </div>
  );
}
