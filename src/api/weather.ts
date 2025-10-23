import { getWeatherApiKey } from './providers';

// Weather data constructor
export type WeatherSnapshot = {
  location: string;
  condition: string;
  temperatureC: number;
  temperatureF: number;
  humidity: number;
  windKph: number;
  windMph: number;
  feelsLikeC: number;
  feelsLikeF: number;
  updatedAt: string;
  iconUrl?: string;
};

type WeatherParams = {
  lat: number;
  lon: number;
};

const WEATHER_API_BASE = 'https://api.weatherapi.com/v1';

// Fetch current weather data from Weather API
export async function fetchCurrentWeather({ lat, lon }: WeatherParams): Promise<WeatherSnapshot> {
  const key = getWeatherApiKey();
  if (!key) {
    throw new Error('Weather API key missing (set VITE_WEATHER_API_KEY).');
  }
  const params = new URLSearchParams({
    key,
    q: `${lat},${lon}`,
    aqi: 'no'
  });
  const url = `${WEATHER_API_BASE}/current.json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Weather request failed (${res.status})`);
  }
  const data = await res.json();
  if (data?.error) {
    throw new Error(data.error.message ?? 'Weather provider returned an error.');
  }
  const locationParts = [data?.location?.name, data?.location?.region, data?.location?.country]
    .filter((part: string | undefined) => part && part.trim())
    .map((part: string) => part.trim());
  return {
    location: locationParts.join(', '),
    condition: data?.current?.condition?.text ?? 'Unknown',
    temperatureC: Number(data?.current?.temp_c ?? 0),
    temperatureF: Number(data?.current?.temp_f ?? 0),
    feelsLikeC: Number(data?.current?.feelslike_c ?? 0),
    feelsLikeF: Number(data?.current?.feelslike_f ?? 0),
    humidity: Number(data?.current?.humidity ?? 0),
    windKph: Number(data?.current?.wind_kph ?? 0),
    windMph: Number(data?.current?.wind_mph ?? 0),
    updatedAt: data?.current?.last_updated ?? '',
    iconUrl: data?.current?.condition?.icon ? sanitizeIcon(data.current.condition.icon) : undefined
  };
}

// Sanitize icon URL from weather API
function sanitizeIcon(icon: string): string {
  if (!icon) return icon;
  if (icon.startsWith('http')) return icon;
  return icon.startsWith('//') ? `https:${icon}` : `https://${icon.replace(/^\/+/, '')}`;
}
