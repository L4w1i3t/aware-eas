import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { downloadJSON, downloadCSV } from '../utils';

export default function Results({ results }: { results: any }) {
  const r = results.summary;
  
  const rows = Object.entries(r).map(([k, v]) => ({ 
    metric: k, 
    value: typeof v === 'number' ? Number(v.toFixed(4)) : v 
  }));
  
  const barData = [
    { p: 'P50(ms)', v: r.latencyP50 ?? 0 },
    { p: 'P95(ms)', v: r.latencyP95 ?? 0 },
  ];

  return (
    <div style={{ marginTop: 16, maxWidth: 640 }}>
      <h2>Summary</h2>
      <div style={{ marginBottom: 16 }}>
        <button 
          onClick={() => downloadJSON('aware-summary.json', r)}
          style={{ marginRight: 8 }}
        >
          Download JSON
        </button>
        <button onClick={() => downloadCSV('aware-summary.csv', r)}>
          Download CSV
        </button>
      </div>
      
      <table style={{ width: '100%', marginBottom: 16 }}>
        <tbody>
          {rows.map(row => (
            <tr key={row.metric}>
              <td style={{ paddingRight: 12 }}>{row.metric}</td>
              <td><strong>{String(row.value)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Latency Distribution</h3>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={barData}>
            <XAxis dataKey="p" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="v" fill="#1c2541" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
