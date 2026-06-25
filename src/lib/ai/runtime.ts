import { getProvider } from "./providers";
import type { Settings } from "../storage/types";

export type ProviderRuntimeConfig = {
  providerId: string;
  providerLabel: string;
  baseUrl: string;
  modelUrl: string;
  apiKey?: string;
  model: string;
  requiresApiKey: boolean;
  knownModels: string[];
};

export type ProviderRuntimeResult =
  | { ok: true; config: ProviderRuntimeConfig }
  | { ok: false; error: string };

export function resolveProviderRuntimeConfig(settings: Settings): ProviderRuntimeResult {
  const provider = getProvider(settings.providerId);
  if (!provider) {
    return { ok: false, error: "Selected provider is not available. Choose another provider in Settings." };
  }

  const apiKey = settings.apiKeys[provider.id]?.trim() || undefined;
  if (provider.requiresApiKey && !apiKey) {
    return { ok: false, error: `Add your API key for ${provider.label} in Settings.` };
  }

  const model = settings.selectedModels[provider.id]?.trim() || provider.defaultModel?.trim();
  if (!model) {
    return { ok: false, error: `Select a model for ${provider.label} in Settings.` };
  }

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
