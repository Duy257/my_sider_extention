export const OPENAI_MODEL_PRESETS = [
  { id: "gpt-5.5", label: "GPT-5.5", description: "Best for complex reasoning and high-quality work." },
  { id: "gpt-5.4", label: "GPT-5.4", description: "General flagship model." },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", description: "Fast and cost-conscious default." },
  { id: "gpt-5.4-nano", label: "GPT-5.4 nano", description: "Lowest latency for short tasks." }
] as const;

export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
