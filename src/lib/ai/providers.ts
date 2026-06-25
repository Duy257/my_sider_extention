import rawProviders from "./providers.json";

type RawProvider = {
  id?: unknown;
  label?: unknown;
  base_url?: unknown;
  model_url?: unknown;
  requires_api_key?: unknown;
  default_model?: unknown;
  known_models?: unknown;
};

export type ProviderDefinition = {
  id: string;
  label: string;
  baseUrl: string;
  modelUrl: string;
  requiresApiKey: boolean;
  defaultModel?: string;
  knownModels: string[];
};

function readRequiredString(provider: RawProvider, field: "id" | "label" | "base_url" | "model_url", label: string): string {
  const value = typeof provider[field] === "string" ? provider[field].trim() : "";
  if (!value) throw new Error(`Provider ${label} is missing ${field}.`);
  return value;
}

export function normalizeProviders(raw: unknown): ProviderDefinition[] {
  if (!Array.isArray(raw)) throw new Error("Provider registry must be an array.");

  const ids = new Set<string>();
  const providers = raw.map((value) => {
    const provider = value as RawProvider;
    const id = readRequiredString(provider, "id", "<unknown>");
    if (ids.has(id)) throw new Error(`Duplicate provider id: ${id}`);
    ids.add(id);

    const label = readRequiredString(provider, "label", id);
    const baseUrl = readRequiredString(provider, "base_url", id);
    const modelUrl = readRequiredString(provider, "model_url", id);
    const defaultModel = typeof provider.default_model === "string" && provider.default_model.trim()
      ? provider.default_model.trim()
      : undefined;
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

  if (providers.length === 0) throw new Error("Provider registry must contain at least one provider.");
  return providers;
}

export const PROVIDERS = normalizeProviders(rawProviders);

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function getDefaultProviderId(): string {
  return getProvider("openai")?.id ?? PROVIDERS[0].id;
}

export function getProviderOptions(): { id: string; label: string }[] {
  return PROVIDERS.map(({ id, label }) => ({ id, label }));
}
