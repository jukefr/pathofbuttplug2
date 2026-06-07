import { createApp } from "./app";
import { parseCliArgs } from "./cli-args";

const parsed = parseCliArgs(process.argv.slice(2));
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

const port = parsed.portOverride ?? app.config.httpPort;
Bun.serve({
  port,
  fetch: app.handle,
});
console.log(`poe2-buttplug listening on http://127.0.0.1:${port}`);
console.log(`Intiface: ${app.config.intifaceUrl}`);
