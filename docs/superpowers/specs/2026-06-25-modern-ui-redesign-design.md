# Modern UI Redesign — Personal AI Sidebar

**Date:** 2026-06-25
**Status:** Approved
**Design direction:** Warm & friendly (violet/amber palette, stone tones, bubble chat)

---

## 1. Design Foundations

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#7C3AED` | Buttons, accent, user bubble |
| `primary-light` | `#A78BFA` | Hover states, glow |
| `warm-bg` | `#1C1917` | Panel background |
| `surface` | `#292524` | Card/section background |
| `surface-hover` | `#3C3833` | Hover states |
| `border` | `#44403C` | Borders |
| `accent` (amber) | `#F59E0B` | Highlights, badges |
| `success` | `#10B981` | Test connection OK |
| `error` | `#EF4444` | Errors |
| `text-primary` | `#FAFAF9` | Main text |
| `text-secondary` | `#A8A29E` | Secondary text |
| `ai-bubble-bg` | `#292524` | AI message bubble |

Replace Zinc cool grays with warm Stone tones throughout.

### Typography & Geometry

- Font: System font stack (no custom fonts needed)
- Base size: 14px (`text-sm`)
- Line-height: `leading-relaxed` (1.625)
- Border radius: `rounded-xl` (12px) cards, `rounded-lg` (8px) inputs, `rounded-2xl` (16px) bubbles, `rounded-full` avatars
- Shadow: subtle `shadow-md` for floating elements (toolbar, modals)

---

## 2. Header Navigation

- Brand "AI Cá Nhân" with small robot icon (inline SVG, primary tint) + subtle text glow on hover
- Tab items: icon-only buttons (SVG inline) with tooltip text on hover
  - 📄 Đọc trang (file-text icon)
  - 📋 Mẫu lệnh (list icon)
  - 💾 Đã lưu (bookmark icon)
  - ⚙️ Cài đặt (gear icon)
- Active tab: `text-primary` + underline bar (`h-0.5 bg-primary`)
- Header: `sticky top-0`, `bg-warm-bg/80 backdrop-blur-sm`, `border-b border-stone-800`
- "Đọc trang" button: spinner inline when `readingPage === true` (replaces "Đang đọc..." text)

---

## 3. Chat Bubbles & Message Flow

### Layout
- Messages displayed as chat bubbles (messenger-style)
- **User bubble:** right-aligned, `bg-primary`, `text-primary` white, `rounded-2xl rounded-br-md`, max-width 80%
- **AI bubble:** left-aligned, `bg-surface` `border border-stone-700/50`, `rounded-2xl rounded-bl-md`, max-width 85%
- AI avatar: small robot icon (primary tint) above/next to bubble, `w-6 h-6`
- Timestamp: shown only when gap > 5 min, `text-xs text-secondary`, centered between groups

### Typing Indicator
- When streaming: AI bubble with 3 animated dots
- CSS keyframes: `@keyframes bounce-dot { 0%,80%,100% { transform: translateY(0) } 40% { transform: translateY(-6px) } }`
- Each dot: `w-2 h-2 rounded-full bg-primary-light`, `animation: bounce-dot 1.4s infinite`
- Delays: dot 1 = `0s`, dot 2 = `0.2s`, dot 3 = `0.4s`
- Text "đang trả lời..." (text-xs text-secondary) above dots

### Empty State
- Large chat bubble icon (central, `text-stone-700`), `w-16 h-16`
- Text: "Hỏi về trang, văn bản đã chọn, hoặc công việc của bạn."
- 2-3 quick action chips: "📝 Tóm tắt trang này", "💡 Phân tích đoạn văn"
  - Chips: `bg-surface` `hover:bg-surface-hover` `rounded-full` `px-3 py-1.5 text-xs`

### Animations
- New user message: slide-in from right (`translateX(20px) → 0`, `opacity 0→1`, 200ms)
- New AI message: fade-in from below (`translateY(8px) → 0`, `opacity 0→1`, 300ms)
- CSS classes applied on mount, no JS animation library
- Auto-scroll to bottom on new message (existing behavior, preserved)

---

## 4. Chat Composer (Input Area)

- Container: `sticky bottom-0`, gradient `bg-gradient-to-t from-warm-bg via-warm-bg/95 to-transparent`, `pt-4 pb-3 px-3`
- Textarea: `bg-surface` `border border-stone-700` `focus:ring-2 focus:ring-primary/50 focus:border-primary`, `rounded-lg`, `min-h-[44px] max-h-24`, auto-resize
- Send button: `absolute bottom-[22px] right-[22px]`, `w-10 h-10 rounded-full bg-primary hover:bg-primary-light`, white arrow icon SVG, `disabled:opacity-40 disabled:cursor-not-allowed`
- Placeholder: "Hỏi về công việc của bạn..."
- Missing API key/model banner: inline between messages area and composer, `bg-amber-950/50 border border-amber-800/50 rounded-lg px-3 py-2 text-xs text-amber-200`
- Send loading: button shows spinner SVG (rotating ring) instead of arrow

---

## 5. Skeleton & Loading States

### Panel Initialization (on load)
- 4 skeleton rows, each: `h-16 bg-surface rounded-xl animate-pulse` staggered
- After data loaded → real content fades in (`opacity transition 300ms`)

### Loading Models (Settings)
- Model select replaced by skeleton: `h-10 bg-surface rounded-lg animate-pulse`
- On load complete → smooth swap to real `<select>`

### Test Connection (Settings)
- Button: SVG spinner replaces text, `disabled`
- Result: green checkmark + text `text-success` or red X + text `text-error`
- Result fades out after 5 seconds (auto-clear)

### Read Page (Header)
- Button icon → spinner animation (SVG rotating ring)
- No text change needed — icon alone communicates state

---

## 6. Settings Panel

- Sections separated by `border-t border-stone-800` dividers, `py-4`
- **Provider select:** card-like container `bg-surface rounded-xl p-3`, select with custom chevron, provider icon SVG
- **API Key input:** container `bg-surface rounded-xl p-3`, input with lock icon on left, eye toggle (show/hide) on right
- **Security notice:** `bg-stone-800/50 border border-stone-700 rounded-lg px-3 py-2 text-xs text-secondary`, shield icon
- **Model select:** full-width select with skeleton placeholder while loading
- **Model warning/error:** inline text with appropriate icon (amber warning / red error), `text-xs`
- **Test connection button:** full-width `bg-surface hover:bg-surface-hover border border-stone-700 rounded-lg py-2.5 text-sm transition-colors`, plug icon

---

## 7. Prompt Manager & Saved Results

### Prompt Manager
- **Add button:** `fixed` top, `bg-primary hover:bg-primary-light text-white rounded-full px-4 py-2 text-sm` with "+" icon
- **Prompt cards:** `bg-surface rounded-xl p-4`, border `border-stone-800`
- Name: `text-sm font-medium text-primary` (editable inline via click → input)
- Instruction: textarea `bg-warm-bg border border-stone-700 rounded-lg p-2 text-sm min-h-[80px]`
- Delete: icon button (trash SVG) `hover:text-error` top-right corner
- Sort order: displayed as badge "#n" in corner

### Saved Results
- **Empty state:** bookmark icon (SVG, `text-stone-700 w-12 h-12`) + "Chưa có kết quả nào." text
- **Result cards:** `bg-surface rounded-xl p-4`
- Title: `text-sm font-medium text-primary`, clickable to expand/collapse
- Content: `text-sm text-secondary`, truncated to 3 lines via `line-clamp-3`, expand toggle "Xem thêm"
- Timestamp: `text-xs text-stone-600` bottom-right
- Delete button: trash icon, on click → small confirm overlay "Xóa kết quả này?" với "Xóa" (red) / "Hủy" buttons

---

## 8. Selection Toolbar (Content Script)

- Floating toolbar rendered as DOM element (not React — runs in page context)
- Container: `bg-warm-bg/95 backdrop-blur-md border border-stone-700/50 rounded-xl shadow-lg`, padding `px-2 py-1.5`
- Actions layout: horizontal row, each action = icon + label text, `px-2.5 py-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer text-xs`
- Entry animation: `opacity 0→1` + `scale(0.95→1)` over 150ms
- Exit animation: `opacity 1→0` + `scale(1→0.95)` over 100ms, then `display: none`
- Position: centered above selection, auto-adjust Y if near viewport edge
- Max width: 500px (wraps to 2 rows if needed)

Actions (preserved):
| Action | Icon | Label |
|--------|------|-------|
| explain | 📖 | Giải thích |
| translate | 🌐 | Dịch sang Việt |
| rewrite | ✏️ | Viết lại chuyên nghiệp |
| summarize | 📝 | Tóm tắt |
| action_list | ✅ | Danh sách hành động |

---

## 9. Error States

- **Connection error:** card `bg-error/10 border border-error/30 rounded-xl p-3`, icon + message, auto-dismiss after 8 seconds
- **Missing API key:** see Section 4 composer banner
- **Read page failure:** inline error in chat (red bubble style), auto-dismiss after 6 seconds
- **Model load failure:** red text in settings with retry button

---

## 10. Testing Strategy

- No new logic — purely UI/styling changes
- Test each component renders correctly with new classes (visual regression via existing Vitest setup)
- Test skeleton states render and disappear after data loads
- Test selection toolbar entry/exit animations (timeout-based)
- Test bubble layout (user/AI alignment)
- Test dark mode consistency

---

## 11. Non-Goals

- No new features or functionality
- No changes to AI streaming, storage, or messaging logic
- No addition of animation libraries (CSS only)
- No responsive/layout changes beyond side panel
