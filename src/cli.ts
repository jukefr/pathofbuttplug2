import { createApp } from "./app";
import { parseCliArgs } from "./cli-args";
import { TonePatternDetector } from "./audio";
import { LinuxAudioRunner } from "./linux-audio";
import { toneManifest, writeSoundPack } from "./sounds";

const parsed = parseCliArgs(process.argv.slice(2));

if (parsed.command === "sounds") {
  const outDir = parsed.outDir ?? "./sounds";
  const sampleRate = parsed.sampleRate ?? 48_000;
  const kbps = parsed.kbps ?? 128;
  const files = await writeSoundPack(outDir, sampleRate, kbps);
  console.log(JSON.stringify({ ok: true, outDir, manifest: toneManifest(sampleRate, kbps), files }, null, 2));
  process.exit(0);
}

const app = await createApp(parsed.configPath);

if (parsed.command === "status") {
  console.log(JSON.stringify({ configPath: parsed.configPath, config: app.config, bridge: app.bridge.status, service: app.service.state }, null, 2));
  process.exit(0);
}

if (parsed.command === "config") {
  console.log(JSON.stringify(app.config, null, 2));
  process.exit(0);
}

if (parsed.command === "emit") {
  const value = parsed.tier ?? parsed.positional ?? "";
  if (value.length === 0) {
    console.error("Missing tier. Use --tier <name>.");
    process.exit(1);
  }
  const result = await app.service.trigger({ tier: value, label: parsed.label, source: parsed.source });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.accepted ? 0 : 2);
}

if (parsed.command === "detect") {
  if (process.platform !== "linux") {
    console.error("Audio detection is only implemented on Linux.");
    process.exit(1);
  }

  const detector = new TonePatternDetector(app.config.tiers, { sampleRate: 48_000 });
  const runner = new LinuxAudioRunner(app.config, detector, async (match) => {
    const result = await app.service.trigger({ tier: match.tier, label: match.label, source: "audio" });
    const payload = { match, result };
    console.log(JSON.stringify(payload));
  }, { audioSource: parsed.audioSource });

  await app.bridge.connect();
  await runner.start();
  process.once("SIGINT", async () => {
    await runner.stop();
    await app.bridge.disconnect();
    process.exit(0);
  });

  console.log(JSON.stringify({ ok: true, audioSource: parsed.audioSource ?? app.config.audioSource ?? "@DEFAULT_MONITOR@" }));
  await new Promise<void>(() => {});
}

const port = parsed.portOverride ?? app.config.httpPort;
Bun.serve({
  port,
  fetch: app.handle,
});
console.log(`poe2-buttplug listening on http://127.0.0.1:${port}`);
console.log(`Intiface: ${app.config.intifaceUrl}`);
