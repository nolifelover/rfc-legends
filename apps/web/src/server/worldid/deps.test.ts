import { describe, expect, it } from "vitest";
import { devFixturesEnabled } from "./deps";

describe("devFixturesEnabled", () => {
  it("is off by default", () => {
    expect(devFixturesEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("can be switched on for local development and tests", () => {
    expect(devFixturesEnabled({ NODE_ENV: "development", WORLDID_DEV_FIXTURES: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(devFixturesEnabled({ NODE_ENV: "test", WORLDID_DEV_FIXTURES: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("can never be switched on in a production build", () => {
    expect(devFixturesEnabled({ NODE_ENV: "production", WORLDID_DEV_FIXTURES: "true" } as NodeJS.ProcessEnv)).toBe(false);
  });
});
