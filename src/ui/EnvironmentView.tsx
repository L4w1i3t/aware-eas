import { useEffect, useMemo, useRef, useState } from 'react';
import { mulberry32, hashStringToSeed } from '../sim/core/RandomGenerator';
import { generateEnvironment } from '../sim/geo/generate';
import type { Environment, Region } from '../sim/geo/types';
import { getSegment, type ScenarioSpec } from '../sim/scenarios/types';
import { UrbanScenario } from '../sim/scenarios/urban';
import { SuburbanScenario } from '../sim/scenarios/suburban';
import { RuralScenario } from '../sim/scenarios/rural';
import { weatherProviderStatus, mapboxProviderStatus } from '../api/providers';
import { useSimulationContext } from '../state/SimulationContext';
import type { RegionStats } from '../sim/run';
import type { Alert } from '../sim/types';
import { synthesizeWeatherHistory, synthesizeAnomalyHistory } from '../sim/learning/pfModel';
import RegionalProfile from './RegionalProfile';

type Props = {
  scenario?: 'Rural' | 'Suburban' | 'Urban';
  baselineReliability?: number; // 0..1 from Controls
};

const CUSTOM_HEIGHT = 420;
const MIN_WIDTH = 600;

type Mode = 'live' | 'custom';
export default function EnvironmentView({ scenario = 'Urban', baselineReliability = 0.9 }: Props) {
  const { snapshot, activeTimeSec, setActiveTimeSec } = useSimulationContext();
  const [mode, setMode] = useState<Mode>(snapshot ? 'live' : 'custom');
  const [deterministic, setDeterministic] = useState(true);
  const [seed, setSeed] = useState('env-demo');
  const [regions, setRegions] = useState(10);
  const [timeSec, setTimeSec] = useState(0);
  const [customEnv, setCustomEnv] = useState<Environment | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (snapshot) {
      setMode('live');
    }
  }, [snapshot]);

  const providerStatus = useMemo(
    () => ({ weather: weatherProviderStatus(), map: mapboxProviderStatus() }),
    []
  );

  const scenarioName = mode === 'live' && snapshot ? snapshot.scenario : scenario;
  const baseline = mode === 'live' && snapshot ? snapshot.baselineReliability : baselineReliability;

  const spec = useMemo<ScenarioSpec>(() => {
    if (scenarioName === 'Rural') return RuralScenario;
    if (scenarioName === 'Suburban') return SuburbanScenario;
    return UrbanScenario;
  }, [scenarioName]);

  function rebuild(width: number, height: number, bumpSeed?: boolean) {
    const s = deterministic ? seed : String(Date.now() + Math.random());
    if (bumpSeed && !deterministic) {
      setSeed(s);
    }
    const rng = mulberry32(hashStringToSeed(s));
    const envNew = generateEnvironment(rng, width, height, { regions });
    setCustomEnv(envNew);
  }

  useEffect(() => {
    if (mode !== 'custom') return;
    const el = containerRef.current;
    if (!el) return;
    const resize = () => {
      const rect = el.getBoundingClientRect();
      rebuild(Math.max(MIN_WIDTH, rect.width - 4), CUSTOM_HEIGHT);
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, deterministic, seed, regions]);

  const env = mode === 'live' && snapshot ? snapshot.environment : customEnv;
  const timeValue = mode === 'live' ? activeTimeSec : timeSec;
  const lastSampleTime = snapshot && snapshot.timeline.length ? snapshot.timeline[snapshot.timeline.length - 1].t : 0;
  const sliderMax = mode === 'live' && snapshot ? Math.max(60, lastSampleTime) : 1800;
  const seg = useMemo(() => getSegment(spec, timeValue), [spec, timeValue]);
  const effectiveRel = clamp01(baseline * seg.reliability);

  const statsMap = useMemo(() => {
    if (!snapshot || mode !== 'live') return null;
    return new Map(snapshot.regionStats.map((stat) => [stat.regionId, stat]));
  }, [snapshot, mode]);

  const topStats = useMemo(() => {
    if (!snapshot || mode !== 'live') return [] as RegionStats[];
    return [...snapshot.regionStats]
      .sort((a, b) => b.delivered - a.delivered)
      .slice(0, 5);
  }, [snapshot, mode]);

  function handleTimeChange(next: number) {
    if (mode === 'live') {
      setActiveTimeSec(next);
    } else {
      setTimeSec(next);
    }
  }

  const regionOptions = useMemo(() => (env ? env.regions.map((r) => r.id) : []), [env]);

  useEffect(() => {
    if (!selectedRegion && env?.regions?.length) {
      setSelectedRegion(env.regions[0].id);
    }
  }, [env, selectedRegion]);

  const regionQueue = useMemo(() => {
    if (!snapshot?.issuedAlerts || !env || !selectedRegion) return [] as Alert[];
    const now = timeValue;
    const fresh = (a: Alert) => Math.exp(-Math.max(0, now - a.issuedAt) / Math.max(1, a.ttlSec));
    const sevOrd = (s: Alert['severity']) => (s === 'Extreme' ? 4 : s === 'Severe' ? 3 : s === 'Moderate' ? 2 : s === 'Minor' ? 1 : 0);
    const urgOrd = (u: Alert['urgency']) => (u === 'Immediate' ? 4 : u === 'Expected' ? 3 : u === 'Future' ? 2 : u === 'Past' ? 1 : 0);
    return snapshot.issuedAlerts
      .filter((a) => (a.regionId ?? a.geokey) === selectedRegion)
      .slice()
      .sort((a, b) => {
        const ua = urgOrd(a.urgency), ub = urgOrd(b.urgency);
        if (ua !== ub) return ub - ua;
        const sa = sevOrd(a.severity), sb = sevOrd(b.severity);
        if (sa !== sb) return sb - sa;
        return fresh(b) - fresh(a);
      });
  }, [snapshot, env, selectedRegion, timeValue]);

  // Synthesize regional data for selected region
  const regionalData = useMemo(() => {
    if (!env || !snapshot || !selectedRegion) return null;
    const region = env.regions.find(r => r.id === selectedRegion);
    if (!region) return null;

    const weatherSeed = hashStringToSeed(`${snapshot.seed}|weather`);
    const weatherRng = mulberry32(weatherSeed);
    const weatherHistory = synthesizeWeatherHistory(env, weatherRng);

    const anomalySeed = hashStringToSeed(`${snapshot.seed}|anomaly`);
    const anomalyRng = mulberry32(anomalySeed);
    const anomalyHistory = synthesizeAnomalyHistory(env, anomalyRng);

    const weatherData = weatherHistory.get(selectedRegion);
    const anomalyData = anomalyHistory.get(selectedRegion);
    const stats = statsMap?.get(selectedRegion);

    return { region, weatherData, anomalyData, stats };
  }, [env, snapshot, selectedRegion, statsMap]);

  // Generate anomaly data for all regions for tooltips
  const allAnomalyData = useMemo(() => {
    if (!env || !snapshot) return new Map();
    const anomalySeed = hashStringToSeed(`${snapshot.seed}|anomaly`);
    const anomalyRng = mulberry32(anomalySeed);
    return synthesizeAnomalyHistory(env, anomalyRng);
  }, [env, snapshot]);

  return (
    <div>
      <h3>Environment</h3>
      {snapshot && (
        <div className="row">
          <div>
            <label>Source</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="live">Last run</option>
              <option value="custom">Custom sandbox</option>
            </select>
          </div>
        </div>
      )}

      {mode === 'custom' && (
        <div className="row">
          <div>
            <label>Deterministic</label>
            <select value={deterministic ? 'yes' : 'no'} onChange={(e) => setDeterministic(e.target.value === 'yes')}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label>Seed</label>
            <input value={seed} onChange={(e) => setSeed(e.target.value)} disabled={!deterministic} />
          </div>
        </div>
      )}

      <div className="row">
        {mode === 'custom' && (
          <div>
            <label>Regions</label>
            <input type="number" min={4} max={40} value={regions} onChange={(e) => setRegions(Number(e.target.value))} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <label>Time (sec)</label>
          <input
            type="range"
            min={0}
            max={sliderMax}
            value={timeValue}
            onChange={(e) => handleTimeChange(Number(e.target.value))}
          />
          <div className="muted">
            t={timeValue}s | segment reliability {seg.reliability.toFixed(2)} | effective {effectiveRel.toFixed(2)}
          </div>
        </div>
      </div>

      {mode === 'custom' && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => rebuild(customEnv?.width ?? MIN_WIDTH, customEnv?.height ?? CUSTOM_HEIGHT, true)}>Reshuffle</button>
        </div>
      )}

      {mode === 'live' && snapshot && (
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Viewing environment from run seed {snapshot.seed} ({snapshot.scenario}).
        </div>
      )}

      <div ref={containerRef} className="card" style={{ marginTop: 10 }}>
        {env ? (
          <SvgEnv
            env={env}
            baseline={baseline}
            segRel={seg.reliability}
            stats={statsMap ?? undefined}
            selectedRegion={selectedRegion ?? undefined}
            onSelectRegion={(id) => setSelectedRegion(id)}
            anomalyData={allAnomalyData}
          />
        ) : (
          <div className="muted">Environment not available yet.</div>
        )}
      </div>
      <div className="muted" style={{ marginTop: 6 }}>
        Fill shows baseline | segment | local reliability. Borders indicate region severity.
      </div>
      {mode === 'live' && env && (
        <>
          <div className="card" style={{ marginTop: 10 }}>
            <div className="row" style={{ alignItems: 'center' }}>
              <div>
                <label>Region</label>
                <select value={selectedRegion ?? ''} onChange={(e) => setSelectedRegion(e.target.value)}>
                  {regionOptions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }} />
              <div className="muted">Personalized queue (urgency-first, then severity, then freshness)</div>
            </div>
            {regionQueue.length === 0 ? (
              <div className="muted" style={{ marginTop: 6 }}>
                No alerts issued for this region in the current run.
              </div>
            ) : (
              <ul style={{ margin: '8px 0 0 0', padding: 0, maxHeight: 200, overflow: 'auto' }}>
                {regionQueue.map((a) => (
                  <li key={a.id} style={{ listStyle: 'none', padding: '6px 4px', borderBottom: '1px solid #2a3b63' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600 }}>{a.headline ?? a.eventType}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        U:{a.urgency} · S:{a.severity} · t+{Math.max(0, timeValue - a.issuedAt)}s · TTL {a.ttlSec}s
                      </span>
                    </div>
                    {a.instruction && (
                      <div style={{ fontSize: 12, color: '#d7e1f7', opacity: 0.9 }}>{a.instruction}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {regionalData && (
            <div style={{ marginTop: 12 }}>
              <RegionalProfile 
                region={regionalData.region}
                weatherData={regionalData.weatherData}
                anomalyData={regionalData.anomalyData}
                stats={regionalData.stats}
              />
            </div>
          )}
        </>
      )}
      {topStats.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer' }}>Region delivery stats (top 5)</summary>
          <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
            {topStats.map((stat) => (
              <li key={stat.regionId} style={{ listStyle: 'disc', color: '#d7e1f7', marginBottom: 4 }}>
                {stat.regionId}: delivered {stat.delivered}, dropped {stat.dropped}, first retrievals {stat.firstRetrievals}, avg latency {formatLatency(stat.avgFirstRetrievalLatencySec)}s
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
        Weather API: {providerStatus.weather.configured ? 'ready' : 'pending'} - {providerStatus.weather.hint}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        Mapbox API: {providerStatus.map.configured ? 'ready' : 'pending'} - {providerStatus.map.hint}
      </div>
    </div>
  );
}

function SvgEnv({
  env,
  baseline,
  segRel,
  stats,
  selectedRegion,
  onSelectRegion,
  anomalyData
}: {
  env: Environment;
  baseline: number;
  segRel: number;
  stats?: Map<string, RegionStats>;
  selectedRegion?: string;
  onSelectRegion?: (id: string) => void;
  anomalyData?: Map<string, import('../sim/learning/pfModel').RegionAnomalyHistory>;
}) {
  const eff = (r: Region) => clamp01(baseline * segRel * r.localFactor);
  const color = (r: Region) => reliabilityColor(eff(r));
  const stroke = (r: Region) => (r.severity === 'Extreme' ? '#ff6b6b' : r.severity === 'Severe' ? '#ffd166' : '#a5b4d0');
  
  const buildTooltip = (r: Region) => {
    const stat = stats?.get(r.id);
    const anomaly = anomalyData?.get(r.id);
    
    let lines = [`Region ${r.id} (${r.severity})`];
    
    if (anomaly) {
      lines.push(`Accuracy: ${(anomaly.historicalAccuracy * 100).toFixed(0)}%`);
      lines.push(`False Alarms: ${(anomaly.falseAlarmRate * 100).toFixed(0)}%`);
      lines.push(`Last-Min Diversions: ${(anomaly.lastMinuteDiversionRate * 100).toFixed(0)}%`);
      lines.push(`Lead Time: ${Math.round(anomaly.typicalLeadTimeSec / 60)}min`);
    }
    
    if (stat) {
      lines.push(`---`);
      lines.push(`Delivered: ${stat.delivered}`);
      lines.push(`Dropped: ${stat.dropped}`);
      lines.push(`Avg Latency: ${formatLatency(stat.avgFirstRetrievalLatencySec)}s`);
    }
    
    return lines.join('\n');
  };
  
  return (
    <svg width="100%" height={env.height} viewBox={`0 0 ${env.width} ${env.height}`} preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={env.width} height={env.height} fill="#0b132b" />
      {env.regions.map((r) => {
        return (
          <polygon
            key={r.id}
            points={r.polygon.map((p) => p.join(',')).join(' ')}
            fill={color(r)}
            stroke={selectedRegion === r.id ? '#7dd3fc' : stroke(r)}
            strokeWidth={selectedRegion === r.id ? 2.5 : 1.5}
            opacity={0.9}
            style={{ cursor: onSelectRegion ? 'pointer' : 'default' }}
            onClick={() => onSelectRegion?.(r.id)}
          >
            <title>{buildTooltip(r)}</title>
          </polygon>
        );
      })}
      {env.regions.map((r) => {
        const stat = stats?.get(r.id);
        return (
          <text key={r.id + '-t'} x={r.center[0]} y={r.center[1]} fill="#e0e6f2" fontSize={10} textAnchor="middle">
            {stat ? `${r.id} (${stat.delivered})` : r.id}
          </text>
        );
      })}
      <Legend x={12} y={12} />
    </svg>
  );
}

function reliabilityColor(x: number) {
  const clamped = clamp01(x);
  const c1 = [0x31, 0x44, 0x62];
  const c2 = [0x5b, 0xc0, 0xbe];
  const c3 = [0xff, 0xd1, 0x66];
  const t = clamped < 0.5 ? clamped * 2 : (clamped - 0.5) * 2;
  const from = clamped < 0.5 ? c1 : c2;
  const to = clamped < 0.5 ? c2 : c3;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  const [r, g, b] = [mix(from[0], to[0]), mix(from[1], to[1]), mix(from[2], to[2])];
  return `rgb(${r},${g},${b})`;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function Legend({ x, y }: { x: number; y: number }) {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} fill="#e0e6f2" fontSize={10}>
        Reliability
      </text>
      {stops.map((s, i) => (
        <rect key={i} x={i * 26} y={8} width={24} height={8} fill={reliabilityColor(s)} />
      ))}
      <text x={0} y={28} fill="#a5b4d0" fontSize={9}>
        0
      </text>
      <text x={26 * 4} y={28} fill="#a5b4d0" fontSize={9} textAnchor="end">
        1
      </text>
    </g>
  );
}

function formatLatency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }
  return value.toFixed(1);
}
