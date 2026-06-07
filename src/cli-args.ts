import { defaultConfigPath } from "./config";

export interface CliOptions {
  readonly command: string;
  readonly configPath: string;
  readonly portOverride?: number;
  readonly tier?: string;
  readonly label?: string;
  readonly source?: string;
  readonly audioSource?: string;
  readonly outDir?: string;
  readonly sampleRate?: number;
  readonly kbps?: number;
  readonly positional?: string;
}

export function parseCliArgs(args: readonly string[]): CliOptions {
  const command = args[0] ?? "serve";
  let configPath = defaultConfigPath();
  let portOverride: number | undefined;
  let tier: string | undefined;
  let label: string | undefined;
  let source: string | undefined;
  let audioSource: string | undefined;
  let outDir: string | undefined;
  let sampleRate: number | undefined;
  let kbps: number | undefined;
  let positional: string | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--config" || value === "-c") {
      configPath = args[++index] ?? configPath;
      continue;
    }
    if (value === "--port" || value === "-p") {
      const raw = Number(args[++index]);
      if (Number.isInteger(raw) && raw > 0) {
        portOverride = raw;
      }
      continue;
    }
    if (value === "--tier" || value === "-t") {
      tier = args[++index];
      continue;
    }
    if (value === "--label" || value === "-l") {
      label = args[++index];
      continue;
    }
    if (value === "--source" || value === "-s") {
      source = args[++index];
      continue;
    }
    if (value === "--audio-source" || value === "--monitor") {
      audioSource = args[++index];
      continue;
    }
    if (value === "--out-dir" || value === "-o") {
      outDir = args[++index];
      continue;
    }
    if (value === "--sample-rate" || value === "-r") {
      const raw = Number(args[++index]);
      if (Number.isInteger(raw) && raw > 0) {
        sampleRate = raw;
      }
      continue;
    }
    if (value === "--kbps" || value === "-b") {
      const raw = Number(args[++index]);
      if (Number.isInteger(raw) && raw > 0) {
        kbps = raw;
      }
      continue;
    }
    if (positional === undefined) {
      positional = value;
    }
  }

  return { command, configPath, portOverride, tier, label, source, audioSource, outDir, sampleRate, kbps, positional };
}
