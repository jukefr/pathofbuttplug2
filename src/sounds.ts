import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
// @ts-expect-error lamejs ships without usable types in this package manager setup.
import * as lamejs from "lamejs";

export interface SoundPreset {
  readonly filename: string;
  readonly label: string;
  readonly intensity: "small" | "medium" | "strong";
  readonly tones: readonly number[];
  readonly toneMs: number;
  readonly pauseMs: number;
  readonly amplitude: number;
}

export interface SoundFileInfo extends SoundPreset {
  readonly path: string;
  readonly bytes: number;
}

export interface SoundPackManifest {
  readonly sampleRate: number;
  readonly kbps: number;
  readonly files: readonly SoundPreset[];
}

export const SOUND_PRESETS: readonly SoundPreset[] = [
  { filename: "1maybevaluable.mp3", label: "Maybe Valuable", intensity: "small", tones: [1_800, 2_000, 1_800], toneMs: 70, pauseMs: 45, amplitude: 0.12 },
  { filename: "2currency.mp3", label: "Currency", intensity: "medium", tones: [1_900, 2_100, 2_300], toneMs: 70, pauseMs: 45, amplitude: 0.16 },
  { filename: "3uniques.mp3", label: "Uniques", intensity: "medium", tones: [2_000, 2_200, 2_000, 2_400], toneMs: 65, pauseMs: 40, amplitude: 0.16 },
  { filename: "4maps.mp3", label: "Maps", intensity: "small", tones: [2_100, 2_400, 2_100], toneMs: 75, pauseMs: 55, amplitude: 0.12 },
  { filename: "6veryvaluable.mp3", label: "Very Valuable", intensity: "strong", tones: [2_200, 2_500, 2_800, 3_100], toneMs: 60, pauseMs: 35, amplitude: 0.22 },
];

export async function writeSoundPack(outDir: string, sampleRate = 48_000, kbps = 128): Promise<readonly SoundFileInfo[]> {
  await mkdir(outDir, { recursive: true });
  await ensureLameGlobals();

  const output: SoundFileInfo[] = [];
  for (const preset of SOUND_PRESETS) {
    const bytes = encodeToneClip(preset, sampleRate, kbps);
    const path = join(outDir, preset.filename);
    await writeFile(path, Buffer.from(bytes));
    output.push({ ...preset, path, bytes: bytes.byteLength });
  }

  const manifest = toneManifest(sampleRate, kbps);
  await writeFile(join(outDir, "sound-pack.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return output;
}

export function toneManifest(sampleRate = 48_000, kbps = 128): SoundPackManifest {
  return { sampleRate, kbps, files: SOUND_PRESETS };
}

function encodeToneClip(preset: SoundPreset, sampleRate: number, kbps: number): Uint8Array {
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
  const pcm = makeTonePcm(preset, sampleRate);
  const blockSize = 1152;
  const chunks: Uint8Array[] = [];

  for (let index = 0; index < pcm.length; index += blockSize) {
    const chunk = pcm.subarray(index, index + blockSize);
    const encoded = encoder.encodeBuffer(chunk);
    if (encoded.length > 0) {
      chunks.push(encoded);
    }
  }

  const tail = encoder.flush();
  if (tail.length > 0) {
    chunks.push(tail);
  }

  return concatChunks(chunks);
}

async function ensureLameGlobals(): Promise<void> {
  if (globalThis.MPEGMode !== undefined && globalThis.Lame !== undefined) {
    return;
  }

  globalThis.MPEGMode = {
    STEREO: { ordinal: () => 0 },
    JOINT_STEREO: { ordinal: () => 1 },
    DUAL_CHANNEL: { ordinal: () => 2 },
    MONO: { ordinal: () => 3 },
    NOT_SET: { ordinal: () => 4 },
  };
  globalThis.Lame = {
    LAME_MAXMP3BUFFER: 16384 + 128 * 1024,
    LAME_ID: 0xFFF88E3B,
    V9: 410,
    V8: 420,
    V7: 430,
    V6: 440,
    V5: 450,
    V4: 460,
    V3: 470,
    V2: 480,
    V1: 490,
    V0: 500,
    R3MIX: 1000,
    STANDARD: 1001,
    EXTREME: 1002,
    INSANE: 1003,
    STANDARD_FAST: 1004,
    EXTREME_FAST: 1005,
    MEDIUM: 1006,
    MEDIUM_FAST: 1007,
  };
  globalThis.BitStream = {
    EQ(a: number, b: number): boolean {
      return Math.abs(a) > Math.abs(b)
        ? Math.abs(a - b) <= Math.abs(a) * 1e-6
        : Math.abs(a - b) <= Math.abs(b) * 1e-6;
    },
    NEQ(a: number, b: number): boolean {
      return !this.EQ(a, b);
    },
  };
}

function makeTonePcm(preset: SoundPreset, sampleRate: number): Int16Array {
  const toneSamples = Math.max(1, Math.trunc(sampleRate * (preset.toneMs / 1000)));
  const pauseSamples = Math.max(0, Math.trunc(sampleRate * (preset.pauseMs / 1000)));
  const fadeSamples = Math.max(1, Math.trunc(sampleRate * (8 / 1000)));
  const pcm = new Int16Array((toneSamples + pauseSamples) * preset.tones.length);
  const amplitude = clamp01(preset.amplitude);

  let offset = 0;
  for (const frequencyHz of preset.tones) {
    for (let toneIndex = 0; toneIndex < toneSamples; toneIndex += 1) {
      const attack = Math.min(1, toneIndex / fadeSamples);
      const release = Math.min(1, (toneSamples - toneIndex) / fadeSamples);
      const envelope = Math.min(attack, release);
      const sample = Math.sin((2 * Math.PI * frequencyHz * toneIndex) / sampleRate) * amplitude * envelope;
      pcm[offset + toneIndex] = floatToInt16(sample);
    }

    offset += toneSamples + pauseSamples;
  }

  return pcm;
}

function floatToInt16(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  return clamped < 0 ? Math.trunc(clamped * 0x8000) : Math.trunc(clamped * 0x7fff);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) {
    total += chunk.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
