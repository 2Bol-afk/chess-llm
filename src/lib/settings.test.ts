import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings, saveSettings } from "./settings";

beforeEach(() => localStorage.clear());

const ep = { baseUrl: "http://localhost:1234/v1", model: "" };

describe("settings", () => {
  it("returns defaults when nothing stored", () => {
    expect(loadSettings()).toEqual({ mode: "human", white: ep, black: ep });
  });

  it("round-trips saved settings", () => {
    const s = {
      mode: "ai" as const,
      white: { baseUrl: "http://localhost:1234/v1", model: "gemma-a" },
      black: { baseUrl: "http://192.168.1.50:1234/v1", model: "gemma-b" },
    };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });

  it("migrates the old single-endpoint shape into the Black endpoint", () => {
    localStorage.setItem("chess-lm-settings", JSON.stringify({ baseUrl: "http://host/v1", model: "old" }));
    expect(loadSettings()).toEqual({
      mode: "human",
      white: ep,
      black: { baseUrl: "http://host/v1", model: "old" },
    });
  });
});
