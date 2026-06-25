import { useEffect, useState } from "react";
import { getProvider, getProviderOptions } from "../../../src/lib/ai/providers";
import type { LoadModelsResponse, TestConnectionResponse } from "../../../src/lib/messaging/types";
import type { Settings } from "../../../src/lib/storage/types";

export function SettingsPanel(props: {
  settings: Settings;
  onChange: (settings: Settings) => void | Promise<void>;
}) {
  const provider = getProvider(props.settings.providerId) ?? getProvider("openai");
  const providerId = provider?.id ?? "openai";
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<string[]>(provider?.knownModels ?? []);
  const [modelWarning, setModelWarning] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [localApiKey, setLocalApiKey] = useState(props.settings.apiKeys[providerId] ?? "");

  const requiresKey = provider?.requiresApiKey ?? true;
  const selectedModel = props.settings.selectedModels[providerId] ?? "";

  // Sync local API key when provider changes
  useEffect(() => {
    setLocalApiKey(props.settings.apiKeys[providerId] ?? "");
  }, [providerId]);

  function createNextSettings(patch: Partial<Settings>): Settings {
    return { ...props.settings, ...patch, updatedAt: new Date().toISOString() };
  }

  async function commit(next: Settings) {
    await props.onChange(next);
  }

  async function updateApiKey(value: string) {
    setLocalApiKey(value);
    const nextKeys = { ...props.settings.apiKeys };
    if (value.trim()) nextKeys[providerId] = value;
    else delete nextKeys[providerId];
    await commit(createNextSettings({ apiKeys: nextKeys }));
  }

  async function updateSelectedModel(value: string) {
    await commit(createNextSettings({
      selectedModels: { ...props.settings.selectedModels, [providerId]: value }
    }));
  }

  async function updateProvider(value: string) {
    const nextProvider = getProvider(value);
    const nextModels = nextProvider?.knownModels ?? [];
    setModels(nextModels);
    setModelWarning(null);
    setModelError(null);
    const nextKeys = { ...props.settings.apiKeys };
    const existingKey = props.settings.apiKeys[value] ?? "";
    setLocalApiKey(existingKey);
    await commit(createNextSettings({ providerId: value }));
  }

  useEffect(() => {
    let cancelled = false;
    const knownModels = provider?.knownModels ?? [];
    setModels(knownModels);
    setModelError(null);
    setModelWarning(null);

    if (!provider) return;
    if (provider.requiresApiKey && !localApiKey.trim()) {
      if (knownModels.length > 0) setModelWarning("Thêm khóa API để tải mô hình trực tiếp. Đang dùng danh sách mô hình có sẵn.");
      return;
    }

    setLoadingModels(true);
    chrome.runtime.sendMessage({ type: "LOAD_MODELS", requestId: crypto.randomUUID() })
      .then((response: LoadModelsResponse) => {
        if (cancelled) return;
        if (response?.ok) {
          setModels(response.models);
          setModelWarning(null);
          const current = props.settings.selectedModels[provider.id];
          const nextModel = current && response.models.includes(current)
            ? current
            : provider.defaultModel && response.models.includes(provider.defaultModel)
              ? provider.defaultModel
              : response.models[0];
          if (nextModel && nextModel !== current) {
            props.onChange(createNextSettings({ selectedModels: { ...props.settings.selectedModels, [provider.id]: nextModel } }));
          }
        } else if (knownModels.length > 0) {
          setModels(knownModels);
          setModelWarning("Không tải được danh sách mô hình. Đang dùng mô hình có sẵn.");
        } else {
          setModels([]);
          setModelError(response?.error ?? "Không thể tải mô hình.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (knownModels.length > 0) {
          setModels(knownModels);
          setModelWarning("Không tải được danh sách mô hình. Đang dùng mô hình có sẵn.");
        } else {
          setModels([]);
          setModelError("Không thể tải mô hình.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });

    return () => {
      cancelled = true;
    };
  }, [providerId, localApiKey]);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      await props.onChange(props.settings);
      const response: TestConnectionResponse = await chrome.runtime.sendMessage({ type: "TEST_CONNECTION", requestId: crypto.randomUUID() });
      setTestResult(response.ok ? { ok: true, message: "Kết nối thành công." } : { ok: false, message: response.error });
    } catch {
      setTestResult({ ok: false, message: "Không thể gửi yêu cầu kiểm tra." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="space-y-3 p-3">
      <label className="block text-xs text-zinc-400">
        Nhà cung cấp
        <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50" value={providerId} onChange={(event) => updateProvider(event.target.value)}>
          {getProviderOptions().map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>

      <p className="rounded border border-amber-700 bg-amber-950 p-2 text-xs text-amber-100">
        Khóa API được lưu trong bộ nhớ Chrome extension. Đây là phiên bản MVP, chưa mã hóa.
      </p>

      <label className="block text-xs text-zinc-400">
        {requiresKey ? "Khóa API" : "Khóa API (không bắt buộc)"}
        <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50" type="password" value={localApiKey} onChange={(event) => updateApiKey(event.target.value)} />
      </label>

      <label className="block text-xs text-zinc-400">
        Mô hình
        <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50" value={selectedModel} onChange={(event) => updateSelectedModel(event.target.value)} disabled={models.length === 0}>
          {selectedModel && !models.includes(selectedModel) ? <option value={selectedModel}>{selectedModel}</option> : null}
          {models.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
      </label>

      {loadingModels ? <p className="text-xs text-zinc-400">Đang tải mô hình...</p> : null}
      {modelWarning ? <p className="text-xs text-amber-300">{modelWarning}</p> : null}
      {modelError ? <p className="text-xs text-red-400">{modelError}</p> : null}

      <div className="space-y-2">
        <button className="w-full rounded bg-zinc-700 px-3 py-2 text-sm text-zinc-50 hover:bg-zinc-600 disabled:opacity-50" disabled={testing} onClick={handleTestConnection}>
          {testing ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
        </button>
        {testResult ? <p className={`text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>{testResult.message}</p> : null}
      </div>
    </section>
  );
}
