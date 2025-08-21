/**
 * AWARE Research Simulation Harness
 * Complete integration of population, alert injection, scenarios, and metrics
 */

export { DevicePopulation } from './DevicePopulation';
export type { PopulationConfig } from './DevicePopulation';

export { AlertInjector } from './AlertInjector';
export type { AlertInjectionConfig, AlertBurst } from './AlertInjector';

export { SimulationHarness } from './SimulationHarness';
export type { 
  SimulationConfig, 
  ScenarioConfig, 
  SimulationResults,
  SimulationState 
} from './SimulationHarness';

export { ExperimentRunner } from './ExperimentRunner';
export type { ExperimentConfig, ExperimentResults } from './ExperimentRunner';

export { MetricsCollector, compareCachePolicies } from './MetricsCollector';
export type { MetricsAnalysis } from './MetricsCollector';

export { 
  RESEARCH_SCENARIOS, 
  SCENARIO_SETS 
} from './TestScenarios';

export { 
  RESEARCH_EXPERIMENTS 
} from './ExperimentRunner';

export { RandomGenerator } from '@sim/core/RandomGenerator';
export { NetworkState, NETWORK_CONDITIONS } from '@sim/models/NetworkState';

// Convenience function to run a quick experiment
export async function runQuickExperiment() {
  const { RESEARCH_EXPERIMENTS } = await import('./ExperimentRunner');
  const { ExperimentRunner } = await import('./ExperimentRunner');
  
  const runner = new ExperimentRunner(RESEARCH_EXPERIMENTS.quickBaseline);
  const results = await runner.runExperiment();
  
  console.log('Quick experiment completed!');
  console.log('Summary:', results.summary.averageMetrics);
  
  return results;
}

// Convenience function to run comprehensive evaluation
export async function runComprehensiveEvaluation() {
  const { RESEARCH_EXPERIMENTS } = await import('./ExperimentRunner');
  const { ExperimentRunner } = await import('./ExperimentRunner');
  const { MetricsCollector } = await import('./MetricsCollector');
  
  const runner = new ExperimentRunner(RESEARCH_EXPERIMENTS.comprehensive);
  const results = await runner.runExperiment();
  
  const collector = new MetricsCollector();
  collector.addExperimentResults(results);
  const analysis = collector.analyzeMetrics();
  
  console.log('Comprehensive evaluation completed!');
  console.log('Research metrics:', collector.exportForPaper().researchMetrics);
  
  return { results, analysis };
}

// Convenience function for cache policy comparison
export async function compareCachePoliciesExperiment() {
  const { RESEARCH_EXPERIMENTS } = await import('./ExperimentRunner');
  const { ExperimentRunner } = await import('./ExperimentRunner');
  
  console.log('Running cache policy comparison...');
  
  // Run the same experiment with different cache policies
  // (This would need to be extended to actually test different policies)
  const runner = new ExperimentRunner(RESEARCH_EXPERIMENTS.cacheComparison);
  const results = await runner.runExperiment();
  
  console.log('Cache comparison completed!');
  return results;
}

// Export default configuration for easy testing
export const DEFAULT_SIMULATION_CONFIG = {
  population: {
    totalDevices: 1000,
    urbanRatio: 0.4,
    subUrbanRatio: 0.35,
    initialConnectivity: 0.95
  },
  alertInjection: {
    baseRatePerHour: 12,
    burstMultiplier: 3.0,
    duplicateRatio: 0.15,
    priorityDistribution: { extreme: 0.1, severe: 0.3 },
    urgencyDistribution: { immediate: 0.4 }
  },
  duration: 30 * 60 * 1000, // 30 minutes
  timeStep: 5 * 1000, // 5 seconds
  seed: 42
};
