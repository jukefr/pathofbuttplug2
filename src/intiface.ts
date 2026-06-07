import {
  ButtplugClient,
  ButtplugNodeWebsocketClientConnector,
  DeviceOutput,
  type ButtplugClientDevice,
  OutputType,
} from "buttplug";
import { setTimeout as sleep } from "node:timers/promises";
import type { HapticStep } from "./types";

export interface BridgeStatus {
  readonly connected: boolean;
  readonly scanning: boolean;
  readonly deviceName?: string;
  readonly deviceIndex?: number;
  readonly devices: readonly string[];
}

export class IntifaceBridge {
  private readonly client: ButtplugClient;
  private selectedDevice: ButtplugClientDevice | null = null;
  private readonly deviceNames = new Map<number, string>();
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly url: string, private readonly preferredDeviceName?: string) {
    this.client = new ButtplugClient("PoE2 Loot Haptics");
    this.client.addListener("deviceadded", (device: ButtplugClientDevice) => {
      this.deviceNames.set(device.index, device.name);
      if (this.selectedDevice === null && this.isPreferred(device)) {
        this.selectedDevice = device;
      }
      if (this.selectedDevice === null && device.hasOutput(OutputType.Vibrate)) {
        this.selectedDevice = device;
      }
    });
    this.client.addListener("deviceremoved", (device: ButtplugClientDevice) => {
      this.deviceNames.delete(device.index);
      if (this.selectedDevice?.index === device.index) {
        this.selectedDevice = null;
      }
    });
    this.client.addListener("disconnect", () => {
      this.selectedDevice = null;
    });
  }

  get connected(): boolean {
    return this.client.connected;
  }

  get status(): BridgeStatus {
    return {
      connected: this.client.connected,
      scanning: this.client.isScanning,
      deviceName: this.selectedDevice?.name,
      deviceIndex: this.selectedDevice?.index,
      devices: [...this.deviceNames.values()],
    };
  }

  async connect(): Promise<void> {
    if (this.connectPromise !== null) {
      await this.connectPromise;
      return;
    }

    const connector = new ButtplugNodeWebsocketClientConnector(this.url);
    this.connectPromise = this.client.connect(connector).then(async () => {
      await this.client.startScanning();
    });

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.connected) {
      await this.client.stopAllDevices().catch(() => undefined);
      await this.client.stopScanning().catch(() => undefined);
      await this.client.disconnect();
    }
    this.selectedDevice = null;
    this.deviceNames.clear();
  }

  async playPattern(steps: readonly HapticStep[]): Promise<void> {
    const device = this.requireDevice();

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      await device.runOutput(DeviceOutput.Vibrate.percent(step.intensity));
      await sleep(step.durationMs);
      if (index + 1 < steps.length) {
        await device.stop();
        if ((step.pauseMs ?? 0) > 0) {
          await sleep(step.pauseMs);
        }
      }
    }

    await device.stop();
  }

  private requireDevice(): ButtplugClientDevice {
    const device = this.selectedDevice ?? [...this.client.devices.values()].find((candidate) => candidate.hasOutput(OutputType.Vibrate)) ?? null;
    if (device === null) {
      throw new Error("No vibration-capable device connected to Intiface.");
    }
    this.selectedDevice = device;
    return device;
  }

  private isPreferred(device: ButtplugClientDevice): boolean {
    return this.preferredDeviceName !== undefined && device.name.toLowerCase().includes(this.preferredDeviceName.toLowerCase());
  }
}
