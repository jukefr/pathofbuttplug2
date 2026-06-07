import { describe, expect, test } from "bun:test";
import { TonePatternDetector } from "../src/audio";
import type { AppConfig, TierProfile } from "../src/types";

const sampleRate = 48_000;

const profiles: Record<string, TierProfile> = {
  rare: {
    label: "Rare",
    cooldownMs: 1_200,
    steps: [{ intensity: 0.4, durationMs: 100 }],
    audio: { tones: [{ frequencyHz: 21_300 }, { frequencyHz: 21_450 }, { frequencyHz: 21_600 }] },
  },
  unique: {
    label: "Unique",
    cooldownMs: 1_000,
    steps: [{ intensity: 0.7, durationMs: 100 }],
    audio: { tones: [{ frequencyHz: 21_000 }, { frequencyHz: 21_150 }, { frequencyHz: 21_300 }, { frequencyHz: 21_450 }] },
  },
};

function sineWave(frequencyHz: number, durationMs: number, amplitude = 0.7): Float32Array {
  const length = Math.trunc(sampleRate * (durationMs / 1_000));
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate);
  }
  return samples;
}

function concat(...parts: Float32Array[]): Float32Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const out = new Float32Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

describe("TonePatternDetector", () => {
  test("matches a configured tone sequence", () => {
    const detector = new TonePatternDetector(profiles, { sampleRate, frameSize: 1_024 });
    const audio = concat(sineWave(21_300, 120), sineWave(21_450, 120), sineWave(21_600, 120));

    const match = detector.push(audio);

    expect(match?.tier).toBe("rare");
    expect(match?.label).toBe("Rare");
  });

  test("ignores a non-matching tone sequence", () => {
    const detector = new TonePatternDetector(profiles, { sampleRate, frameSize: 1_024 });
    const audio = concat(sineWave(19_000, 120), sineWave(19_500, 120));

    const match = detector.push(audio);

    expect(match).toBeNull();
  });
});
