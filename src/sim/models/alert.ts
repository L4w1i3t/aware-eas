export interface Alert {
  id: string;
  polygon: [number, number][]; // [lon,lat]
  sizeBytes: number; // payload bundle size
  issuedAt: number; // ms
  expireAt: number; // ms
  urgency: 'Immediate'|'Expected';
  severity: 'Extreme'|'Severe'|'Moderate';
}
