import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';

export type TimePoint = { t: number; cacheSize: number; hits: number; misses: number };

export default function TimeChart({ data }: { data: TimePoint[] }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#314462" />
          <XAxis dataKey="t" stroke="#a5b4d0" tick={{ fontSize: 12 }} />
          <YAxis stroke="#a5b4d0" tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={{ background: '#0f1a34', border: '1px solid #3a506b' }} />
          <Legend />
          <Line type="monotone" dataKey="cacheSize" stroke="#5bc0be" dot={false} name="Cache Size" />
          <Line type="monotone" dataKey="hits" stroke="#9cff57" dot={false} name="Hits (cum)" />
          <Line type="monotone" dataKey="misses" stroke="#ff7b7b" dot={false} name="Misses (cum)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

