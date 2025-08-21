import { useState } from 'react';
import { runMatrix, exportAllRuns } from '@sim/runnerMatrix';

export default function MatrixRunner() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, description: '' });
  const [seeds, setSeeds] = useState('s1,s2,s3');

  async function handleRunMatrix() {
    setRunning(true);
    const seedList = seeds.split(',').map(s => s.trim()).filter(Boolean);
    
    await runMatrix({
      seeds: seedList,
      onProgress: (current, total, description) => {
        setProgress({ current, total, description });
      }
    });
    
    setRunning(false);
    setProgress({ current: 0, total: 0, description: 'Complete!' });
  }

  return (
    <div style={{ 
      padding: 16, 
      borderTop: '1px solid #eee', 
      backgroundColor: '#f8f9fa' 
    }}>
      <h3>Batch Experiment Runner</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '8px 0' }}>
        Run all scenario × policy combinations for reproducible results
      </p>
      
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label>
          Seeds (comma-separated):
          <input 
            value={seeds}
            onChange={e => setSeeds(e.target.value)}
            placeholder="s1,s2,s3"
            style={{ marginLeft: 8, width: 200 }}
            disabled={running}
          />
        </label>
        
        <button 
          onClick={handleRunMatrix}
          disabled={running}
          style={{ padding: '8px 16px' }}
        >
          {running ? 'Running Matrix...' : 'Run Full Matrix'}
        </button>
        
        <button 
          onClick={exportAllRuns}
          style={{ padding: '8px 16px' }}
        >
          Export All Results
        </button>
      </div>
      
      {running && progress.total > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: '14px', marginBottom: 4 }}>
            {progress.description} ({progress.current}/{progress.total})
          </div>
          <div style={{ 
            width: '100%', 
            height: 8, 
            backgroundColor: '#ddd', 
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${(progress.current / progress.total) * 100}%`,
              height: '100%',
              backgroundColor: '#1c2541',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
