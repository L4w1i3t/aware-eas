export type Point = [number, number];
export type Polygon = Point[]; // closed implied (first!=last, rendered closed)

export type Region = {
  id: string;
  center: Point;
  polygon: Polygon;
  localFactor: number; // local reliability multiplier ~ [0.7..1.3]
  severity: 'Moderate' | 'Severe' | 'Extreme';
};

export type Environment = {
  width: number;
  height: number;
  regions: Region[];
};

