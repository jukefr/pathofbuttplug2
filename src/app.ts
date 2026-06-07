import { defaultConfigPath, loadConfig } from "./config";
import { IntifaceBridge, type BridgeStatus } from "./intiface";
import { LootHapticsService } from "./service";
import type { AppConfig, LootEvent, TriggerResult } from "./types";

export interface BridgeController {
  readonly status: BridgeStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface Poe2HapticsApp {
  readonly configPath: string;
  readonly config: AppConfig;
  readonly bridge: BridgeController;
  readonly service: LootHapticsService;
  handle(request: Request): Promise<Response>;
}

export async function createApp(configPath = defaultConfigPath()): Promise<Poe2HapticsApp> {
  const config = await loadConfig(configPath);
  const bridge = new IntifaceBridge(config.intifaceUrl, config.deviceName);
  const service = new LootHapticsService(bridge, config);

  return {
    configPath,
    config,
    bridge,
    service,
    handle: (request) => handleRequest(request, configPath, config, bridge, service),
  };
}

export function createRequestHandler(
  configPath: string,
  config: AppConfig,
  bridge: BridgeController,
  service: LootHapticsService,
): (request: Request) => Promise<Response> {
  return (request) => handleRequest(request, configPath, config, bridge, service);
}

async function handleRequest(
  request: Request,
  configPath: string,
  config: AppConfig,
  bridge: BridgeController,
  service: LootHapticsService,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/") {
    return json({
      name: "poe2-buttplug",
      routes: ["GET /status", "GET /config", "POST /event", "POST /intiface/connect", "POST /intiface/disconnect"],
      configPath,
    });
  }

  if (request.method === "GET" && url.pathname === "/status") {
    return json({
      configPath,
      config,
      bridge: bridge.status,
      service: service.state,
    });
  }

  if (request.method === "GET" && url.pathname === "/config") {
    return json(config);
  }

  if (request.method === "POST" && url.pathname === "/intiface/connect") {
    try {
      await bridge.connect();
      return json({ ok: true, bridge: bridge.status });
    } catch (error) {
      return json({ ok: false, error: message(error) }, 503);
    }
  }

  if (request.method === "POST" && url.pathname === "/intiface/disconnect") {
    await bridge.disconnect();
    return json({ ok: true, bridge: bridge.status });
  }

  if (request.method === "POST" && url.pathname === "/event") {
    const parsed = await parseLootEvent(request);
    if (parsed instanceof Response) {
      return parsed;
    }

    try {
      const result = await service.trigger(parsed);
      return json(result, result.accepted ? 202 : statusFromReason(result));
    } catch (error) {
      return json({ ok: false, error: message(error) }, 503);
    }
  }

  return json({ ok: false, error: "Not found" }, 404);
}

async function parseLootEvent(request: Request): Promise<LootEvent | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Expected JSON body." }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return json({ ok: false, error: "Expected JSON object." }, 400);
  }

  const candidate = body as Partial<LootEvent>;
  if (typeof candidate.tier !== "string" || candidate.tier.length === 0) {
    return json({ ok: false, error: "Missing loot tier." }, 400);
  }

  return {
    tier: candidate.tier,
    label: typeof candidate.label === "string" ? candidate.label : undefined,
    source: typeof candidate.source === "string" ? candidate.source : undefined,
  };
}

function statusFromReason(result: TriggerResult): number {
  if (result.reason?.includes("cooling down")) {
    return 429;
  }
  return 422;
}

function json(body: unknown, status = 200): Response {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
