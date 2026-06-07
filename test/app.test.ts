import { describe, expect, test } from "bun:test";
import { createRequestHandler } from "../src/app";
import { LootHapticsService, type HapticBridge } from "../src/service";
import type { AppConfig, HapticStep } from "../src/types";

class StubBridge implements HapticBridge {
  connected = false;
  connectCount = 0;
  disconnectCount = 0;
  patterns: unknown[] = [];
  status = {
    connected: false,
    scanning: false,
    devices: [] as string[],
  };

  async connect(): Promise<void> {
    this.connected = true;
    this.connectCount += 1;
    this.status = { ...this.status, connected: true };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.disconnectCount += 1;
    this.status = { ...this.status, connected: false };
  }

  async playPattern(steps: readonly HapticStep[]): Promise<void> {
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
  },
};

describe("request handler", () => {
  test("accepts loot events and reports status", async () => {
    const bridge = new StubBridge();
    const service = new LootHapticsService(bridge, config);
    const handle = createRequestHandler("/tmp/config.json", config, bridge, service);

    const response = await handle(new Request("http://local/event", {
      method: "POST",
      body: JSON.stringify({ tier: "rare", label: "Chest" }),
    }));

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload.accepted).toBe(true);

    const status = await handle(new Request("http://local/status"));
    const body = await status.json();
    expect(body.service.acceptedEvents).toBe(1);
  });

  test("connect and disconnect routes proxy Intiface", async () => {
    const bridge = new StubBridge();
    const service = new LootHapticsService(bridge, config);
    const handle = createRequestHandler("/tmp/config.json", config, bridge, service);

    const connected = await handle(new Request("http://local/intiface/connect", { method: "POST" }));
    expect(connected.status).toBe(200);
    expect(bridge.connectCount).toBe(1);

    const disconnected = await handle(new Request("http://local/intiface/disconnect", { method: "POST" }));
    expect(disconnected.status).toBe(200);
    expect(bridge.disconnectCount).toBe(1);
  });
});
