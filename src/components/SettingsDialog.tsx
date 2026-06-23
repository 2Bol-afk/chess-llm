import { useState, useEffect } from "react";
import type { LmSettings } from "../lib/ai";
import { testEndpoint } from "../lib/ai";
import type { AppSettings, GameMode } from "../lib/settings";

function EndpointFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: LmSettings;
  onChange: (v: LmSettings) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    setResult(await testEndpoint(value));
    setTesting(false);
  };

  return (
    <div className="space-y-2 border rounded p-3">
      <div className="text-sm font-semibold">{title}</div>
      <label className="block text-xs text-gray-600">
        Base URL
        <input
          className="mt-1 w-full border rounded px-2 py-1 text-sm"
          value={value.baseUrl}
          placeholder="http://localhost:1234/v1"
          onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
        />
      </label>
      <label className="block text-xs text-gray-600">
        Model name
        <input
          className="mt-1 w-full border rounded px-2 py-1 text-sm"
          value={value.model}
          placeholder="e.g. gemma-2-9b-it"
          onChange={(e) => onChange({ ...value, model: e.target.value })}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-2 py-1 rounded border text-xs disabled:opacity-50"
          onClick={runTest}
          disabled={testing}
        >
          {testing ? "Testing…" : "Test"}
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? "text-green-600" : "text-red-600"}`}>
            {result.ok ? "✅ " : "❌ "}{result.detail}
          </span>
        )}
      </div>
    </div>
  );
}

export function SettingsDialog({
  open,
  settings,
  onSave,
  onClose,
}: {
  open: boolean;
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  useEffect(() => { setDraft(settings); }, [settings, open]);

  if (!open) return null;

  const setMode = (mode: GameMode) => setDraft((d) => ({ ...d, mode }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white text-black rounded-lg p-6 w-[22rem] max-h-[90vh] overflow-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Settings</h2>

        <div>
          <div className="text-sm font-semibold mb-1">Mode</div>
          <div className="flex gap-2">
            <button
              className={`flex-1 px-3 py-1.5 rounded border text-sm ${draft.mode === "human" ? "bg-emerald-600 text-white border-emerald-600" : ""}`}
              onClick={() => setMode("human")}
            >
              You vs AI
            </button>
            <button
              className={`flex-1 px-3 py-1.5 rounded border text-sm ${draft.mode === "ai" ? "bg-emerald-600 text-white border-emerald-600" : ""}`}
              onClick={() => setMode("ai")}
            >
              AI vs AI
            </button>
          </div>
        </div>

        {draft.mode === "ai" && (
          <EndpointFields
            title="White AI"
            value={draft.white}
            onChange={(white) => setDraft((d) => ({ ...d, white }))}
          />
        )}
        <EndpointFields
          title={draft.mode === "ai" ? "Black AI" : "Opponent (Black) AI"}
          value={draft.black}
          onChange={(black) => setDraft((d) => ({ ...d, black }))}
        />

        <p className="text-xs text-gray-500 leading-relaxed">
          For a friend's machine on the same Wi-Fi, use their LAN address, e.g.
          <code className="mx-1 px-1 bg-gray-100 rounded">http://192.168.1.50:1234/v1</code>.
          They must enable <b>CORS</b> in LM Studio (Server settings) and start the server.
        </p>

        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded border" onClick={onClose}>Cancel</button>
          <button
            className="px-3 py-1 rounded bg-black text-white"
            onClick={() => { onSave(draft); onClose(); }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
