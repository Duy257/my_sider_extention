import { useState } from "react";
import { OPENAI_MODEL_PRESETS } from "../../../src/lib/ai/models";
import { PROVIDER_PRESETS, getPreset } from "../../../src/lib/ai/providers";
import type { Settings, CustomProviderConfig } from "../../../src/lib/storage/types";
import type { TestConnectionResponse } from "../../../src/lib/messaging/types";
import { fetchModels } from "../../../src/lib/ai/client";

export function SettingsPanel(props: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelError, setModelError] = useState<string | null>(null);

  function updateField<K extends keyof Settings>(key: K, value: Settings[K]) {
    props.onChange({ ...props.settings, [key]: value, updatedAt: new Date().toISOString() });
  }

  function updateCustomProvider(field: keyof CustomProviderConfig, value: string) {
    const current = props.settings.customProvider ?? { baseUrl: "", apiKey: "", model: "" };
    props.onChange({
      ...props.settings,
      customProvider: { ...current, [field]: value },
      updatedAt: new Date().toISOString()
    });
  }

  async function handleTestConnection() {
    const cp = props.settings.customProvider;
    if (!cp?.baseUrl || !cp?.apiKey || !cp?.model) {
      setTestResult({ ok: false, message: "Fill in Base URL, API Key, and Model first." });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response: TestConnectionResponse = await chrome.runtime.sendMessage({
        type: "TEST_CONNECTION",
        requestId: crypto.randomUUID(),
        baseUrl: cp.baseUrl,
        apiKey: cp.apiKey,
        model: cp.model
      });

      if (response.ok) {
        setTestResult({ ok: true, message: "Connected successfully." });
      } else {
        setTestResult({ ok: false, message: response.error });
      }
    } catch {
      setTestResult({ ok: false, message: "Failed to send test request." });
    } finally {
      setTesting(false);
    }
  }

  async function handleLoadModels() {
    const cp = props.settings.customProvider;
    if (!cp?.baseUrl || !cp?.apiKey) return;

    setLoadingModels(true);
    setModelError(null);

    try {
      const result = await fetchModels({ baseUrl: cp.baseUrl, apiKey: cp.apiKey });
      if ("error" in result) {
        const preset = cp.preset ? getPreset(cp.preset) : undefined;
        if (preset?.knownModels && preset.knownModels.length > 0) {
          setModels(preset.knownModels);
        } else {
          setModelError(result.error);
          setModels([]);
        }
      } else {
        setModels(result.models);
      }
    } catch {
      setModelError("Failed to load models.");
    } finally {
      setLoadingModels(false);
    }
  }

  return (
    <section className="space-y-3 p-3">
      <label className="block text-xs text-zinc-400">
        AI Provider
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
          value={props.settings.provider}
          onChange={(e) => {
            const provider = e.target.value as "openai" | "custom";
            props.onChange({ ...props.settings, provider, updatedAt: new Date().toISOString() });
          }}
        >
          <option value="openai">OpenAI</option>
          <option value="custom">Custom Provider</option>
        </select>
      </label>

      {props.settings.provider === "openai" ? (
        <>
          <p className="rounded border border-amber-700 bg-amber-950 p-2 text-xs text-amber-100">
            Your API key is stored locally in Chrome extension storage for this private MVP. It is not encrypted secret storage.
          </p>
          <label className="block text-xs text-zinc-400">
            OpenAI API key
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              type="password"
              value={props.settings.openaiApiKey ?? ""}
              onChange={(e) => updateField("openaiApiKey", e.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Model preset
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              value={props.settings.modelPreset}
              onChange={(e) => updateField("modelPreset", e.target.value)}
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
              onChange={(e) => updateField("customModel", e.target.value)}
            />
          </label>
        </>
      ) : (
        <>
          <label className="block text-xs text-zinc-400">
            Provider Preset
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              value={props.settings.customProvider?.preset ?? "custom"}
              onChange={(e) => {
                const presetId = e.target.value;
                const preset = getPreset(presetId);
                const current = props.settings.customProvider ?? { baseUrl: "", apiKey: "", model: "" };
                props.onChange({
                  ...props.settings,
                  customProvider: {
                    ...current,
                    preset: presetId,
                    baseUrl: preset?.baseUrl ?? current.baseUrl,
                    model: preset?.defaultModel ?? current.model
                  },
                  updatedAt: new Date().toISOString()
                });
              }}
            >
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-400">
            Base URL
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              placeholder="https://api.opencode.ai/v1/chat/completions"
              value={props.settings.customProvider?.baseUrl ?? ""}
              onChange={(e) => updateCustomProvider("baseUrl", e.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            API Key
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              type="password"
              value={props.settings.customProvider?.apiKey ?? ""}
              onChange={(e) => updateCustomProvider("apiKey", e.target.value)}
            />
          </label>
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <label className="block flex-1 text-xs text-zinc-400">
                Model
                {models.length > 0 ? (
                  <select
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
                    value={props.settings.customProvider?.model ?? ""}
                    onChange={(e) => updateCustomProvider("model", e.target.value)}
                  >
                    {props.settings.customProvider?.model && !models.includes(props.settings.customProvider.model) ? (
                      <option value={props.settings.customProvider.model}>{props.settings.customProvider.model}</option>
                    ) : null}
                    {models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
                    placeholder="gpt-4o-mini"
                    value={props.settings.customProvider?.model ?? ""}
                    onChange={(e) => updateCustomProvider("model", e.target.value)}
                  />
                )}
              </label>
              <button
                className="shrink-0 rounded bg-zinc-700 px-3 py-2 text-xs text-zinc-50 hover:bg-zinc-600 disabled:opacity-50"
                disabled={loadingModels || !props.settings.customProvider?.baseUrl || !props.settings.customProvider?.apiKey}
                onClick={handleLoadModels}
              >
                {loadingModels ? "Loading..." : "Load Models"}
              </button>
            </div>
            {modelError ? (
              <p className="text-xs text-red-400">{modelError}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <button
              className="w-full rounded bg-zinc-700 px-3 py-2 text-sm text-zinc-50 hover:bg-zinc-600 disabled:opacity-50"
              disabled={testing}
              onClick={handleTestConnection}
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {testResult ? (
              <p className={`text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                {testResult.message}
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
