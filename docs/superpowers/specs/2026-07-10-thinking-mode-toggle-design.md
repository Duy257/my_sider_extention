# Thinking Mode Toggle — Design Spec

**Date:** 2026-07-10
**Status:** Approved

## Problem

Một số AI provider (OpenAI o-series, DeepSeek R1, OpenCode) hỗ trợ chain-of-thought reasoning ("thinking") trước khi trả lời. Người dùng cần toggle để bật/tắt tính năng này và chọn mức độ tư duy, nhưng không cần hiển thị nội dung thinking trong UI.

## Glossary

- **Thinking mode**: Mức độ tư duy sâu của model. Gồm 5 mức: Off, Low, Medium, High, Max.
- **Per-chat override**: Ghi đè mức thinking tạm thời cho một lần gửi tin nhắn duy nhất.

## Data Model

### Settings (`src/lib/storage/types.ts`)

```typescript
export type Settings = {
  providerId: string;
  apiKeys: Record<string, string | undefined>;
  selectedModels: Record<string, string | undefined>;
  defaultLanguage: "vi" | "en";
  thinkingMode: "off" | "low" | "medium" | "high" | "max"; // NEW
  updatedAt: string;
};
```

### Default (`src/lib/storage/defaults.ts`)

```typescript
thinkingMode: "off",
```

Migration: Không cần. SchemaVersion giữ nguyên. Code đọc settings sẽ fallback về `"off"` nếu field undefined.

## Provider Parameter Mapping

Map `thinkingMode` → API parameter theo từng provider. Provider không có trong map → bỏ qua (không gửi param).

```typescript
const THINKING_PARAM_MAP: Record<string, Record<string, unknown>> = {
  openai: {
    off: undefined,
    low: { reasoning_effort: "low" },
    medium: { reasoning_effort: "medium" },
    high: { reasoning_effort: "high" },
    max: { reasoning_effort: "high" },    // OpenAI chỉ có 3 mức
  },
  opencode: {
    off: undefined,
    low: { reasoning_effort: "low" },
    medium: { reasoning_effort: "medium" },
    high: { reasoning_effort: "high" },
    max: { reasoning_effort: "high" },
  },
};
```

Đặt trong `src/lib/ai/runtime.ts`. Hàm `getThinkingParams(providerId, mode)` trả về object params hoặc undefined.

## Architecture Changes

### Files modified (6 total)

| File | Change |
|------|--------|
| `src/lib/storage/types.ts` | Thêm `thinkingMode` vào `Settings` |
| `src/lib/storage/defaults.ts` | Default `off` |
| `src/lib/ai/runtime.ts` | Thêm `thinkingMode` vào `ProviderRuntimeConfig` + `THINKING_PARAM_MAP` + `getThinkingParams()` |
| `src/lib/ai/client.ts` | `streamChatCompletion` nhận `extraBodyParams` và merge vào request body; tương tự `fetchCompletion`, `testConnection` |
| `entrypoints/background.ts` | Resolve thinking params từ config, truyền vào `extraBodyParams` |
| `entrypoints/sidepanel/components/SettingsPanel.tsx` | Thêm card "Tư duy (Thinking)" với dropdown 5 mức |
| `entrypoints/sidepanel/hooks/useChatController.ts` | `sendPrompt` nhận override `thinkingMode?` |
| `entrypoints/sidepanel/components/ChatComposer.tsx` | Thêm dropdown per-chat override bên cạnh input |

### Data Flow

```
Settings Panel (global)
  → App.tsx updateSettings → saveSettings → chrome.storage.local

ChatComposer (per-chat override)
  → useChatController.sendPrompt(text, { thinkingMode })
  → port message { type: "AI_CHAT_REQUEST", thinkingMode?, ... }

Background
  → resolveProviderRuntimeConfig(settings) → ProviderRuntimeConfig
  → getThinkingParams(config.providerId, config.thinkingMode) → params | undefined
  → streamChatCompletion({ ..., extraBodyParams: params })
```

### Client layer

`streamChatCompletion` nhận thêm field `extraBodyParams?: Record<string, unknown>`:

```typescript
body: JSON.stringify({
  model: input.model,
  messages: ...,
  stream: true,
  ...input.extraBodyParams,  // merged vào body
})
```

`fetchCompletion` và `testConnection` tương tự.

## UI Design

### Settings Panel

Card mới trong SettingsPanel, nằm sau Model:

```
┌─────────────────────────────────────┐
│ 🧠 Tư duy (Thinking)                │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Tắt (Off)              ▼    │    │
│  ├─────────────────────────────┤    │
│  │ Tắt (Off)                   │    │
│  │ Thấp (Low)                  │    │
│  │ Vừa (Medium)                │    │
│  │ Cao (High)                  │    │
│  │ Tối đa (Max)                │    │
│  └─────────────────────────────┘    │
│                                     │
│  Kích hoạt tư duy sâu cho các      │
│  model hỗ trợ. Thay đổi áp dụng    │
│  cho mọi hội thoại.                 │
└─────────────────────────────────────┘
```

### ChatComposer Per-Chat Override

Dropdown nhỏ bên trái input, label động theo mức đã chọn:

```
[ 🧠 Medium ▼ ]  [____________________]  [Gửi]
```

- Mặc định hiển thị mức từ Settings
- Khi user chọn mức khác → chỉ ảnh hưởng lần gửi kế tiếp
- Sau khi gửi xong → reset về mức global trong Settings

## Error Handling

- Provider không hỗ trợ thinking → `getThinkingParams()` trả về `undefined` → không gửi param → không ảnh hưởng gì
- Provider hỗ trợ nhưng param sai → API trả lỗi → `onError` callback xử lý như mọi lỗi khác
- Settings có `thinkingMode: "max"` nhưng OpenAI chỉ có 3 mức → map về `reasoning_effort: "high"` (mức cao nhất)

## Testing

### Unit tests
- `getThinkingParams` trả về đúng param cho từng provider × mode
- `resolveProviderRuntimeConfig` copy `thinkingMode` từ settings
- Request body trong `streamChatCompletion` chứa `extraBodyParams` khi có
- Default settings có `thinkingMode: "off"`

### Component tests
- SettingsPanel render dropdown thinking và gọi onChange đúng giá trị
- ChatComposer dropdown hiển thị mức global, override cho lần gửi, reset sau gửi

## Out of Scope (YAGNI)

- Hiển thị nội dung thinking trong UI (collapse/expand, message riêng)
- Tự động detect model có hỗ trợ thinking hay không
- Nhiều parameter cùng lúc (temperature, top_p, etc.)
