import { spawn, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";
import type { ToneMatch, TonePatternDetector } from "./audio";
import type { AppConfig } from "./types";

export interface LinuxAudioRunnerOptions {
  readonly audioSource?: string;
  readonly sampleRate?: number;
  readonly channels?: number;
}

export interface AudioMatchHandler {
  (match: ToneMatch): Promise<void> | void;
}

export class LinuxAudioRunner {
  private process: (ChildProcess & { stdout: Readable }) | null = null;
  private stopped = false;
  private pendingBytes: Uint8Array<ArrayBufferLike> = new Uint8Array(0);

  constructor(
    private readonly config: AppConfig,
    private readonly detector: TonePatternDetector,
    private readonly onMatch: AudioMatchHandler,
    private readonly options: LinuxAudioRunnerOptions = {},
  ) {}

  async start(): Promise<void> {
    if (this.process !== null) {
      return;
    }

    if (process.platform !== "linux") {
      throw new Error("Linux audio capture is only supported on Linux.");
    }

    this.stopped = false;
    this.pendingBytes = new Uint8Array(0);
    const capture = await startCapture(this.options.audioSource ?? this.config.audioSource ?? "@DEFAULT_MONITOR@", this.options.sampleRate ?? 48_000, this.options.channels ?? 2);
    this.process = capture.process;

    this.process.stdout.on("data", (chunk: Buffer) => {
      void this.consume(chunk).catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
      });
    });

    this.process.on("close", () => {
      this.process = null;
      if (!this.stopped) {
        this.stopped = true;
      }
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.pendingBytes = new Uint8Array(0);
    const child = this.process;
    this.process = null;
    if (child === null) {
      return;
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      child.once("close", () => resolve());
    });
  }

  private async consume(chunk: Buffer): Promise<void> {
    this.pendingBytes = concatBytes(this.pendingBytes, chunk);
    const channels = this.options.channels ?? 2;
    const frameBytes = channels * 2;
    const usable = this.pendingBytes.length - (this.pendingBytes.length % frameBytes);
    if (usable === 0) {
      return;
    }

    const samples = decodePcm16le(this.pendingBytes.subarray(0, usable), channels);
    this.pendingBytes = this.pendingBytes.subarray(usable);
    const match = this.detector.push(samples);
    if (match === null) {
      return;
    }

    await this.onMatch(match);
  }
}

async function startCapture(source: string, sampleRate: number, channels: number): Promise<{ readonly process: ChildProcess & { stdout: Readable } }> {
  const attempts: Array<readonly [string, readonly string[]]> = [
    ["pw-record", ["--raw", "--rate", String(sampleRate), "--channels", String(channels), "--format", "s16", "--target", source, "-"]],
    ["parec", ["-d", source, "--format=s16le", "--rate", String(sampleRate), "--channels", String(channels)]],
  ];

  for (const [command, args] of attempts) {
    const process = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const ready = new Promise<boolean>((resolve) => {
      process.once("error", () => resolve(false));
      process.once("spawn", () => resolve(true));
    });
    if (await ready) {
      return { process };
    }
  }

  throw new Error("Could not start Linux audio capture. Install pw-record or parec and point audioSource at a monitor source.");
}

function concatBytes(previous: Uint8Array<ArrayBufferLike>, chunk: Buffer): Uint8Array<ArrayBufferLike> {
  if (previous.length === 0) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }

  const merged = new Uint8Array(previous.length + chunk.length);
  merged.set(previous, 0);
  merged.set(chunk, previous.length);
  return merged;
}

function decodePcm16le(chunk: Uint8Array<ArrayBufferLike>, channels: number): Float32Array {
  const frameBytes = channels * 2;
  const usable = chunk.length - (chunk.length % frameBytes);
  const samples = new Float32Array(usable / frameBytes);
  const view = new DataView(chunk.buffer, chunk.byteOffset, usable);

  for (let offset = 0, index = 0; offset < usable; offset += frameBytes, index += 1) {
    let total = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      total += view.getInt16(offset + channel * 2, true);
    }
    samples[index] = total / channels / 32768;
  }

  return samples;
}
