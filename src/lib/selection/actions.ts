import type { SelectionAction } from "./types";

export const SELECTION_ACTIONS: Array<{ action: SelectionAction; label: string; icon: string }> = [
  { action: "explain", label: "Giải thích", icon: "💡" },
  { action: "translate_vi", label: "Dịch sang tiếng Việt", icon: "🌐" },
  { action: "rewrite_professional", label: "Viết lại chuyên nghiệp", icon: "✍️" },
  { action: "summarize", label: "Tóm tắt", icon: "📝" },
  { action: "action_list", label: "Bullet/Action list", icon: "📋" }
];
