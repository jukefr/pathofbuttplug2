export type LootTierName = string;

export interface HapticStep {
  readonly intensity: number;
  readonly durationMs: number;
  readonly pauseMs?: number;
}

export interface AudioToneStep {
  readonly frequencyHz: number;
  readonly durationMs?: number;
}

export interface AudioSignature {
  readonly tones: readonly AudioToneStep[];
}

export interface TierProfile {
  readonly label: string;
  readonly cooldownMs: number;
  readonly steps: readonly HapticStep[];
  readonly audio?: AudioSignature;
}

export interface AppConfig {
  readonly intifaceUrl: string;
  readonly httpPort: number;
  readonly deviceName?: string;
  readonly audioSource?: string;
  readonly tiers: Record<string, TierProfile>;
}

export interface LootEvent {
  readonly tier: LootTierName;
  readonly label?: string;
  readonly source?: string;
}

export interface TriggerResult {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly profile?: TierProfile;
}
