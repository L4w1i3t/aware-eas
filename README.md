# AWARE EAS Framework
**Smart Caching and Offline Emergency Warning Systems for Flood Scenarios**

A Progressive Web Application implementing human-centered emergency alert caching strategies with priority-aware cache replacement and location-based filtering for flood warning scenarios.

## Overview

AWARE (Adaptive Warning Architecture for Resilient Emergencies) addresses critical gaps in flood emergency warning systems by implementing smart caching strategies that prioritize both network efficiency and human factors. Unlike traditional approaches that optimize solely for network throughput and latency, AWARE considers cognitive load, redundancy, and actionability under stress.

### Key Innovation: PriorityFresh Cache Policy

AWARE introduces **PriorityFresh**, a novel cache replacement strategy that extends Least Recently Used (LRU) by considering:
- **Temporal freshness** of emergency alerts
- **Semantic priority** based on severity, urgency, and location relevance
- **Human-centered metrics** including redundancy index and actionability

## Architecture

AWARE is implemented as a browser-hosted Progressive Web Application with four cooperating layers:

### 1. UI & Simulation Harness (React/TypeScript)
- **Framework**: Vite-bundled React application
- **Purpose**: Mounts simulation controls and results visualization
- **Scenarios**: Urban, suburban, and rural flood scenarios
- **Policies**: Multiple cache policies including LRU, TTL-only, and PriorityFresh
- **Reproducibility**: Deterministic execution with configurable random seeds

### 2. Simulation Core
- **Clock**: Fixed-step logical clock for reproducible simulations
- **RNG**: Mulberry32 PRNG for deterministic randomness
- **Models**: Network sectors, end devices, and alert workloads
- **API**: `runSim({scenario, policy, seed})` returns `{summary, samples}`

### 3. Offline/Cache Layer (Service Worker)
- **Network-first**: Emergency endpoints (`/api/{alerts,emergency,shelters}`)
- **Cache-first**: Static assets for performance
- **Stale-while-revalidate**: General API traffic
- **Background Sync**: Deferred submission capabilities
- **Push Notifications**: High-priority alert delivery

### 4. Local Data Store (Dexie/IndexedDB)
- **Structured Storage**: Emergency reports, shelter information, simulation metadata
- **Indexes**: Time-bounded queries, severity/urgency filtering, spatial proximity
- **Offline Continuity**: Full functionality without network connectivity

## Data Model

### Emergency Reports (CAP-compatible)
```typescript
interface Report {
  id: string;
  eventType: 'FlashFloodWarning' | 'FloodAdvisory';
  severity: 'Moderate' | 'Severe' | 'Extreme';
  urgency: 'Expected' | 'Immediate';
  certainty?: 'Observed' | 'Likely';
  polygon: string; // GeoJSON or coordinate array
  issuedAt: number; // epoch ms
  expiresAt: number; // epoch ms
  headline?: string;
  instruction?: string;
  sizeBytes?: number;
  geokey?: string; // spatial index key
}
```

### Shelter Information
```typescript
interface Shelter {
  id: string;
  name: string;
  address?: string;
  coordinates: [number, number]; // [lon, lat]
  capacity?: number;
  status: 'open' | 'full' | 'closed';
  updatedAt: number;
  geokey?: string;
}
```

## Smart Caching Algorithm

### PriorityFresh Replacement Strategy

When cache capacity is reached, items are evicted based on:

1. **Expired/stale entries** removed first
2. **Priority scoring** using composite formula:

```
Priority(a) = w₁·S(a) + w₂·U(a) + w₃·F(a) + w₄·L(a)
```

Where:
- `S(a)` = Severity level (Severe=2, Extreme=3)
- `U(a)` = Urgency level (Expected=1, Immediate=2)
- `F(a)` = Freshness factor (time-based decay)
- `L(a)` = Location relevance (1 if inside polygon, else e^(-αd))

3. **LRU tiebreaker** for items with equal priority

### Location-Aware Filtering

Alerts are filtered using distance-weighted relevance:
- **Inside polygon**: Full relevance (R=1)
- **Outside polygon**: Exponential decay based on distance to polygon centroid
- **Geospatial indexing**: Efficient proximity queries using geohash prefixes

## Simulation Scenarios

### Urban Scenario
- **High device density**: 500+ devices per sector
- **Network characteristics**: High throughput, moderate latency
- **Alert patterns**: Dense, overlapping coverage areas

### Suburban Scenario
- **Medium density**: 100-300 devices per sector
- **Mixed infrastructure**: Variable network quality
- **Alert patterns**: Moderate coverage overlap

### Rural Scenario
- **Low density**: 10-50 devices per sector
- **Constrained networks**: Lower throughput, higher latency
- **Alert patterns**: Sparse, large coverage areas

## Performance Metrics

### Traditional Metrics
- **Coverage**: Percentage of devices receiving alerts
- **Latency**: Time from alert issue to device receipt
- **Hit Ratio**: Cache effectiveness measurement
- **Network Load**: Bandwidth utilization

### Human-Centered Metrics
- **Redundancy Index**: Measure of duplicate/overlapping alerts
- **Actionability Ratio**: Proportion of alerts with clear protective actions
- **Timeliness Consistency**: Variance in delivery times within target areas
- **Cognitive Load Score**: Complexity assessment of alert presentation

## Technology Stack

### Core Technologies
- **Frontend**: React + TypeScript + Vite
- **Storage**: Dexie.js (IndexedDB wrapper)
- **Offline**: Service Workers + Cache API
- **Simulation**: Custom deterministic engine
- **Visualization**: React-based charts and metrics display

### Standards Compliance
- **CAP 1.2**: Common Alerting Protocol compatibility
- **WEA 3.0**: Wireless Emergency Alert standards
- **PWA**: Progressive Web App best practices
- **WCAG**: Web accessibility guidelines

## Getting Started

### Prerequisites
- Node.js 18+
- Modern web browser with Service Worker support

### Installation
```bash
npm install
npm run dev
```

### Running Simulations
1. Select scenario (urban/suburban/rural)
2. Choose cache policy (LRU/PriorityFresh/TTL-only)
3. Configure random seed for reproducibility
4. Execute simulation and analyze results

### Viewing Results
- Real-time metrics dashboard
- Exportable simulation data
- Comparative analysis across policies
- Persistent storage in IndexedDB

## Research Applications

### Use Cases
- **Academic Research**: Comparative analysis of caching strategies
- **Emergency Management**: Policy evaluation and optimization
- **Network Planning**: Infrastructure capacity assessment
- **Human Factors**: Cognitive load and stress response studies

### Experimental Design
- **Reproducible**: Deterministic simulation with configurable seeds
- **Scalable**: Support for varying device populations and network conditions
- **Extensible**: Pluggable cache policies and scenario definitions
- **Validated**: Based on real-world emergency alert patterns and network characteristics

## Contributing

AWARE is developed as part of ongoing research into human-centered emergency communication systems. Contributions are welcome in the form of:
- New cache policy implementations
- Additional simulation scenarios
- Performance metric definitions
- User interface improvements

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Citation

```bibtex
@inproceedings{melvin2025aware,
  title={Smart Caching and Offline Emergency Warning Systems for Flood Scenarios: AWARE EAS Framework},
  author={Melvin, Charles and Nguyen, Nhat Rich},
  booktitle={Proceedings of the Emergency Alert Systems Conference},
  year={2025},
  organization={University of Virginia}
}
```