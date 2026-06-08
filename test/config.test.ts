import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, normalizeConfig, saveConfig } from "../src/config";

afterEach(() => {
  // no-op; each test cleans up its own temp directory.
});

describe("config", () => {
  test("normalizeConfig fills defaults", () => {
    const config = normalizeConfig({ httpPort: 4000, tiers: { rare: { label: "Rare+", cooldownMs: 1, steps: [{ intensity: 0.5, durationMs: 50 }] } } });

    expect(config.intifaceUrl).toBe("ws://127.0.0.1:12345");
    expect(config.httpPort).toBe(4000);
    expect(config.tiers.rare.label).toBe("Rare+");
    expect(config.tiers.unique.label).toBe("Unique");
  });

  test("normalizeConfig preserves default tier fields on partial overrides", () => {
    const config = normalizeConfig({ tiers: { rare: { cooldownMs: 2222 } } });

    expect(config.tiers.rare.label).toBe("Rare");
    expect(config.tiers.rare.cooldownMs).toBe(2222);
    expect(config.tiers.rare.steps).toHaveLength(3);
    expect(config.tiers.rare.audio?.tones).toHaveLength(3);
  });

  test("loadConfig creates missing file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "poe2-buttplug-"));
    const path = join(dir, "config.json");

    const config = await loadConfig(path);
    expect(config.httpPort).toBe(36401);

    const text = await readFile(path, "utf8");
    expect(text).toContain("ws://127.0.0.1:12345");

    await rm(dir, { recursive: true, force: true });
  });

  test("saveConfig writes json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "poe2-buttplug-"));
    const path = join(dir, "config.json");
    const config = normalizeConfig({ httpPort: 9999 });

    await saveConfig(config, path);
    const text = await readFile(path, "utf8");

    expect(text).toContain("9999");
    await rm(dir, { recursive: true, force: true });
  });
});
