import { FormEvent, useMemo, useState } from 'react';
import { weatherProviderStatus, mapboxProviderStatus } from '../api/providers';
import { fetchCurrentWeather, type WeatherSnapshot } from '../api/weather';
import { geocodePlaces, mapboxStaticMapURL, type GeocodeFeature } from '../api/mapbox';

type Coords = {
  lat: number;
  lon: number;
};

const DEFAULT_COORDS: Coords = { lat: 38.0293, lon: -78.4767 }; // Charlottesville, VA
const DEGREE = '\u00B0';

export default function ServicesPanel() {
  const status = useMemo(
    () => ({
      weather: weatherProviderStatus(),
      map: mapboxProviderStatus()
    }),
    []
  );
  const [coords, setCoords] = useState<Coords>(DEFAULT_COORDS);
  const [weather, setWeather] = useState<{ loading: boolean; error: string | null; data: WeatherSnapshot | null }>({
    loading: false,
    error: null,
    data: null
  });
  const tempSummary = weather.data
    ? `${weather.data.temperatureC.toFixed(1)}${DEGREE}C / ${weather.data.temperatureF.toFixed(1)}${DEGREE}F`
    : null;
  const feelsSummary = weather.data
    ? `${weather.data.feelsLikeC.toFixed(1)}${DEGREE}C / ${weather.data.feelsLikeF.toFixed(1)}${DEGREE}F`
    : null;
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeFeature[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapUrl = useMemo(() => {
    return mapboxStaticMapURL({ center: [coords.lon, coords.lat], zoom: 11, width: 480, height: 320 });
  }, [coords.lon, coords.lat]);

  async function handleWeatherFetch() {
    if (!status.weather.configured) {
      setWeather((prev) => ({ ...prev, error: 'Weather provider not configured.', loading: false }));
      return;
    }
    setWeather((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchCurrentWeather(coords);
      setWeather({ loading: false, error: null, data });
    } catch (err) {
      setWeather({ loading: false, error: toMessage(err), data: null });
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!status.map.configured) {
      setMapError('Mapbox provider not configured.');
      return;
    }
    if (!query.trim()) {
      setMapError('Enter a place to search.');
      return;
    }
    setMapError(null);
    try {
      const results = await geocodePlaces(query.trim(), 5);
      setSearchResults(results);
      if (results.length === 0) {
        setMapError('No places found for that query.');
      }
    } catch (err) {
      setMapError(toMessage(err));
    }
  }

  function applyResult(result: GeocodeFeature) {
    setCoords({ lat: result.coordinates[1], lon: result.coordinates[0] });
    setSearchResults([]);
    setQuery(result.placeName);
  }

  return (
    <div>
      <h3>External Services</h3>
      <p className="muted">Use this panel to check whether Weather API and Mapbox credentials are functioning.</p>

      <section style={{ marginBottom: 16 }}>
        <h4>Status</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, fontSize: 14 }}>
          <strong>Weather API</strong>
          <span style={{ color: status.weather.configured ? '#8bf28b' : '#f2aa8b' }}>{status.weather.hint}</span>
          <strong>Mapbox</strong>
          <span style={{ color: status.map.configured ? '#8bf28b' : '#f2aa8b' }}>{status.map.hint}</span>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Search for a place (e.g., Charlottesville)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: '1 1 220px' }}
          />
          <button type="submit">Search</button>
        </form>
        {searchResults.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="muted" style={{ marginBottom: 4 }}>Select a result to update the preview:</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {searchResults.map((result) => (
                <li key={result.id} style={{ marginBottom: 4 }}>
                  <button type="button" onClick={() => applyResult(result)}>
                    {result.placeName}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <h4>Weather Snapshot</h4>
        <div className="row">
          <div>
            <label>Latitude</label>
            <input
              type="number"
              step={0.0001}
              value={coords.lat}
              onChange={(e) => setCoords((prev) => ({ ...prev, lat: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label>Longitude</label>
            <input
              type="number"
              step={0.0001}
              value={coords.lon}
              onChange={(e) => setCoords((prev) => ({ ...prev, lon: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleWeatherFetch} disabled={weather.loading}>
            {weather.loading ? 'Loading...' : 'Fetch current weather'}
          </button>
        </div>
        {weather.error && <div style={{ marginTop: 8, color: '#f8b4b4' }}>{weather.error}</div>}
        {weather.data && (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {weather.data.iconUrl && <img src={weather.data.iconUrl} width={48} height={48} alt={weather.data.condition} />}
              <div>
                <strong>{weather.data.location || 'Unknown location'}</strong>
                <div className="muted">Updated: {weather.data.updatedAt}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              <Metric label="Temp" value={tempSummary ?? '--'} />
              <Metric label="Feels like" value={feelsSummary ?? '--'} />
              <Metric label="Humidity" value={`${weather.data.humidity.toFixed(0)}%`} />
              <Metric label="Wind" value={`${weather.data.windKph.toFixed(1)} kph (${weather.data.windMph.toFixed(1)} mph)`} />
              <Metric label="Condition" value={weather.data.condition} />
            </div>
          </div>
        )}
      </section>

      <section>
        <h4>Mapbox Preview</h4>
        {mapError && <div style={{ marginBottom: 8, color: '#f8b4b4' }}>{mapError}</div>}
        {mapUrl ? (
          <img src={mapUrl} alt="Mapbox static preview" style={{ maxWidth: '100%', borderRadius: 6, border: '1px solid #314462' }} />
        ) : (
          <div className="muted">{status.map.hint}</div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unexpected error';
}








