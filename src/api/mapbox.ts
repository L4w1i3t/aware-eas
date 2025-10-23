import { getMapboxConfig } from './providers';
// Get configuration for Mapbox API
export type StaticMapOptions = {
  center: [number, number];
  zoom?: number;
  width?: number;
  height?: number;
  styleId?: string;
};

// Get geocoding results from Mapbox Places API
export type GeocodeFeature = {
  id: string;
  placeName: string;
  coordinates: [number, number];
};

// Fetch geocoding results from Mapbox Places API
export async function geocodePlaces(query: string, limit = 5): Promise<GeocodeFeature[]> {
  const { token } = getMapboxConfig();
  if (!token) {
    throw new Error('Mapbox token missing (set VITE_MAPBOX_TOKEN).');
  }
  // Construct request URL
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('autocomplete', 'true');
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mapbox geocoding failed (${res.status})`);
  }
  // Parse and validate response
  const data = await res.json();
  const features = Array.isArray(data?.features) ? data.features : [];
  return features
    .filter((feature: any) => Array.isArray(feature?.center) && feature.center.length === 2)
    .map((feature: any) => ({
      id: String(feature.id ?? feature.place_name ?? Math.random()),
      placeName: String(feature.place_name ?? 'Unknown place'),
      coordinates: [Number(feature.center[0]), Number(feature.center[1])]
    }));
}

// Generate a static map image URL from Mapbox Static Images API in the viewport
export function mapboxStaticMapURL(options: StaticMapOptions): string | null {
  const { token, style: styleOverride } = getMapboxConfig();
  if (!token) return null;
  const { center, zoom = 11, width = 480, height = 320, styleId } = options;
  const [lon, lat] = center;
  const clampedWidth = clamp(width, 1, 1280);
  const clampedHeight = clamp(height, 1, 1280);
  const style = resolveStyle(styleOverride ?? styleId);
  const overlay = `pin-l+ff4f00(${lon.toFixed(4)},${lat.toFixed(4)})`;
  const size = `${Math.round(clampedWidth)}x${Math.round(clampedHeight)}`;
  return `https://api.mapbox.com/styles/v1/${style}/static/${overlay}/${lon.toFixed(4)},${lat.toFixed(4)},${zoom}/${size}?access_token=${token}`;
}

// Resolve style ID for Mapbox API
function resolveStyle(styleId: string | undefined): string {
  const trimmedStyle = styleId?.trim();
  if (trimmedStyle) {
    if (trimmedStyle.includes('/')) return trimmedStyle;
    return `mapbox/${trimmedStyle}`;
  }
  return 'mapbox/streets-v12';
}

// Clamp a number within min and max bounds, defaulting to min if invalid
function clamp(value: number | undefined, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
