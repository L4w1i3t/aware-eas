import type { Environment, Point, Polygon, Region } from './types';
import type { RNG } from '../core/RandomGenerator';

const MIN_REGION_SPACING = 80;
const MAX_CANDIDATE_ATTEMPTS = 3000;
const SEGMENTS_PER_REGION = 36;

export function generateEnvironment(
  rng: RNG,
  width: number,
  height: number,
  opts?: { regions?: number }
): Environment {
  const count = Math.max(1, opts?.regions ?? 8);
  const centers = pickCenters(rng, width, height, count);
  const regions: Region[] = centers.map((center, idx) => {
    const polygon = buildVoronoiPolygon(idx, centers, width, height, rng);
    const localFactor = clamp(0.7, 1.3, 0.9 + (rng() - 0.5) * 0.6);
    const severity: Region['severity'] = rng() < 0.15 ? 'Extreme' : rng() < 0.55 ? 'Severe' : 'Moderate';
    return {
      id: `R${idx + 1}`,
      center,
      polygon,
      localFactor,
      severity
    };
  });
  return { width, height, regions };
}

function pickCenters(rng: RNG, width: number, height: number, count: number): Point[] {
  const centers: Point[] = [];
  const minSpacing = Math.max(40, Math.min(width, height) / Math.sqrt(count)) * 0.8;
  let attempts = 0;
  while (centers.length < count && attempts < MAX_CANDIDATE_ATTEMPTS) {
    attempts++;
    const candidate: Point = [
      60 + rng() * (width - 120),
      60 + rng() * (height - 120)
    ];
    if (centers.every((existing) => distance(existing, candidate) >= minSpacing)) {
      centers.push(candidate);
    }
  }
  // If we still need more centers (pathological case), allow closer placement.
  while (centers.length < count) {
    centers.push([
      60 + rng() * (width - 120),
      60 + rng() * (height - 120)
    ]);
  }
  return centers;
}

function buildVoronoiPolygon(index: number, centers: Point[], width: number, height: number, rng: RNG): Polygon {
  const [cx, cy] = centers[index];
  const pts: Point[] = [];
  for (let i = 0; i < SEGMENTS_PER_REGION; i++) {
    const angle = (Math.PI * 2 * i) / SEGMENTS_PER_REGION;
    const dir: Point = [Math.cos(angle), Math.sin(angle)];
    let limit = distanceToBounds(cx, cy, dir, width, height);
    for (let j = 0; j < centers.length; j++) {
      if (j === index) continue;
      const candidate = distanceToBisector([cx, cy], centers[j], dir);
      if (candidate > 0 && candidate < limit) {
        limit = candidate;
      }
    }
    const jitter = 0.78 + rng() * 0.18; // keep inside the boundary for variety
    const radius = Math.max(25, limit * jitter);
    const x = clamp(0, width, cx + dir[0] * radius);
    const y = clamp(0, height, cy + dir[1] * radius);
    pts.push([x, y]);
  }
  return pts;
}

function distanceToBounds(cx: number, cy: number, dir: Point, width: number, height: number): number {
  const [dx, dy] = dir;
  const eps = 1e-6;
  let t = Number.POSITIVE_INFINITY;
  if (Math.abs(dx) > eps) {
    const tx1 = (0 - cx) / dx;
    const tx2 = (width - cx) / dx;
    if (tx1 > eps) t = Math.min(t, tx1);
    if (tx2 > eps) t = Math.min(t, tx2);
  }
  if (Math.abs(dy) > eps) {
    const ty1 = (0 - cy) / dy;
    const ty2 = (height - cy) / dy;
    if (ty1 > eps) t = Math.min(t, ty1);
    if (ty2 > eps) t = Math.min(t, ty2);
  }
  if (!Number.isFinite(t) || t <= 0) {
    return Math.max(width, height); // fallback
  }
  return t;
}

function distanceToBisector(center: Point, other: Point, dir: Point): number {
  const dx = other[0] - center[0];
  const dy = other[1] - center[1];
  const proj = dx * dir[0] + dy * dir[1];
  if (proj <= 0) return Number.POSITIVE_INFINITY;
  const distSq = dx * dx + dy * dy;
  return distSq / (2 * proj);
}

function distance(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(min: number, max: number, x: number) {
  return Math.max(min, Math.min(max, x));
}
