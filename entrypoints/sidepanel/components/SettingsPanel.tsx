import { useEffect, useState } from "react";
import { getProvider, getProviderOptions } from "../../../src/lib/ai/providers";
import type { LoadModelsResponse, TestConnectionResponse } from "../../../src/lib/messaging/types";
import type { Settings } from "../../../src/lib/storage/types";

function EyeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5 text-stone-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg className="h-4 w-4 transition-transform duration-500 group-hover:rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a6 6 0 0 1-12 0V8" />
    </svg>
  );
}

function ModelSkeleton() {
  return <div className="h-10 w-full animate-pulse rounded-xl bg-warm-bg border border-stone-800" />;
}

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
  const [showKey, setShowKey] = useState(false);

  const requiresKey = provider?.requiresApiKey ?? true;
  const selectedModel = props.settings.selectedModels[providerId] ?? "";

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
      if (knownModels.length > 0) {
        setModelWarning("Thêm khóa API để tải mô hình trực tiếp. Đang dùng danh sách mô hình có sẵn.");
      }
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

    return () => { cancelled = true; };
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
    <section className="space-y-4 p-3.5 animate-fade-in-up">
      {/* Provider Card */}
      <div className="rounded-2xl bg-surface border border-stone-850 p-4 shadow-sm hover:border-stone-800 transition-all duration-300">
        <label htmlFor="provider-select" className="block text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Nhà cung cấp
        </label>
        <div className="relative mt-2">
          <select
            id="provider-select"
            className="w-full appearance-none rounded-xl border border-stone-850 bg-warm-bg px-3.5 py-3 text-[13.5px] font-medium text-stone-100 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-colors shadow-inner"
            value={providerId}
            onChange={(event) => updateProvider(event.target.value)}
          >
            {getProviderOptions().map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <ChevronIcon />
        </div>
      </div>

      {/* Security Warning Panel */}
      <div className="flex items-start gap-3 rounded-2xl border border-stone-800 bg-stone-900/40 px-4 py-3 text-xs text-stone-400">
        <ShieldIcon />
        <span className="leading-relaxed">Khóa API được lưu trữ cục bộ trong bộ nhớ ẩn Chrome. Đây là phiên bản thử nghiệm, thông tin chưa được mã hóa nâng cao.</span>
      </div>

      {/* API Key Card */}
      <div className="rounded-2xl bg-surface border border-stone-850 p-4 shadow-sm hover:border-stone-800 transition-all duration-300">
        <label htmlFor="api-key-input" className="block text-xs font-semibold text-stone-400 uppercase tracking-wider">
          {requiresKey ? "Khóa API" : "Khóa API (không bắt buộc)"}
        </label>
        <div className="relative mt-2">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
            <LockIcon />
          </div>
          <input
            id="api-key-input"
            className="w-full rounded-xl border border-stone-850 bg-warm-bg py-3 pl-10 pr-10 text-[13.5px] text-stone-100 placeholder-stone-600 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-colors shadow-inner"
            type={showKey ? "text" : "password"}
            value={localApiKey}
            onChange={(event) => updateApiKey(event.target.value)}
            placeholder="Nhập khóa API..."
          />
          <button
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors"
            type="button"
            title="Hiện/ẩn khóa API"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {/* Model Card */}
      <div className="rounded-2xl bg-surface border border-stone-850 p-4 shadow-sm hover:border-stone-800 transition-all duration-300">
        <label htmlFor="model-select" className="block text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Mô hình
        </label>
        <div className="relative mt-2">
          {loadingModels ? (
            <ModelSkeleton />
          ) : (
            <select
              id="model-select"
              className="w-full appearance-none rounded-xl border border-stone-850 bg-warm-bg px-3.5 py-3 text-[13.5px] font-medium text-stone-100 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-colors shadow-inner disabled:opacity-50"
              value={selectedModel}
              onChange={(event) => updateSelectedModel(event.target.value)}
              disabled={models.length === 0}
            >
              {selectedModel && !models.includes(selectedModel) ? <option value={selectedModel}>{selectedModel}</option> : null}
              {models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          )}
          {!loadingModels && <ChevronIcon />}
        </div>
        {!loadingModels && modelWarning ? (
          <div className="mt-2.5 flex items-start gap-1.5 text-xs text-amber-400 font-medium">
            <span className="mt-0.5">⚠️</span> <span>{modelWarning}</span>
          </div>
        ) : null}
        {!loadingModels && modelError ? (
          <div className="mt-2.5 flex items-start gap-1.5 text-xs text-red-400 font-medium">
            <span className="mt-0.5">❌</span> <span>{modelError}</span>
          </div>
        ) : null}
      </div>

      {/* Connection Test Card */}
      <div className="rounded-2xl bg-surface border border-stone-850 p-4 shadow-sm hover:border-stone-800 transition-all duration-300">
        <button
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-white hover:bg-primary-dark py-3 text-[13px] font-semibold transition-all duration-300 shadow-md shadow-primary/10 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          disabled={testing}
          onClick={handleTestConnection}
        >
          {testing ? (
            <svg className="h-4 w-4 animate-spinner" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <PlugIcon />
          )}
          {testing ? "Đang kiểm tra kết nối..." : "Kiểm tra kết nối"}
        </button>
        {testResult ? (
          <div className={`mt-3 flex items-start gap-1.5 text-xs font-semibold px-1 ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>
            {testResult.ok ? <span>✅</span> : <span>❌</span>}
            <span className="leading-relaxed">{testResult.message}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
