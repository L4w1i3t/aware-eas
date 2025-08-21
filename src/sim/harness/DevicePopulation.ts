import { Device } from '@sim/models/device';
import { NetworkState } from '@sim/models/NetworkState';
import { RandomGenerator } from '@sim/core/RandomGenerator';

export interface PopulationConfig {
  totalDevices: number;
  urbanRatio: number; // 0-1, rest are suburban/rural
  subUrbanRatio: number; // of remaining after urban
  initialConnectivity: number; // 0-1, initial connected ratio
}

export class DevicePopulation {
  private devices: Device[] = [];
  private rng: RandomGenerator;

  constructor(config: PopulationConfig, rng: RandomGenerator) {
    this.rng = rng;
    this.generateDevices(config);
  }

  private generateDevices(config: PopulationConfig) {
    const { totalDevices, urbanRatio, subUrbanRatio } = config;
    
    for (let i = 0; i < totalDevices; i++) {
      const deviceId = `device_${i}`;
      let sector: 'urban' | 'suburban' | 'rural';
      
      const roll = this.rng.next();
      if (roll < urbanRatio) {
        sector = 'urban';
      } else if (roll < urbanRatio + (1 - urbanRatio) * subUrbanRatio) {
        sector = 'suburban';
      } else {
        sector = 'rural';
      }
      
      const device = Device.create(deviceId, sector);
      
      // Initial connectivity state
      if (this.rng.next() < config.initialConnectivity) {
        device.setNetworkState(NetworkState.STABLE);
      } else {
        device.setNetworkState(NetworkState.DISCONNECTED);
      }
      
      this.devices.push(device);
    }
  }

  getDevices(): Device[] {
    return this.devices;
  }

  getDeviceById(id: string): Device | undefined {
    return this.devices.find(d => d.getId() === id);
  }

  getDevicesBySector(sector: 'urban' | 'suburban' | 'rural'): Device[] {
    return this.devices.filter(d => d.getSector() === sector);
  }

  getConnectedDevices(): Device[] {
    return this.devices.filter(d => d.getNetworkState() !== NetworkState.DISCONNECTED);
  }

  getDisconnectedDevices(): Device[] {
    return this.devices.filter(d => d.getNetworkState() === NetworkState.DISCONNECTED);
  }

  // Apply network disruption to percentage of devices
  applyNetworkDisruption(disruptionRatio: number, targetSectors?: ('urban' | 'suburban' | 'rural')[]) {
    let targetDevices = this.devices;
    
    if (targetSectors) {
      targetDevices = this.devices.filter(d => targetSectors.includes(d.getSector() as 'urban' | 'suburban' | 'rural'));
    }
    
    const connectedDevices = targetDevices.filter(d => d.getNetworkState() !== NetworkState.DISCONNECTED);
    const devicesToDisrupt = Math.floor(connectedDevices.length * disruptionRatio);
    
    // Shuffle and take first N devices
    for (let i = connectedDevices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [connectedDevices[i], connectedDevices[j]] = [connectedDevices[j], connectedDevices[i]];
    }
    
    for (let i = 0; i < devicesToDisrupt; i++) {
      connectedDevices[i].setNetworkState(NetworkState.DISCONNECTED);
    }
  }

  // Restore connectivity to percentage of disconnected devices
  restoreConnectivity(restorationRatio: number) {
    const disconnectedDevices = this.getDisconnectedDevices();
    const devicesToRestore = Math.floor(disconnectedDevices.length * restorationRatio);
    
    // Shuffle and restore first N devices
    for (let i = disconnectedDevices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [disconnectedDevices[i], disconnectedDevices[j]] = [disconnectedDevices[j], disconnectedDevices[i]];
    }
    
    for (let i = 0; i < devicesToRestore; i++) {
      disconnectedDevices[i].setNetworkState(NetworkState.STABLE);
    }
  }

  // Apply network congestion
  applyCongestion(congestionRatio: number) {
    const stableDevices = this.devices.filter(d => d.getNetworkState() === NetworkState.STABLE);
    const devicesToCongest = Math.floor(stableDevices.length * congestionRatio);
    
    for (let i = stableDevices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [stableDevices[i], stableDevices[j]] = [stableDevices[j], stableDevices[i]];
    }
    
    for (let i = 0; i < devicesToCongest; i++) {
      stableDevices[i].setNetworkState(NetworkState.CONGESTED);
    }
  }

  getConnectivityStats() {
    const stats = {
      total: this.devices.length,
      stable: 0,
      congested: 0,
      partialOutage: 0,
      disconnected: 0
    };
    
    this.devices.forEach(device => {
      switch (device.getNetworkState()) {
        case NetworkState.STABLE:
          stats.stable++;
          break;
        case NetworkState.CONGESTED:
          stats.congested++;
          break;
        case NetworkState.PARTIAL_OUTAGE:
          stats.partialOutage++;
          break;
        case NetworkState.DISCONNECTED:
          stats.disconnected++;
          break;
      }
    });
    
    return stats;
  }
}
