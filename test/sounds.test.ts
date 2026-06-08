import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SOUND_PRESETS, writeSoundPack } from "../src/sounds";

describe("writeSoundPack", () => {
  test("creates the expected mp3 filenames and manifest", async () => {
    const dir = await mkdtemp(join(tmpdir(), "poe2-sounds-"));

    try {
      const files = await writeSoundPack(dir, 48_000, 96);
      expect(files).toHaveLength(SOUND_PRESETS.length);
      expect(files.map((file) => file.filename)).toEqual(SOUND_PRESETS.map((preset) => preset.filename));

      const manifest = JSON.parse(await readFile(join(dir, "sound-pack.json"), "utf8"));
      expect(manifest.files).toHaveLength(5);
      expect(manifest.files[0].filename).toBe("1maybevaluable.mp3");
      expect(manifest.sampleRate).toBe(48_000);
      expect(manifest.kbps).toBe(96);
      expect(manifest.files[0].tones).toEqual([1_800, 2_000, 1_800]);
      expect(manifest.files[4].tones).toEqual([2_200, 2_500, 2_800, 3_100]);

      const mp3 = await readFile(join(dir, "2currency.mp3"));
      expect(mp3.byteLength).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
