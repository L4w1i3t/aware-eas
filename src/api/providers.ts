export type ProviderStatus = {
  configured: boolean;
  hint: string;
};

type MapboxConfig = {
  token: string;
  username?: string;
  style?: string;
};

function readEnv(key: string): string {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  if (!env || !(key in env)) return '';
  const value = (env as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : value?.toString?.().trim() ?? '';
}

export function getWeatherApiKey(): string {
  return readEnv('VITE_WEATHER_API_KEY');
}

export function getMapboxConfig(): MapboxConfig {
  return {
    token: readEnv('VITE_MAPBOX_TOKEN'),
    username: readEnv('VITE_MAPBOX_USERNAME') || undefined,
    style: readEnv('VITE_MAPBOX_STYLE') || undefined
  };
}

export function weatherProviderStatus(): ProviderStatus {
  const key = getWeatherApiKey();
  if (key) {
    return { configured: true, hint: 'Weather provider configured (VITE_WEATHER_API_KEY detected).' };
  }
  return { configured: false, hint: 'Set VITE_WEATHER_API_KEY to enable live weather ingest.' };
}

export function mapboxProviderStatus(): ProviderStatus {
  const { token, username, style } = getMapboxConfig();
  if (!token) {
    return { configured: false, hint: 'Set VITE_MAPBOX_TOKEN for map overlays.' };
  }
  if (style) {
    return { configured: true, hint: `Mapbox ready (style ${style}).` };
  }
  if (username) {
    return { configured: true, hint: `Mapbox token ready (default mapbox/streets-v12; set VITE_MAPBOX_STYLE for ${username}/style-id).` };
  }
  return { configured: true, hint: 'Mapbox token ready (defaulting to mapbox/streets-v12).' };
}
