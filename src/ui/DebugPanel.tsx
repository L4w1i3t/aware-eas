import { useState } from 'react';
import { debugSimulation } from '../debug/simDebug';
import { quickDataCheck } from '../debug/quickCheck';
import { testFixes } from '../debug/testFixes';
import { testPriorityScaling } from '../debug/priorityTest';
import { verifyFixes } from '../debug/verifyFixes';
import { db } from '../db';

export function DebugPanel() {
  const [debugOutput, setDebugOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  const verifyAllFixes = () => {
    const originalLog = console.log;
    let output = 'VERIFYING ALL FIXES:\n\n';
    console.log = (...args) => {
      output += args.join(' ') + '\n';
    };

    try {
      const results = verifyFixes();
      output += '\nResults: ' + JSON.stringify(results, null, 2);
    } catch (error) {
      output += '\nERROR: ' + error;
    } finally {
      console.log = originalLog;
      setDebugOutput(output);
    }
  };

  const testPriorities = () => {
    const originalLog = console.log;
    let output = 'TESTING PRIORITY SCALING:\n\n';
    console.log = (...args) => {
      output += args.join(' ') + '\n';
    };

    try {
      const results = testPriorityScaling();
      output += '\nResults: ' + JSON.stringify(results, null, 2);
    } catch (error) {
      output += '\nERROR: ' + error;
    } finally {
      console.log = originalLog;
      setDebugOutput(output);
    }
  };

  const clearDatabase = async () => {
    if (confirm('This will clear all saved simulation data. Are you sure?')) {
      try {
        await db.delete();
        setDebugOutput('Database cleared successfully. Please refresh the page.');
      } catch (error) {
        setDebugOutput('Failed to clear database: ' + error);
      }
    }
  };

  const runQuickCheck = () => {
    const originalLog = console.log;
    let output = 'QUICK DATA CHECK:\n\n';
    console.log = (...args) => {
      output += args.join(' ') + '\n';
    };

    try {
      const results = quickDataCheck();
      output += '\nResults: ' + JSON.stringify(results, null, 2);
    } catch (error) {
      output += '\nERROR: ' + error;
    } finally {
      console.log = originalLog;
      setDebugOutput(output);
    }
  };

  const runFixTest = async () => {
    setIsRunning(true);
    const originalLog = console.log;
    let output = 'TESTING FIXES:\n\n';
    console.log = (...args) => {
      output += args.join(' ') + '\n';
    };

    try {
      const results = await testFixes();
      output += '\nResults: ' + JSON.stringify(results, null, 2);
    } catch (error) {
      output += '\nERROR: ' + error;
    } finally {
      console.log = originalLog;
      setDebugOutput(output);
      setIsRunning(false);
    }
  };

  const runFullDebug = async () => {
    setIsRunning(true);
    setDebugOutput('Running full debug analysis...\n');

    // Capture console.log output
    const originalLog = console.log;
    let output = '';
    console.log = (...args) => {
      output += args.join(' ') + '\n';
      originalLog(...args);
    };

    try {
      const results = await debugSimulation();
      output += '\n' + JSON.stringify(results, null, 2);
    } catch (error) {
      output += '\nERROR: ' + error;
    } finally {
      console.log = originalLog;
      setDebugOutput(output);
      setIsRunning(false);
    }
  };

  return (
    <div className="debug-panel" style={{ 
      border: '2px solid #e74c3c', 
      borderRadius: '8px', 
      padding: '20px', 
      margin: '20px 0',
      backgroundColor: '#fff5f5'
    }}>
      <h3 style={{ color: '#e74c3c', marginBottom: '15px' }}>🔍 Simulation Debug Analysis</h3>
      
      <p style={{ marginBottom: '15px', color: '#666' }}>
        This will analyze if the simulation is producing real, varying data or if something is broken.
        Check the console and output below for detailed analysis.
      </p>

      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={verifyAllFixes}
          style={{
            padding: '10px 20px',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          🔧 Verify All Fixes
        </button>

        <button 
          onClick={testPriorities}
          style={{
            padding: '10px 20px',
            backgroundColor: '#9b59b6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Test Priority Scaling
        </button>

        <button 
          onClick={runQuickCheck}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Quick Data Check
        </button>

        <button 
          onClick={runFixTest}
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            backgroundColor: isRunning ? '#95a5a6' : '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {isRunning ? 'Testing...' : 'Test Fixes'}
        </button>

        <button 
          onClick={runFullDebug} 
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            backgroundColor: isRunning ? '#95a5a6' : '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {isRunning ? 'Running Full Analysis...' : 'Full Debug Analysis'}
        </button>

        <button 
          onClick={clearDatabase}
          style={{
            padding: '10px 20px',
            backgroundColor: '#e67e22',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Clear Database
        </button>
      </div>

      {debugOutput && (
        <div style={{
          backgroundColor: '#2c3e50',
          color: '#ecf0f1',
          padding: '15px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '12px',
          maxHeight: '400px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          {debugOutput}
        </div>
      )}
      
      <div style={{ marginTop: '15px', fontSize: '14px', color: '#7f8c8d' }}>
        <strong>What to look for:</strong>
        <ul style={{ marginTop: '5px' }}>
          <li>Different scenarios should have different device counts, alert counts, etc.</li>
          <li>Different cache policies should show different hit rates and latencies</li>
          <li>Different seeds should produce slightly different results</li>
          <li>Cache operations should work (put/get)</li>
          <li>If everything looks identical, there's likely a bug!</li>
        </ul>
      </div>
    </div>
  );
}
