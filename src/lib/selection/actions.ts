import type { SelectionAction } from "./types";

export const SELECTION_ACTIONS: Array<{ action: SelectionAction; label: string; iconSvg: string }> = [
  {
    action: "explain",
    label: "Giải thích",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.5 14.5c-1.3-1-2-2.5-2-4.1A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 5.5 5.4c0 1.6-.7 3.1-2 4.1-.8.6-1.2 1.4-1.3 2.5H9.8c-.1-1.1-.5-1.9-1.3-2.5Z"/></svg>`
  },
  {
    action: "translate_vi",
    label: "Dịch sang tiếng Việt",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h12"/><path d="M9 3v2"/><path d="M6 9c1.2 2.2 3.2 3.8 6 5"/><path d="M13 5c-.8 3.4-3.1 6.5-7 9"/><path d="M14 19l4-9 4 9"/><path d="M15.5 16h5"/></svg>`
  },
  {
    action: "rewrite_professional",
    label: "Viết lại chuyên nghiệp",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 5 3 3"/></svg>`
  },
  {
    action: "summarize",
    label: "Tóm tắt",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16"/><path d="M4 12h10"/><path d="M4 19h7"/><path d="m17 15 3 3-3 3"/></svg>`
  },
  {
    action: "action_list",
    label: "Bullet/Action list",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></svg>`
  },
  {
    action: "explain_vocabulary",
    label: "Giải thích từ vựng",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h9"/><path d="M4 12h9"/><path d="M4 19h6"/><path d="M16 5h4"/><path d="M18 3v4"/><path d="m15 14 2 2 4-5"/><path d="M16 20h5"/></svg>`
  },
  {
    action: "explain_grammar",
    label: "Giải thích ngữ pháp",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h8"/><path d="M4 18h10"/><path d="M17 10v8"/><path d="m14 15 3 3 3-3"/><path d="M16 6l1-2 1 2 2 1-2 1-1 2-1-2-2-1Z"/></svg>`
  }
];
