export type ProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  knownModels?: string[];
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: "custom", label: "Custom (manual)", baseUrl: "", defaultModel: "" },
  { id: "opencode", label: "OpenCode", baseUrl: "https://api.opencode.ai/v1/chat/completions", defaultModel: "gpt-4o-mini", knownModels: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"] },
  { id: "commandcode", label: "CommandCode", baseUrl: "https://api.commandcode.ai/v1/chat/completions", defaultModel: "command-r-plus", knownModels: ["command-r-plus", "command-r", "command-light"] },
  { id: "lmstudio", label: "LMStudio", baseUrl: "http://localhost:1234/v1/chat/completions", defaultModel: "" },
];

export function getPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
