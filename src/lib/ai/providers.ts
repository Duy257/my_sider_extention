// === QUẢN LÝ DANH SÁCH AI PROVIDER ===

import rawProviders from "./providers.json";

// Cấu trúc thô từ file JSON — các trường là unknown vì chưa được validate
type RawProvider = {
  id?: unknown;
  label?: unknown;
  base_url?: unknown;
  model_url?: unknown;
  requires_api_key?: unknown;
  default_model?: unknown;
  known_models?: unknown;
};

// Định nghĩa chuẩn hóa cho một AI provider sau khi validate
export type ProviderDefinition = {
  id: string;              // định danh duy nhất (vd: "openai", "opencode")
  label: string;           // tên hiển thị (vd: "OpenAI", "OpenCode")
  baseUrl: string;         // URL endpoint chat completions
  modelUrl: string;        // URL endpoint lấy danh sách model
  requiresApiKey: boolean; // có bắt buộc nhập API key không
  defaultModel?: string;   // model mặc định (nếu có)
  knownModels: string[];   // danh sách model đã biết trước
};

// Đọc một trường bắt buộc từ provider, ném lỗi nếu thiếu
function readRequiredString(provider: RawProvider, field: "id" | "label" | "base_url" | "model_url", label: string): string {
  const value = typeof provider[field] === "string" ? provider[field].trim() : "";
  if (!value) throw new Error(`Provider ${label} is missing ${field}.`);
  return value;
}

// Chuẩn hóa dữ liệu providers từ JSON sang mảng ProviderDefinition
// Kiểm tra: phải là mảng, không trùng id, các trường bắt buộc phải có
export function normalizeProviders(raw: unknown): ProviderDefinition[] {
  if (!Array.isArray(raw)) throw new Error("Provider registry must be an array.");

  const ids = new Set<string>();
  const providers = raw.map((value) => {
    const provider = value as RawProvider;
    const id = readRequiredString(provider, "id", "<unknown>");
    // Phát hiện id trùng lặp
    if (ids.has(id)) throw new Error(`Duplicate provider id: ${id}`);
    ids.add(id);

    const label = readRequiredString(provider, "label", id);
    const baseUrl = readRequiredString(provider, "base_url", id);
    const modelUrl = readRequiredString(provider, "model_url", id);
    // Model mặc định là tùy chọn
    const defaultModel = typeof provider.default_model === "string" && provider.default_model.trim()
      ? provider.default_model.trim()
      : undefined;
    // Danh sách model đã biết, loại bỏ trùng lặp và giá trị rỗng
    const knownModels = Array.isArray(provider.known_models)
      ? Array.from(new Set(provider.known_models
          .map((model) => (typeof model === "string" ? model.trim() : ""))
          .filter(Boolean)))
      : [];

    return {
      id,
      label,
      baseUrl,
      modelUrl,
      requiresApiKey: typeof provider.requires_api_key === "boolean" ? provider.requires_api_key : true,
      defaultModel,
      knownModels
    };
  });

  // Phải có ít nhất một provider
  if (providers.length === 0) throw new Error("Provider registry must contain at least one provider.");
  return providers;
}

// Danh sách providers đã được chuẩn hóa, dùng xuyên suốt ứng dụng
export const PROVIDERS = normalizeProviders(rawProviders);

// Tìm provider theo id
export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

// Lấy id của provider mặc định (ưu tiên "openai", fallback về provider đầu tiên)
export function getDefaultProviderId(): string {
  return getProvider("openai")?.id ?? PROVIDERS[0].id;
}

// Lấy danh sách provider dạng { id, label } dùng cho dropdown settings
export function getProviderOptions(): { id: string; label: string }[] {
  return PROVIDERS.map(({ id, label }) => ({ id, label }));
}
