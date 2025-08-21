import { ScenarioConfig } from './SimulationHarness';

/**
 * Research Test Scenarios for AWARE Emergency Alert System
 * These scenarios are designed to test different aspects of the priority-aware caching system
 */

export const RESEARCH_SCENARIOS: Record<string, ScenarioConfig> = {
  // Baseline scenario - no disruptions, normal alert flow
  baseline: {
    name: 'Baseline',
    description: 'Normal operation with stable network conditions and regular alert flow',
    networkDisruptions: [],
    alertBursts: [],
    congestionEvents: []
  },

  // Scenario A: 25% connectivity loss with high congestion
  partialOutage: {
    name: 'Partial Outage (25%)',
    description: '25% of devices lose connectivity, network congestion affects remaining devices',
    networkDisruptions: [
      {
        time: 5 * 60 * 1000, // 5 minutes into simulation
        disruptionRatio: 0.25,
        duration: 15 * 60 * 1000 // lasts 15 minutes
      }
    ],
    alertBursts: [
      {
        startTime: 7 * 60 * 1000, // During outage
        durationMs: 3 * 60 * 1000, // 3 minute burst
        multiplier: 3.0 // 3x normal alert rate
      }
    ],
    congestionEvents: [
      {
        time: 6 * 60 * 1000,
        congestionRatio: 0.4, // 40% of remaining devices congested
        duration: 10 * 60 * 1000
      }
    ]
  },

  // Scenario B: 50% tower outage
  majorOutage: {
    name: 'Major Outage (50%)',
    description: '50% tower outage affecting all device types, with emergency alert burst',
    networkDisruptions: [
      {
        time: 3 * 60 * 1000, // 3 minutes in
        disruptionRatio: 0.5,
        duration: 20 * 60 * 1000 // 20 minute outage
      }
    ],
    alertBursts: [
      {
        startTime: 1 * 60 * 1000, // Before outage
        durationMs: 2 * 60 * 1000,
        multiplier: 2.0
      },
      {
        startTime: 15 * 60 * 1000, // During outage
        durationMs: 5 * 60 * 1000,
        multiplier: 4.0 // High burst during crisis
      }
    ],
    congestionEvents: [
      {
        time: 25 * 60 * 1000, // After outage restoration
        congestionRatio: 0.6, // High congestion as network recovers
        duration: 8 * 60 * 1000
      }
    ]
  },

  // Scenario C: 75% outage with high duplicate injection
  severeOutage: {
    name: 'Severe Outage (75%)',
    description: '75% network outage with high duplicate alert injection rate',
    networkDisruptions: [
      {
        time: 2 * 60 * 1000,
        disruptionRatio: 0.75,
        duration: 25 * 60 * 1000 // Long outage
      }
    ],
    alertBursts: [
      {
        startTime: 4 * 60 * 1000,
        durationMs: 8 * 60 * 1000, // Long burst
        multiplier: 5.0 // Very high alert rate
      },
      {
        startTime: 20 * 60 * 1000,
        durationMs: 4 * 60 * 1000,
        multiplier: 3.0
      }
    ],
    congestionEvents: [
      {
        time: 10 * 60 * 1000,
        congestionRatio: 0.8, // Most remaining devices congested
        duration: 15 * 60 * 1000
      }
    ]
  },

  // Scenario D: Urban-focused disruption
  urbanDisruption: {
    name: 'Urban Disruption',
    description: 'Major disruption affecting primarily urban areas (high device density)',
    networkDisruptions: [
      {
        time: 4 * 60 * 1000,
        disruptionRatio: 0.6,
        targetSectors: ['urban'], // Only urban areas affected
        duration: 18 * 60 * 1000
      }
    ],
    alertBursts: [
      {
        startTime: 6 * 60 * 1000,
        durationMs: 6 * 60 * 1000,
        multiplier: 4.0,
        affectedSectors: ['urban', 'suburban'] // Urban emergency affecting nearby areas
      }
    ],
    congestionEvents: [
      {
        time: 8 * 60 * 1000,
        congestionRatio: 0.7,
        duration: 12 * 60 * 1000
      }
    ]
  },

  // Scenario E: Rural connectivity challenges
  ruralChallenge: {
    name: 'Rural Connectivity Challenge',
    description: 'Simulates rural area connectivity issues with sparse infrastructure',
    networkDisruptions: [
      {
        time: 1 * 60 * 1000,
        disruptionRatio: 0.4,
        targetSectors: ['rural'],
        duration: 30 * 60 * 1000 // Long rural outage
      },
      {
        time: 10 * 60 * 1000,
        disruptionRatio: 0.3,
        targetSectors: ['suburban'], // Cascading effect
        duration: 15 * 60 * 1000
      }
    ],
    alertBursts: [
      {
        startTime: 5 * 60 * 1000,
        durationMs: 10 * 60 * 1000,
        multiplier: 2.5
      }
    ],
    congestionEvents: [
      {
        time: 12 * 60 * 1000,
        congestionRatio: 0.5,
        duration: 18 * 60 * 1000
      }
    ]
  },

  // Scenario F: Cascade failure simulation
  cascadeFailure: {
    name: 'Cascade Failure',
    description: 'Progressive network failure spreading across sectors',
    networkDisruptions: [
      {
        time: 3 * 60 * 1000,
        disruptionRatio: 0.2,
        targetSectors: ['urban'],
        duration: 25 * 60 * 1000
      },
      {
        time: 8 * 60 * 1000,
        disruptionRatio: 0.3,
        targetSectors: ['suburban'],
        duration: 20 * 60 * 1000
      },
      {
        time: 15 * 60 * 1000,
        disruptionRatio: 0.4,
        targetSectors: ['rural'],
        duration: 15 * 60 * 1000
      }
    ],
    alertBursts: [
      {
        startTime: 2 * 60 * 1000,
        durationMs: 4 * 60 * 1000,
        multiplier: 3.0
      },
      {
        startTime: 10 * 60 * 1000,
        durationMs: 6 * 60 * 1000,
        multiplier: 4.0
      }
    ],
    congestionEvents: [
      {
        time: 5 * 60 * 1000,
        congestionRatio: 0.3,
        duration: 8 * 60 * 1000
      },
      {
        time: 18 * 60 * 1000,
        congestionRatio: 0.6,
        duration: 10 * 60 * 1000
      }
    ]
  },

  // Scenario G: High-frequency alert storm
  alertStorm: {
    name: 'Alert Storm',
    description: 'Extreme alert generation rate to test cache performance under load',
    networkDisruptions: [
      {
        time: 10 * 60 * 1000,
        disruptionRatio: 0.3,
        duration: 10 * 60 * 1000
      }
    ],
    alertBursts: [
      {
        startTime: 2 * 60 * 1000,
        durationMs: 3 * 60 * 1000,
        multiplier: 8.0 // Very high rate
      },
      {
        startTime: 8 * 60 * 1000,
        durationMs: 4 * 60 * 1000,
        multiplier: 6.0
      },
      {
        startTime: 15 * 60 * 1000,
        durationMs: 5 * 60 * 1000,
        multiplier: 7.0
      }
    ],
    congestionEvents: [
      {
        time: 1 * 60 * 1000,
        congestionRatio: 0.8, // High congestion throughout
        duration: 25 * 60 * 1000
      }
    ]
  },

  // Scenario H: Recovery stress test
  recoveryStress: {
    name: 'Recovery Stress Test',
    description: 'Tests system behavior during rapid network recovery phases',
    networkDisruptions: [
      {
        time: 5 * 60 * 1000,
        disruptionRatio: 0.6,
        duration: 8 * 60 * 1000 // Short but severe
      },
      {
        time: 20 * 60 * 1000,
        disruptionRatio: 0.4,
        duration: 5 * 60 * 1000 // Quick second disruption
      }
    ],
    alertBursts: [
      {
        startTime: 14 * 60 * 1000, // During recovery
        durationMs: 6 * 60 * 1000,
        multiplier: 5.0
      }
    ],
    congestionEvents: [
      {
        time: 13 * 60 * 1000, // Right at recovery
        congestionRatio: 0.9, // Almost all devices congested
        duration: 4 * 60 * 1000
      },
      {
        time: 26 * 60 * 1000, // Second recovery
        congestionRatio: 0.7,
        duration: 3 * 60 * 1000
      }
    ]
  }
};

// Default configurations for different research focuses
export const SCENARIO_SETS = {
  // Basic comparison set
  basic: ['baseline', 'partialOutage', 'majorOutage'],
  
  // Full research evaluation
  comprehensive: [
    'baseline', 'partialOutage', 'majorOutage', 'severeOutage',
    'urbanDisruption', 'ruralChallenge', 'cascadeFailure'
  ],
  
  // Stress testing
  stress: ['alertStorm', 'recoveryStress', 'cascadeFailure'],
  
  // Sectoral analysis
  sectoral: ['urbanDisruption', 'ruralChallenge', 'cascadeFailure'],
  
  // All scenarios for complete evaluation
  all: Object.keys(RESEARCH_SCENARIOS)
};
