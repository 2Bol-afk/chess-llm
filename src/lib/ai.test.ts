import { describe, it, expect, vi } from "vitest";
import type { LmSettings } from "./ai";
import { getAIMove, testEndpoint } from "./ai";

const settings: LmSettings = { baseUrl: "http://x/v1", model: "gemma" };
const legal = ["e5", "Nf6", "d5"];

function mockReply(content: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response);
}

describe("getAIMove", () => {
  it("returns a legal move the model picked", async () => {
    const f = mockReply("Nf6");
    const move = await getAIMove("fen", legal, settings, f as unknown as typeof fetch);
    expect(move).toBe("Nf6");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("falls back to a legal move after repeated bad replies", async () => {
    const f = mockReply("xyz illegal");
    const move = await getAIMove("fen", legal, settings, f as unknown as typeof fetch);
    expect(legal).toContain(move);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("throws when the endpoint errors", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(
      getAIMove("fen", legal, settings, f as unknown as typeof fetch)
    ).rejects.toThrow();
  });
});

describe("testEndpoint", () => {
  const modelsOk = (ids: string[]) =>
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: ids.map((id) => ({ id })) }) } as unknown as Response);

  it("reports ok when the configured model is loaded", async () => {
    const r = await testEndpoint(settings, modelsOk(["gemma", "other"]) as unknown as typeof fetch);
    expect(r.ok).toBe(true);
  });

  it("reports not-loaded when the model is missing", async () => {
    const r = await testEndpoint(settings, modelsOk(["other"]) as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("gemma");
  });

  it("reports failure when the connection is refused", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await testEndpoint(settings, f as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("Failed to fetch");
  });
});
