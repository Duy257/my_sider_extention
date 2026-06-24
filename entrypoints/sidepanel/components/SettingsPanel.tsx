import { OPENAI_MODEL_PRESETS } from "../../../src/lib/ai/models";
import type { Settings } from "../../../src/lib/storage/types";

export function SettingsPanel(props: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  return (
    <section className="space-y-3 p-3">
      <p className="rounded border border-amber-700 bg-amber-950 p-2 text-xs text-amber-100">
        Your API key is stored locally in Chrome extension storage for this private MVP. It is not encrypted secret storage.
      </p>
      <label className="block text-xs text-zinc-400">
        OpenAI API key
        <input
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
          type="password"
          value={props.settings.openaiApiKey ?? ""}
          onChange={(event) => props.onChange({ ...props.settings, openaiApiKey: event.target.value, updatedAt: new Date().toISOString() })}
        />
      </label>
      <label className="block text-xs text-zinc-400">
        Model preset
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
          value={props.settings.modelPreset}
          onChange={(event) => props.onChange({ ...props.settings, modelPreset: event.target.value, updatedAt: new Date().toISOString() })}
        >
          {OPENAI_MODEL_PRESETS.map((model) => (
            <option key={model.id} value={model.id}>{model.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-zinc-400">
        Custom model
        <input
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
          value={props.settings.customModel ?? ""}
          onChange={(event) => props.onChange({ ...props.settings, customModel: event.target.value, updatedAt: new Date().toISOString() })}
        />
      </label>
    </section>
  );
}
