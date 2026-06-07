import { describe, expect, test } from "bun:test";
import { parseCliArgs } from "../src/cli-args";

describe("parseCliArgs", () => {
  test("captures the first positional tier after flags", () => {
    const parsed = parseCliArgs(["emit", "--config", "/tmp/config.json", "--label", "Foo", "rare"]);

    expect(parsed.command).toBe("emit");
    expect(parsed.configPath).toBe("/tmp/config.json");
    expect(parsed.label).toBe("Foo");
    expect(parsed.positional).toBe("rare");
  });
});
