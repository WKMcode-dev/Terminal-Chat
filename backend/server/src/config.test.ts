import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

describe("server production configuration", () => {
  it("listens publicly and permits the native Tauri origins by default", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      JWT_SECRET: "production-secret-with-enough-entropy",
      PORT: "8080",
    });

    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(8080);
    expect(config.corsOrigins).toContain("http://tauri.localhost");
    expect(config.corsOrigins).toContain("tauri://localhost");
  });
});
