export type ProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: "custom", label: "Custom (manual)", baseUrl: "", defaultModel: "" },
  { id: "opencode", label: "OpenCode", baseUrl: "https://api.opencode.ai/v1/chat/completions", defaultModel: "gpt-4o-mini" },
  { id: "commandcode", label: "CommandCode", baseUrl: "https://api.commandcode.ai/v1/chat/completions", defaultModel: "command-r-plus" },
];

export function getPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
