import type { AudioSignature, AudioToneStep, TierProfile } from "./types";

export interface ToneMatch {
  readonly tier: string;
  readonly label: string;
}

export interface ToneTrace {
  readonly rms: number;
  readonly bestFrequencyHz: number | null;
  readonly bestPower: number;
  readonly secondPower: number;
  readonly matchedTier?: string;
  readonly reason?: string;
}

interface TonePattern {
  readonly tier: string;
  readonly label: string;
  readonly tones: readonly number[];
}

interface DetectorOptions {
  readonly sampleRate: number;
  readonly frameSize?: number;
  readonly minRms?: number;
  readonly minPowerRatio?: number;
  readonly trace?: (trace: ToneTrace) => void;
}

export class TonePatternDetector {
  private readonly frameSize: number;
  private readonly minRms: number;
  private readonly minPowerRatio: number;
  private readonly frequencies: readonly number[];
  private readonly coefficients: ReadonlyMap<number, number>;
  private readonly patterns: readonly TonePattern[];
  private readonly trace?: (trace: ToneTrace) => void;
  private readonly buffer: number[] = [];
  private readonly sequence: number[] = [];

  constructor(profiles: Record<string, TierProfile>, private readonly options: DetectorOptions) {
    this.frameSize = options.frameSize ?? 2048;
    this.minRms = options.minRms ?? 0.012;
    this.minPowerRatio = options.minPowerRatio ?? 1.8;
    this.trace = options.trace;
    this.patterns = buildPatterns(profiles);
    this.frequencies = uniqueFrequencies(this.patterns);
    this.coefficients = buildCoefficients(this.frequencies, options.sampleRate, this.frameSize);
  }

  push(samples: Float32Array): ToneMatch | null {
    let match: ToneMatch | null = null;
    for (let index = 0; index < samples.length; index += 1) {
      this.buffer.push(samples[index]);
      if (this.buffer.length < this.frameSize) {
        continue;
      }

      const frame = this.buffer.splice(0, this.frameSize);
      if (match === null) {
        match = this.inspectFrame(frame);
      }
    }

    return match;
  }

  private inspectFrame(frame: number[]): ToneMatch | null {
    let energy = 0;
    for (let index = 0; index < frame.length; index += 1) {
      const sample = frame[index];
      energy += sample * sample;
    }

    const rms = Math.sqrt(energy / frame.length);
    if (rms < this.minRms || this.frequencies.length === 0) {
      this.trace?.({
        rms,
        bestFrequencyHz: null,
        bestPower: 0,
        secondPower: 0,
        reason: rms < this.minRms ? "below-rms-threshold" : "no-frequencies-configured",
      });
      return null;
    }

    let bestFrequency = 0;
    let bestPower = 0;
    let secondPower = 0;

    for (let index = 0; index < this.frequencies.length; index += 1) {
      const frequency = this.frequencies[index];
      const power = goertzel(frame, this.coefficients.get(frequency) ?? 0);
      if (power > bestPower) {
        secondPower = bestPower;
        bestPower = power;
        bestFrequency = frequency;
        continue;
      }
      if (power > secondPower) {
        secondPower = power;
      }
    }

    if (bestFrequency === 0 || bestPower <= 0 || bestPower < secondPower * this.minPowerRatio) {
      this.trace?.({
        rms,
        bestFrequencyHz: bestFrequency === 0 ? null : bestFrequency,
        bestPower,
        secondPower,
        reason: bestFrequency === 0 ? "no-dominant-frequency" : "frequency-ambiguous",
      });
      return null;
    }

    if (this.sequence.length === 0 || this.sequence[this.sequence.length - 1] !== bestFrequency) {
      this.sequence.push(bestFrequency);
      if (this.sequence.length > longestPatternLength(this.patterns)) {
        this.sequence.shift();
      }
    }

    const match = matchPattern(this.sequence, this.patterns);
    if (match !== null) {
      this.sequence.length = 0;
    }

    this.trace?.({
      rms,
      bestFrequencyHz: bestFrequency,
      bestPower,
      secondPower,
      matchedTier: match?.tier,
      reason: match === null ? "sequence-building" : "matched",
    });

    return match;
  }
}

function buildPatterns(profiles: Record<string, TierProfile>): readonly TonePattern[] {
  const patterns: TonePattern[] = [];
  for (const [tier, profile] of Object.entries(profiles)) {
    if (profile.audio === undefined || profile.audio.tones.length === 0) {
      continue;
    }

    patterns.push({
      tier,
      label: profile.label,
      tones: profile.audio.tones.map((tone) => tone.frequencyHz),
    });
  }

  patterns.sort((left, right) => right.tones.length - left.tones.length);
  return patterns;
}

function uniqueFrequencies(patterns: readonly TonePattern[]): readonly number[] {
  const seen = new Set<number>();
  const frequencies: number[] = [];
  for (const pattern of patterns) {
    for (const frequency of pattern.tones) {
      if (seen.has(frequency)) {
        continue;
      }
      seen.add(frequency);
      frequencies.push(frequency);
    }
  }
  return frequencies;
}

function buildCoefficients(frequencies: readonly number[], sampleRate: number, frameSize: number): ReadonlyMap<number, number> {
  const coefficients = new Map<number, number>();
  for (const frequency of frequencies) {
    coefficients.set(frequency, 2 * Math.cos((2 * Math.PI * frequency) / sampleRate));
  }
  return coefficients;
}

function goertzel(frame: readonly number[], coefficient: number): number {
  let s1 = 0;
  let s2 = 0;
  for (let index = 0; index < frame.length; index += 1) {
    const next = frame[index] + coefficient * s1 - s2;
    s2 = s1;
    s1 = next;
  }
  return s1 * s1 + s2 * s2 - coefficient * s1 * s2;
}

function longestPatternLength(patterns: readonly TonePattern[]): number {
  let longest = 0;
  for (const pattern of patterns) {
    if (pattern.tones.length > longest) {
      longest = pattern.tones.length;
    }
  }
  return longest;
}

function matchPattern(sequence: readonly number[], patterns: readonly TonePattern[]): ToneMatch | null {
  for (const pattern of patterns) {
    if (pattern.tones.length > sequence.length) {
      continue;
    }

    let matches = true;
    const offset = sequence.length - pattern.tones.length;
    for (let index = 0; index < pattern.tones.length; index += 1) {
      if (sequence[offset + index] !== pattern.tones[index]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { tier: pattern.tier, label: pattern.label };
    }
  }

  return null;
}

export function toneSignature(frequencies: readonly number[]): AudioSignature {
  const tones: AudioToneStep[] = [];
  for (const frequency of frequencies) {
    tones.push({ frequencyHz: frequency });
  }
  return { tones };
}
