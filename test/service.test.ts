import { describe, expect, test } from "bun:test";
import { LootHapticsService, type HapticBridge } from "../src/service";
import type { AppConfig, HapticStep } from "../src/types";

class FakeBridge implements HapticBridge {
  connected = false;
  connectCount = 0;
  patterns: HapticStep[][] = [];

  async connect(): Promise<void> {
    this.connected = true;
    this.connectCount += 1;
  }

  async playPattern(steps: readonly HapticStep[]): Promise<void> {
    this.patterns.push([...steps]);
  }
}

class FlakyBridge implements HapticBridge {
  connected = true;
  connectCount = 0;
  patterns: HapticStep[][] = [];
  shouldFail = true;

  async connect(): Promise<void> {
    this.connected = true;
    this.connectCount += 1;
  }

  async playPattern(steps: readonly HapticStep[]): Promise<void> {
    if (this.shouldFail) {
      throw new Error("bridge offline");
    }

    this.patterns.push([...steps]);
  }
}

const config: AppConfig = {
  intifaceUrl: "ws://127.0.0.1:12345",
  httpPort: 36401,
  tiers: {
    rare: {
      label: "Rare",
      cooldownMs: 1000,
      steps: [{ intensity: 0.5, durationMs: 75 }],
    },
    jackpot: {
      label: "Jackpot",
      cooldownMs: 1000,
      steps: [{ intensity: 1, durationMs: 100 }],
    },
  },
};

describe("LootHapticsService", () => {
  test("connects on first trigger and plays the mapped pattern", async () => {
    const bridge = new FakeBridge();
    const service = new LootHapticsService(bridge, config);

    const result = await service.trigger({ tier: "rare", label: "Ring" });

    expect(result.accepted).toBe(true);
    expect(bridge.connectCount).toBe(1);
    expect(bridge.patterns).toHaveLength(1);
    expect(service.state.acceptedEvents).toBe(1);
  });

  test("rejects unknown tiers", async () => {
    const bridge = new FakeBridge();
    const service = new LootHapticsService(bridge, config);

    const result = await service.trigger({ tier: "trash" });

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("Unknown tier");
    expect(bridge.connectCount).toBe(0);
  });

  test("applies cooldown per tier", async () => {
    const bridge = new FakeBridge();
    const service = new LootHapticsService(bridge, config);
    const originalNow = Date.now;

    try {
      Date.now = () => 1_000;
      await service.trigger({ tier: "jackpot" });
      Date.now = () => 1_500;
      const result = await service.trigger({ tier: "jackpot" });

      expect(result.accepted).toBe(false);
      expect(result.reason).toContain("cooling down");
      expect(bridge.patterns).toHaveLength(1);
    } finally {
      Date.now = originalNow;
    }
  });

  test("does not consume cooldown when the bridge fails", async () => {
    const bridge = new FlakyBridge();
    const service = new LootHapticsService(bridge, config);
    const originalNow = Date.now;

    try {
      Date.now = () => 2_000;
      const failed = await service.trigger({ tier: "jackpot" });
      expect(failed.accepted).toBe(false);
      expect(service.state.acceptedEvents).toBe(0);
      expect(service.state.rejectedEvents).toBe(1);

      bridge.shouldFail = false;
      const retry = await service.trigger({ tier: "jackpot" });
      expect(retry.accepted).toBe(true);
      expect(bridge.patterns).toHaveLength(1);
    } finally {
      Date.now = originalNow;
    }
  });
});
