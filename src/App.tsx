import { useState } from 'react';
import Controls from './ui/Controls';
import Results from './ui/Results';
import MatrixRunner from './ui/MatrixRunner';
import ExperimentRunner from './ui/ExperimentRunner';
import RunsHistory from './ui/RunsHistory';
import { DebugPanel } from './ui/DebugPanel';

export default function App() {
  const [last, setLast] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'experiments' | 'history' | 'debug'>('single');

  const tabStyle = (tab: string) => ({
    padding: '8px 16px',
    border: 'none',
    background: activeTab === tab ? '#1c2541' : '#f8f9fa',
    color: activeTab === tab ? 'white' : '#333',
    cursor: 'pointer',
    borderRadius: '4px 4px 0 0',
    marginRight: '4px'
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
      <div style={{ 
        padding: 24, 
        borderBottom: '1px solid #eee',
        background: 'linear-gradient(135deg, #1c2541 0%, #3a506b 100%)',
        color: 'white'
      }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem' }}>
          AWARE Emergency Alert Simulation
        </h1>
        <p style={{ margin: 0, opacity: 0.9, fontSize: '1.1rem' }}>
          Research platform for priority-aware emergency alert caching systems
        </p>
      </div>
      
      <div className="container">
        {/* Tab Navigation */}
        <div style={{ borderBottom: '1px solid #eee', marginBottom: '0' }}>
          <button onClick={() => setActiveTab('single')} style={tabStyle('single')}>
            Single Run
          </button>
          <button onClick={() => setActiveTab('batch')} style={tabStyle('batch')}>
            Batch Matrix
          </button>
          <button onClick={() => setActiveTab('experiments')} style={tabStyle('experiments')}>
            Experiments
          </button>
          <button onClick={() => setActiveTab('history')} style={tabStyle('history')}>
            Run History
          </button>
          <button onClick={() => setActiveTab('debug')} style={tabStyle('debug')}>
            🔍 Debug
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'single' && (
          <>
            <div className="card">
              <h2>Single Simulation Run</h2>
              <Controls onRun={setLast} />
            </div>
            
            {last && (
              <div className="card">
                <h2>Results</h2>
                <Results results={last} />
              </div>
            )}
          </>
        )}

        {activeTab === 'batch' && (
          <div className="card">
            <h2>Batch Matrix Runner</h2>
            <MatrixRunner />
          </div>
        )}

        {activeTab === 'experiments' && (
          <div className="card">
            <h2>Research Experiments</h2>
            <ExperimentRunner />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="card">
            <h2>Experiment History</h2>
            <RunsHistory />
          </div>
        )}

        {activeTab === 'debug' && (
          <div className="card">
            <h2>Debug Analysis</h2>
            <DebugPanel />
          </div>
        )}
        
        <div className="card">
          <h2>Research Harness</h2>
          <p className="text-muted">
            This simulation implements the AWARE framework for emergency alert caching
            with priority-aware algorithms. Use the tabs above to run experiments and analyze results.
          </p>
          <div style={{ marginTop: 16 }}>
            <h3>Available Features:</h3>
            <ul>
              <li><strong>Single Runs:</strong> Quick scenario testing with immediate results</li>
              <li><strong>Batch Matrix:</strong> Multiple seeds across scenarios for statistical analysis</li>
              <li><strong>Research Experiments:</strong> Predefined experimental configurations</li>
              <li><strong>History:</strong> View past runs, export data, compare results</li>
              <li><strong>Cache Policies:</strong> LRU, Priority-Fresh, TTL-Only comparison</li>
              <li><strong>Export Functions:</strong> CSV/JSON data for statistical analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
