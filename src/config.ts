import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { AppConfig, HapticStep, TierProfile } from "./types";

const DEFAULT_TIERS: Record<string, TierProfile> = {
  trash: {
    label: "Trash",
    cooldownMs: 1800,
    steps: [{ intensity: 0.12, durationMs: 100 }],
  },
  normal: {
    label: "Normal",
    cooldownMs: 1600,
    steps: [{ intensity: 0.2, durationMs: 110 }],
  },
  magic: {
    label: "Magic",
    cooldownMs: 1400,
    steps: [
      { intensity: 0.24, durationMs: 100 },
      { intensity: 0.28, durationMs: 85, pauseMs: 40 },
    ],
  },
  rare: {
    label: "Rare",
    cooldownMs: 1200,
    steps: [
      { intensity: 0.32, durationMs: 95 },
      { intensity: 0.42, durationMs: 95, pauseMs: 35 },
      { intensity: 0.5, durationMs: 110, pauseMs: 45 },
    ],
  },
  unique: {
    label: "Unique",
    cooldownMs: 1000,
    steps: [
      { intensity: 0.5, durationMs: 90 },
      { intensity: 0.65, durationMs: 95, pauseMs: 35 },
      { intensity: 0.8, durationMs: 100, pauseMs: 35 },
      { intensity: 0.6, durationMs: 120, pauseMs: 50 },
    ],
  },
  jackpot: {
    label: "Jackpot",
    cooldownMs: 900,
    steps: [
      { intensity: 0.8, durationMs: 90 },
      { intensity: 1, durationMs: 90, pauseMs: 25 },
      { intensity: 1, durationMs: 120, pauseMs: 25 },
      { intensity: 0.9, durationMs: 140, pauseMs: 40 },
      { intensity: 1, durationMs: 160, pauseMs: 60 },
    ],
  },
};

export const DEFAULT_CONFIG: AppConfig = {
  intifaceUrl: "ws://127.0.0.1:12345",
  httpPort: 36401,
  tiers: DEFAULT_TIERS,
};

export function defaultConfigPath(): string {
  const home = homedir();
  const base = process.env.XDG_CONFIG_HOME ?? join(home, ".config");
  return join(base, "poe2-buttplug", "config.json");
}

export function normalizeConfig(raw: unknown): AppConfig {
  const input = typeof raw === "object" && raw !== null ? (raw as Partial<AppConfig>) : {};
  const tiers = typeof input.tiers === "object" && input.tiers !== null ? (input.tiers as Record<string, Partial<TierProfile>>) : {};
  const normalizedTiers: Record<string, TierProfile> = { ...DEFAULT_CONFIG.tiers };

  for (const [name, tier] of Object.entries(tiers)) {
    const fallback = DEFAULT_CONFIG.tiers[name];
    normalizedTiers[name] = {
      label: typeof tier.label === "string" && tier.label.length > 0 ? tier.label : fallback?.label ?? name,
      cooldownMs: typeof tier.cooldownMs === "number" && Number.isFinite(tier.cooldownMs) && tier.cooldownMs > 0 ? tier.cooldownMs : fallback?.cooldownMs ?? 1000,
      steps: normalizeSteps(tier.steps, fallback?.steps),
    };
  }

  return {
    intifaceUrl: typeof input.intifaceUrl === "string" && input.intifaceUrl.length > 0 ? input.intifaceUrl : DEFAULT_CONFIG.intifaceUrl,
    httpPort: typeof input.httpPort === "number" && Number.isInteger(input.httpPort) && input.httpPort > 0 ? input.httpPort : DEFAULT_CONFIG.httpPort,
    deviceName: typeof input.deviceName === "string" && input.deviceName.length > 0 ? input.deviceName : undefined,
    tiers: normalizedTiers,
  };
}

export async function loadConfig(path = defaultConfigPath()): Promise<AppConfig> {
  try {
    const text = await readFile(path, "utf8");
    return normalizeConfig(JSON.parse(text));
  } catch (error) {
    if (isMissing(error)) {
      const config = DEFAULT_CONFIG;
      await saveConfig(config, path);
      return config;
    }
    throw error;
  }
}

export async function saveConfig(config: AppConfig, path = defaultConfigPath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}

function normalizeSteps(rawSteps: unknown, fallback: readonly HapticStep[] | undefined): readonly HapticStep[] {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return fallback ?? [];
  }

  const steps: HapticStep[] = [];
  for (const rawStep of rawSteps) {
    if (typeof rawStep !== "object" || rawStep === null) {
      continue;
    }

    const step = rawStep as Partial<HapticStep>;
    if (typeof step.intensity !== "number" || typeof step.durationMs !== "number") {
      continue;
    }

    steps.push({
      intensity: step.intensity,
      durationMs: step.durationMs,
      pauseMs: typeof step.pauseMs === "number" ? step.pauseMs : undefined,
    });
  }

  return steps.length > 0 ? steps : fallback ?? [];
}
