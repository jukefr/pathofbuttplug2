import type { AppConfig, HapticStep, LootEvent, TierProfile, TriggerResult } from "./types";

export interface HapticBridge {
  readonly connected: boolean;
  connect(): Promise<void>;
  playPattern(steps: readonly HapticStep[]): Promise<void>;
}

export interface LootHapticsState {
  readonly lastTier?: string;
  readonly lastLabel?: string;
  readonly lastTriggeredAt?: number;
  readonly acceptedEvents: number;
  readonly rejectedEvents: number;
}

export class LootHapticsService {
  private pending: Promise<void> = Promise.resolve();
  private lastTriggeredAtByTier = new Map<string, number>();
  private readonly activeTiers = new Set<string>();
  private acceptedEvents = 0;
  private rejectedEvents = 0;
  private lastTier: string | undefined;
  private lastLabel: string | undefined;
  private lastTriggeredAt: number | undefined;

  constructor(private readonly bridge: HapticBridge, private readonly config: AppConfig) {}

  get state(): LootHapticsState {
    return {
      lastTier: this.lastTier,
      lastLabel: this.lastLabel,
      lastTriggeredAt: this.lastTriggeredAt,
      acceptedEvents: this.acceptedEvents,
      rejectedEvents: this.rejectedEvents,
    };
  }

  getTierProfile(tier: string): TierProfile | undefined {
    return this.config.tiers[tier.toLowerCase()];
  }

  async trigger(event: LootEvent): Promise<TriggerResult> {
    const tier = event.tier.trim().toLowerCase();
    const profile = this.getTierProfile(tier);
    if (profile === undefined) {
      this.rejectedEvents += 1;
      return { accepted: false, reason: `Unknown tier: ${event.tier}` };
    }

    if (this.activeTiers.has(tier)) {
      this.rejectedEvents += 1;
      return { accepted: false, reason: `Tier ${tier} is already active`, profile };
    }

    const now = Date.now();
    const last = this.lastTriggeredAtByTier.get(tier);
    if (last !== undefined && now - last < profile.cooldownMs) {
      this.rejectedEvents += 1;
      return { accepted: false, reason: `Tier ${tier} is cooling down`, profile };
    }

    this.activeTiers.add(tier);
    try {
      if (!this.bridge.connected) {
        await this.bridge.connect();
      }

      const run = this.pending.then(async () => {
        await this.bridge.playPattern(profile.steps);
      });
      this.pending = run.then(() => undefined, () => undefined);

      await run;
      const completedAt = Date.now();
      this.lastTriggeredAtByTier.set(tier, completedAt);
      this.lastTier = tier;
      this.lastLabel = event.label;
      this.lastTriggeredAt = completedAt;
      this.acceptedEvents += 1;
      return { accepted: true, profile };
    } catch (error) {
      this.rejectedEvents += 1;
      return { accepted: false, reason: error instanceof Error ? error.message : String(error), profile };
    } finally {
      this.activeTiers.delete(tier);
    }
  }
}
