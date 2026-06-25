# Selection Module

`src/lib/selection/`

## Mục đích

Xử lý text selection trên trang web: hiển thị floating toolbar với các action (giải thích, dịch, viết lại...), validate độ dài selection, và quản lý toolbar lifecycle.

## Types chính

```typescript
SelectionAction = "explain" | "translate_vi" | "rewrite_professional" | "summarize" | "action_list"
```

## API Export

| Export | Kiểu / Chữ ký | Mô tả |
|--------|---------------|-------|
| `SELECTION_ACTIONS` | `{action, label, icon}[]` | 5 actions với label + icon tiếng Việt |
| `isSelectionLengthAllowed(text)` | `string → boolean` | Check selection 20-20,000 ký tự |
| `isSelectionTooLong(text)` | `string → boolean` | Check selection > 20,000 ký tự |
| `renderSelectionToolbar(position, onAction, onDismiss?)` | → `HTMLElement` | Render floating toolbar tại position |
| `renderTooLongIndicator(position)` | → `HTMLElement` | Render indicator "Văn bản quá dài" |

## Data Flow

1. User select text → content script detect selection → check length
2. Nếu 20-20,000 chars: `renderSelectionToolbar(position, onAction)` tại vị trí selection
3. Nếu > 20,000 chars: `renderTooLongIndicator(position)` thông báo quá dài
4. User click action → toolbar gọi `onAction(action)` → background xử lý
5. Toolbar tự huỷ khi: scroll, resize, click outside, hoặc Escape
6. CSS selector cleanup: `document.querySelectorAll('[data-personal-ai-toolbar]').forEach(el => el.remove())`

## Dependencies

- Không depend vào module internal nào khác

## Edge Cases / Lưu ý

- `MIN_SELECTION_CHARS = 20`, `MAX_SELECTION_CHARS = 20000`
- Toolbar dùng `position: fixed`, z-index `2147483647` (cao nhất)
- Toolbar có arrow nhỏ hướng xuống selection
- Mỗi button trong toolbar có hover (surface-hover), mousedown (scale 0.96), click handlers
- Entrance animation: opacity 0→1 + scale 0.95→1 + translateY 4px→0 với cubic-bezier(0.16, 1, 0.3, 1)
- Toolbar elements đều có `dataset.personalAiToolbar = "true"` để dễ cleanup
