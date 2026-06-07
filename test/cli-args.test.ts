import { describe, expect, test } from "bun:test";
import { parseCliArgs } from "../src/cli-args";

describe("parseCliArgs", () => {
  test("captures the first positional tier after flags", () => {
    const parsed = parseCliArgs(["emit", "--config", "/tmp/config.json", "--label", "Foo", "rare"]);

    expect(parsed.command).toBe("emit");
    expect(parsed.configPath).toBe("/tmp/config.json");
    expect(parsed.label).toBe("Foo");
    expect(parsed.positional).toBe("rare");
  });

  test("captures the audio source flag for detection", () => {
    const parsed = parseCliArgs(["detect", "--audio-source", "alsa_output.monitor"]);

    expect(parsed.command).toBe("detect");
    expect(parsed.audioSource).toBe("alsa_output.monitor");
  });

  test("parses sounds generation options", () => {
    const parsed = parseCliArgs(["sounds", "--out-dir", "./sounds", "--sample-rate", "48000", "--kbps", "96"]);

    expect(parsed.command).toBe("sounds");
    expect(parsed.outDir).toBe("./sounds");
    expect(parsed.sampleRate).toBe(48000);
    expect(parsed.kbps).toBe(96);
  });
});
