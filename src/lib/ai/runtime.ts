// === GIẢI QUYẾT CẤU HÌNH AI PROVIDER TỪ SETTINGS ===

import { getProvider } from "./providers";
import type { Settings } from "../storage/types";

// Cấu hình đầy đủ của một provider ở runtime, đã được resolve từ settings
export type ProviderRuntimeConfig = {
  providerId: string;      // id của provider
  providerLabel: string;   // tên hiển thị
  baseUrl: string;         // URL endpoint chat completions
  modelUrl: string;        // URL endpoint lấy danh sách model
  apiKey?: string;         // API key (nếu có)
  model: string;           // model được chọn
  requiresApiKey: boolean; // provider có yêu cầu API key không
  knownModels: string[];   // danh sách model đã biết
};

// Kết quả resolve — dùng discriminated union để xử lý thành công/thất bại
export type ProviderRuntimeResult =
  | { ok: true; config: ProviderRuntimeConfig }
  | { ok: false; error: string };

// Resolve cấu hình runtime từ settings người dùng
// Kiểm tra: provider tồn tại, API key (nếu cần), model được chọn
export function resolveProviderRuntimeConfig(settings: Settings): ProviderRuntimeResult {
  // 1. Kiểm tra provider có tồn tại trong registry không
  const provider = getProvider(settings.providerId);
  if (!provider) {
    return { ok: false, error: "Selected provider is not available. Choose another provider in Settings." };
  }

  // 2. Kiểm tra API key (chỉ bắt buộc với provider yêu cầu)
  const apiKey = settings.apiKeys[provider.id]?.trim() || undefined;
  if (provider.requiresApiKey && !apiKey) {
    return { ok: false, error: `Add your API key for ${provider.label} in Settings.` };
  }

  // 3. Kiểm tra model được chọn (ưu tiên model người dùng chọn, fallback về default)
  const model = settings.selectedModels[provider.id]?.trim() || provider.defaultModel?.trim();
  if (!model) {
    return { ok: false, error: `Select a model for ${provider.label} in Settings.` };
  }

  // Trả về cấu hình hoàn chỉnh
  return {
    ok: true,
    config: {
      providerId: provider.id,
      providerLabel: provider.label,
      baseUrl: provider.baseUrl,
      modelUrl: provider.modelUrl,
      apiKey,
      model,
      requiresApiKey: provider.requiresApiKey,
      knownModels: provider.knownModels
    }
  };
}
