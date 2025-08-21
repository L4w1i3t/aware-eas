import { DevicePopulation, PopulationConfig } from './DevicePopulation';
import { AlertInjector, AlertInjectionConfig, AlertBurst } from './AlertInjector';
import { RandomGenerator } from '@sim/core/RandomGenerator';
import { NetworkState } from '@sim/models/NetworkState';
import { Alert } from '@sim/models/alert';

export interface SimulationConfig {
  population: PopulationConfig;
  alertInjection: AlertInjectionConfig;
  duration: number; // simulation duration in ms
  timeStep: number; // simulation time step in ms
  seed?: number;
}

export interface ScenarioConfig {
  name: string;
  description: string;
  networkDisruptions: {
    time: number; // when to apply disruption (ms from start)
    disruptionRatio: number; // 0-1
    targetSectors?: ('urban' | 'suburban' | 'rural')[];
    duration?: number; // how long disruption lasts
  }[];
  alertBursts: AlertBurst[];
  congestionEvents: {
    time: number;
    congestionRatio: number; // 0-1
    duration: number;
  }[];
}

export interface SimulationEvent {
  time: number;
  type: 'alert' | 'disruption' | 'restoration' | 'congestion' | 'congestion_end';
  data: any;
}

export interface SimulationState {
  currentTime: number;
  devices: DevicePopulation;
  alertInjector: AlertInjector;
  events: SimulationEvent[];
  metrics: {
    alertsGenerated: number;
    alertsDelivered: number;
    alertsDropped: number;
    totalLatency: number;
    cacheHits: number;
    cacheMisses: number;
    duplicatesFiltered: number;
  };
}

export class SimulationHarness {
  private config: SimulationConfig;
  private scenario?: ScenarioConfig;
  private rng: RandomGenerator;
  private state: SimulationState;

  constructor(config: SimulationConfig, scenario?: ScenarioConfig) {
    this.config = config;
    this.scenario = scenario;
    this.rng = new RandomGenerator(config.seed);
    
    this.state = {
      currentTime: 0,
      devices: new DevicePopulation(config.population, this.rng),
      alertInjector: new AlertInjector(config.alertInjection, this.rng),
      events: [],
      metrics: {
        alertsGenerated: 0,
        alertsDelivered: 0,
        alertsDropped: 0,
        totalLatency: 0,
        cacheHits: 0,
        cacheMisses: 0,
        duplicatesFiltered: 0
      }
    };

    this.scheduleScenarioEvents();
  }

  private scheduleScenarioEvents() {
    if (!this.scenario) return;

    // Schedule network disruptions
    this.scenario.networkDisruptions.forEach(disruption => {
      this.state.events.push({
        time: disruption.time,
        type: 'disruption',
        data: disruption
      });

      // Schedule restoration if duration is specified
      if (disruption.duration) {
        this.state.events.push({
          time: disruption.time + disruption.duration,
          type: 'restoration',
          data: { ratio: disruption.disruptionRatio }
        });
      }
    });

    // Schedule alert bursts
    this.scenario.alertBursts.forEach(burst => {
      this.state.alertInjector.scheduleBurst(burst);
    });

    // Schedule congestion events
    this.scenario.congestionEvents.forEach(congestion => {
      this.state.events.push({
        time: congestion.time,
        type: 'congestion',
        data: congestion
      });

      this.state.events.push({
        time: congestion.time + congestion.duration,
        type: 'congestion_end',
        data: congestion
      });
    });

    // Sort events by time
    this.state.events.sort((a, b) => a.time - b.time);
  }

  async run(): Promise<SimulationResults> {
    console.log(`Starting simulation: ${this.scenario?.name || 'Custom'}`);
    const startTime = Date.now();

    while (this.state.currentTime < this.config.duration) {
      await this.processTimeStep();
      this.state.currentTime += this.config.timeStep;
    }

    const endTime = Date.now();
    const realDuration = endTime - startTime;

    console.log(`Simulation completed in ${realDuration}ms (simulated ${this.config.duration}ms)`);

    return this.generateResults();
  }

  private async processTimeStep() {
    // Process scheduled events for this time step
    const currentEvents = this.state.events.filter(
      event => event.time <= this.state.currentTime && event.time > this.state.currentTime - this.config.timeStep
    );

    for (const event of currentEvents) {
      await this.processEvent(event);
    }

    // Generate and process alerts for this time window
    const windowStart = this.state.currentTime;
    const windowEnd = this.state.currentTime + this.config.timeStep;
    
    const alerts = this.state.alertInjector.generateAlertsForWindow(windowStart, windowEnd);
    
    for (const alert of alerts) {
      await this.processAlert(alert);
    }

    // Update metrics
    this.updateMetrics();
  }

  private async processEvent(event: SimulationEvent) {
    switch (event.type) {
      case 'disruption':
        this.state.devices.applyNetworkDisruption(
          event.data.disruptionRatio,
          event.data.targetSectors
        );
        console.log(`Applied network disruption: ${event.data.disruptionRatio * 100}% at ${event.time}ms`);
        break;

      case 'restoration':
        this.state.devices.restoreConnectivity(event.data.ratio);
        console.log(`Restored connectivity: ${event.data.ratio * 100}% at ${event.time}ms`);
        break;

      case 'congestion':
        this.state.devices.applyCongestion(event.data.congestionRatio);
        console.log(`Applied congestion: ${event.data.congestionRatio * 100}% at ${event.time}ms`);
        break;

      case 'congestion_end':
        // Restore congested devices to stable
        const congestedDevices = this.state.devices.getDevices().filter(
          d => d.getNetworkState() === NetworkState.CONGESTED
        );
        congestedDevices.forEach(d => d.setNetworkState(NetworkState.STABLE));
        console.log(`Ended congestion at ${event.time}ms`);
        break;
    }
  }

  private async processAlert(alert: Alert) {
    this.state.metrics.alertsGenerated++;
    
    const connectedDevices = this.state.devices.getConnectedDevices();
    
    for (const device of connectedDevices) {
      try {
        const result = await device.receiveAlert(alert, this.state.currentTime, () => this.rng.next());
        
        if (result.dropped) {
          this.state.metrics.alertsDropped++;
        } else {
          this.state.metrics.alertsDelivered++;
          
          if (result.cacheHit) {
            this.state.metrics.cacheHits++;
          } else {
            this.state.metrics.cacheMisses++;
            if (result.recvAt) {
              this.state.metrics.totalLatency += (result.recvAt - this.state.currentTime);
            }
          }
        }
      } catch (error) {
        console.warn(`Error processing alert ${alert.id} for device ${device.getId()}:`, error);
        this.state.metrics.alertsDropped++;
      }
    }
  }

  private updateMetrics() {
    // Additional metrics calculations can go here
    // For now, most metrics are updated during alert processing
  }

  private generateResults(): SimulationResults {
    const connectivity = this.state.devices.getConnectivityStats();
    const injectorStats = this.state.alertInjector.getStatistics();
    
    const results: SimulationResults = {
      scenario: this.scenario?.name || 'Custom',
      config: this.config,
      duration: this.config.duration,
      seed: this.rng.getSeed(),
      
      // Device metrics
      totalDevices: connectivity.total,
      finalConnectivity: {
        stable: connectivity.stable,
        congested: connectivity.congested,
        partialOutage: connectivity.partialOutage,
        disconnected: connectivity.disconnected
      },
      
      // Alert metrics
      alertsGenerated: this.state.metrics.alertsGenerated,
      alertsDelivered: this.state.metrics.alertsDelivered,
      alertsDropped: this.state.metrics.alertsDropped,
      deliveryRatio: this.state.metrics.alertsGenerated > 0 
        ? this.state.metrics.alertsDelivered / this.state.metrics.alertsGenerated 
        : 0,
      
      // Caching metrics
      cacheHits: this.state.metrics.cacheHits,
      cacheMisses: this.state.metrics.cacheMisses,
      cacheHitRatio: (this.state.metrics.cacheHits + this.state.metrics.cacheMisses) > 0
        ? this.state.metrics.cacheHits / (this.state.metrics.cacheHits + this.state.metrics.cacheMisses)
        : 0,
      
      // Latency metrics
      averageLatency: this.state.metrics.cacheMisses > 0 
        ? this.state.metrics.totalLatency / this.state.metrics.cacheMisses 
        : 0,
      
      // Alert distribution
      alertDistribution: injectorStats,
      
      // Performance
      duplicatesFiltered: this.state.metrics.duplicatesFiltered,
      
      timestamp: Date.now()
    };
    
    return results;
  }

  // Get current simulation state for inspection
  getState(): SimulationState {
    return { ...this.state };
  }

  // Reset simulation for new run
  reset(newSeed?: number) {
    if (newSeed) {
      this.rng.reset(newSeed);
    }
    
    this.state = {
      currentTime: 0,
      devices: new DevicePopulation(this.config.population, this.rng),
      alertInjector: new AlertInjector(this.config.alertInjection, this.rng),
      events: [],
      metrics: {
        alertsGenerated: 0,
        alertsDelivered: 0,
        alertsDropped: 0,
        totalLatency: 0,
        cacheHits: 0,
        cacheMisses: 0,
        duplicatesFiltered: 0
      }
    };

    this.scheduleScenarioEvents();
  }
}

export interface SimulationResults {
  scenario: string;
  config: SimulationConfig;
  duration: number;
  seed: number;
  
  // Device metrics
  totalDevices: number;
  finalConnectivity: {
    stable: number;
    congested: number;
    partialOutage: number;
    disconnected: number;
  };
  
  // Alert metrics
  alertsGenerated: number;
  alertsDelivered: number;
  alertsDropped: number;
  deliveryRatio: number;
  
  // Caching metrics
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: number;
  
  // Latency metrics
  averageLatency: number;
  
  // Alert distribution
  alertDistribution: any;
  
  // Performance
  duplicatesFiltered: number;
  
  timestamp: number;
}
