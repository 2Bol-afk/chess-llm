import type { LmSettings } from "./ai";

// One LM Studio endpoint = LmSettings ({ baseUrl, model }). The app holds two of
// them so an AI can play either side; `mode` picks human-vs-AI or AI-vs-AI.
export type GameMode = "human" | "ai";

export type AppSettings = {
  mode: GameMode;
  white: LmSettings; // used as White's brain in AI-vs-AI mode
  black: LmSettings; // the opponent in human mode, and Black's brain in AI-vs-AI
};

const KEY = "chess-lm-settings";
const ENDPOINT_DEFAULT: LmSettings = { baseUrl: "http://localhost:1234/v1", model: "" };
const DEFAULTS: AppSettings = {
  mode: "human",
  white: { ...ENDPOINT_DEFAULT },
  black: { ...ENDPOINT_DEFAULT },
};

function mergeEndpoint(raw: unknown): LmSettings {
  const e = (raw ?? {}) as Partial<LmSettings>;
  return { ...ENDPOINT_DEFAULT, ...e };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<AppSettings> & Partial<LmSettings>;
    // Migrate the old single-endpoint shape ({ baseUrl, model }) into `black`.
    if (parsed.baseUrl !== undefined && parsed.black === undefined) {
      return {
        mode: "human",
        white: { ...ENDPOINT_DEFAULT },
        black: mergeEndpoint(parsed),
      };
    }
    return {
      mode: parsed.mode === "ai" ? "ai" : "human",
      white: mergeEndpoint(parsed.white),
      black: mergeEndpoint(parsed.black),
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
