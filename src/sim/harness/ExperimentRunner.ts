import { SimulationHarness, SimulationConfig, SimulationResults } from './SimulationHarness';
import { RESEARCH_SCENARIOS, SCENARIO_SETS } from './TestScenarios';
import { PopulationConfig } from './DevicePopulation';
import { AlertInjectionConfig } from './AlertInjector';

export interface ExperimentConfig {
  name: string;
  description: string;
  scenarios: string[]; // scenario names to run
  seeds: number[]; // random seeds for reproducibility
  populationConfig: PopulationConfig;
  alertConfig: AlertInjectionConfig;
  duration: number; // simulation duration in ms
  timeStep: number; // simulation time step in ms
}

export interface ExperimentResults {
  config: ExperimentConfig;
  results: {
    scenario: string;
    seed: number;
    data: SimulationResults;
  }[];
  summary: {
    totalRuns: number;
    averageMetrics: Record<string, number>;
    scenarioComparison: Record<string, Record<string, number>>;
  };
  timestamp: number;
  durationMs: number;
}

export class ExperimentRunner {
  private config: ExperimentConfig;

  constructor(config: ExperimentConfig) {
    this.config = config;
  }

  async runExperiment(): Promise<ExperimentResults> {
    console.log(`Starting experiment: ${this.config.name}`);
    console.log(`Scenarios: ${this.config.scenarios.join(', ')}`);
    console.log(`Seeds: ${this.config.seeds.length} runs per scenario`);
    
    const startTime = Date.now();
    const results: ExperimentResults['results'] = [];

    let totalRuns = 0;
    const expectedRuns = this.config.scenarios.length * this.config.seeds.length;

    for (const scenarioName of this.config.scenarios) {
      const scenario = RESEARCH_SCENARIOS[scenarioName];
      if (!scenario) {
        console.warn(`Unknown scenario: ${scenarioName}, skipping...`);
        continue;
      }

      console.log(`\nRunning scenario: ${scenario.name}`);
      
      for (const seed of this.config.seeds) {
        totalRuns++;
        console.log(`  Run ${totalRuns}/${expectedRuns} (seed: ${seed})`);
        
        const simConfig: SimulationConfig = {
          population: this.config.populationConfig,
          alertInjection: this.config.alertConfig,
          duration: this.config.duration,
          timeStep: this.config.timeStep,
          seed
        };

        const harness = new SimulationHarness(simConfig, scenario);
        const simResult = await harness.run();

        results.push({
          scenario: scenarioName,
          seed,
          data: simResult
        });
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    console.log(`\nExperiment completed in ${durationMs}ms`);
    console.log(`Ran ${totalRuns} simulations across ${this.config.scenarios.length} scenarios`);

    const experimentResults: ExperimentResults = {
      config: this.config,
      results,
      summary: this.generateSummary(results),
      timestamp: startTime,
      durationMs
    };

    return experimentResults;
  }

  private generateSummary(results: ExperimentResults['results']) {
    const scenarioGroups = new Map<string, SimulationResults[]>();
    
    // Group results by scenario
    for (const result of results) {
      if (!scenarioGroups.has(result.scenario)) {
        scenarioGroups.set(result.scenario, []);
      }
      scenarioGroups.get(result.scenario)!.push(result.data);
    }

    // Calculate average metrics across all runs
    const allResults = results.map(r => r.data);
    const averageMetrics = this.calculateAverageMetrics(allResults);

    // Calculate scenario-specific averages
    const scenarioComparison: Record<string, Record<string, number>> = {};
    for (const [scenarioName, scenarioResults] of scenarioGroups) {
      scenarioComparison[scenarioName] = this.calculateAverageMetrics(scenarioResults);
    }

    return {
      totalRuns: results.length,
      averageMetrics,
      scenarioComparison
    };
  }

  private calculateAverageMetrics(results: SimulationResults[]): Record<string, number> {
    if (results.length === 0) return {};

    const metrics = {
      totalDevices: 0,
      alertsGenerated: 0,
      alertsDelivered: 0,
      alertsDropped: 0,
      deliveryRatio: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRatio: 0,
      averageLatency: 0,
      duplicatesFiltered: 0,
      finalConnectivity_stable: 0,
      finalConnectivity_congested: 0,
      finalConnectivity_partialOutage: 0,
      finalConnectivity_disconnected: 0
    };

    for (const result of results) {
      metrics.totalDevices += result.totalDevices;
      metrics.alertsGenerated += result.alertsGenerated;
      metrics.alertsDelivered += result.alertsDelivered;
      metrics.alertsDropped += result.alertsDropped;
      metrics.deliveryRatio += result.deliveryRatio;
      metrics.cacheHits += result.cacheHits;
      metrics.cacheMisses += result.cacheMisses;
      metrics.cacheHitRatio += result.cacheHitRatio;
      metrics.averageLatency += result.averageLatency;
      metrics.duplicatesFiltered += result.duplicatesFiltered;
      metrics.finalConnectivity_stable += result.finalConnectivity.stable;
      metrics.finalConnectivity_congested += result.finalConnectivity.congested;
      metrics.finalConnectivity_partialOutage += result.finalConnectivity.partialOutage;
      metrics.finalConnectivity_disconnected += result.finalConnectivity.disconnected;
    }

    // Calculate averages
    const count = results.length;
    for (const key in metrics) {
      metrics[key as keyof typeof metrics] /= count;
    }

    return metrics;
  }

  // Export results in different formats
  exportToCSV(results: ExperimentResults): string {
    const headers = [
      'experiment', 'scenario', 'seed', 'totalDevices', 'alertsGenerated', 
      'alertsDelivered', 'alertsDropped', 'deliveryRatio', 'cacheHits', 
      'cacheMisses', 'cacheHitRatio', 'averageLatency', 'duplicatesFiltered',
      'stable', 'congested', 'partialOutage', 'disconnected'
    ];

    const rows = [headers.join(',')];

    for (const result of results.results) {
      const row = [
        results.config.name,
        result.scenario,
        result.seed.toString(),
        result.data.totalDevices.toString(),
        result.data.alertsGenerated.toString(),
        result.data.alertsDelivered.toString(),
        result.data.alertsDropped.toString(),
        result.data.deliveryRatio.toFixed(4),
        result.data.cacheHits.toString(),
        result.data.cacheMisses.toString(),
        result.data.cacheHitRatio.toFixed(4),
        result.data.averageLatency.toFixed(2),
        result.data.duplicatesFiltered.toString(),
        result.data.finalConnectivity.stable.toString(),
        result.data.finalConnectivity.congested.toString(),
        result.data.finalConnectivity.partialOutage.toString(),
        result.data.finalConnectivity.disconnected.toString()
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  exportSummaryToCSV(results: ExperimentResults): string {
    const headers = [
      'scenario', 'avgDeliveryRatio', 'avgCacheHitRatio', 'avgLatency',
      'avgAlertsGenerated', 'avgAlertsDelivered', 'avgAlertsDropped'
    ];

    const rows = [headers.join(',')];

    for (const [scenario, metrics] of Object.entries(results.summary.scenarioComparison)) {
      const row = [
        scenario,
        metrics.deliveryRatio.toFixed(4),
        metrics.cacheHitRatio.toFixed(4),
        metrics.averageLatency.toFixed(2),
        metrics.alertsGenerated.toFixed(1),
        metrics.alertsDelivered.toFixed(1),
        metrics.alertsDropped.toFixed(1)
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}

// Predefined experiment configurations for research
export const RESEARCH_EXPERIMENTS: Record<string, ExperimentConfig> = {
  // Quick baseline comparison
  quickBaseline: {
    name: 'Quick Baseline',
    description: 'Fast baseline comparison across core scenarios',
    scenarios: SCENARIO_SETS.basic,
    seeds: [42, 123, 456], // 3 runs per scenario
    populationConfig: {
      totalDevices: 1000,
      urbanRatio: 0.4,
      subUrbanRatio: 0.4, // 40% urban, 24% suburban, 36% rural
      initialConnectivity: 0.95
    },
    alertConfig: {
      baseRatePerHour: 12, // 1 alert every 5 minutes on average
      burstMultiplier: 3.0,
      duplicateRatio: 0.15,
      priorityDistribution: { extreme: 0.1, severe: 0.3 }, // 10% extreme, 30% severe, 60% moderate
      urgencyDistribution: { immediate: 0.4 } // 40% immediate, 60% expected
    },
    duration: 30 * 60 * 1000, // 30 minutes
    timeStep: 5 * 1000 // 5 second steps
  },

  // Comprehensive research evaluation
  comprehensive: {
    name: 'Comprehensive Research Evaluation',
    description: 'Full scenario matrix for academic publication',
    scenarios: SCENARIO_SETS.comprehensive,
    seeds: [42, 123, 456, 789, 999], // 5 runs per scenario for statistical significance
    populationConfig: {
      totalDevices: 2500,
      urbanRatio: 0.35,
      subUrbanRatio: 0.35,
      initialConnectivity: 0.92
    },
    alertConfig: {
      baseRatePerHour: 20,
      burstMultiplier: 4.0,
      duplicateRatio: 0.25, // Higher duplicate rate for stress testing
      priorityDistribution: { extreme: 0.12, severe: 0.28 },
      urgencyDistribution: { immediate: 0.35 }
    },
    duration: 45 * 60 * 1000, // 45 minutes
    timeStep: 3 * 1000 // 3 second steps for higher resolution
  },

  // Stress testing for algorithm limits
  stressTest: {
    name: 'Stress Test',
    description: 'High-load scenarios to test algorithm breaking points',
    scenarios: SCENARIO_SETS.stress,
    seeds: [42, 123, 456, 789, 999, 111, 222, 333], // 8 runs for stress analysis
    populationConfig: {
      totalDevices: 5000, // Large population
      urbanRatio: 0.5,
      subUrbanRatio: 0.3,
      initialConnectivity: 0.88
    },
    alertConfig: {
      baseRatePerHour: 40, // High base rate
      burstMultiplier: 8.0, // Extreme bursts
      duplicateRatio: 0.4, // Very high duplicate rate
      priorityDistribution: { extreme: 0.2, severe: 0.4 }, // More high-priority alerts
      urgencyDistribution: { immediate: 0.6 }
    },
    duration: 60 * 60 * 1000, // 1 hour simulation
    timeStep: 2 * 1000 // 2 second steps
  },

  // Cache policy comparison focused
  cacheComparison: {
    name: 'Cache Policy Comparison',
    description: 'Focused evaluation for comparing different cache policies',
    scenarios: ['baseline', 'partialOutage', 'alertStorm'],
    seeds: [42, 123, 456, 789, 999, 111, 222, 333, 444, 555], // 10 runs for statistical power
    populationConfig: {
      totalDevices: 1500,
      urbanRatio: 0.4,
      subUrbanRatio: 0.35,
      initialConnectivity: 0.93
    },
    alertConfig: {
      baseRatePerHour: 18,
      burstMultiplier: 5.0,
      duplicateRatio: 0.2,
      priorityDistribution: { extreme: 0.15, severe: 0.35 },
      urgencyDistribution: { immediate: 0.45 }
    },
    duration: 35 * 60 * 1000, // 35 minutes
    timeStep: 4 * 1000 // 4 second steps
  }
};
