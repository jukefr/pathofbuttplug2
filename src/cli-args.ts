import { defaultConfigPath } from "./config";

export interface CliOptions {
  readonly command: string;
  readonly configPath: string;
  readonly portOverride?: number;
  readonly tier?: string;
  readonly label?: string;
  readonly source?: string;
  readonly positional?: string;
}

export function parseCliArgs(args: readonly string[]): CliOptions {
  const command = args[0] ?? "serve";
  let configPath = defaultConfigPath();
  let portOverride: number | undefined;
  let tier: string | undefined;
  let label: string | undefined;
  let source: string | undefined;
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
    if (positional === undefined) {
      positional = value;
    }
  }

  return { command, configPath, portOverride, tier, label, source, positional };
}
