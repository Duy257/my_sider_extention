# Selection Module

`src/lib/selection/`

## Mục đích

Xử lý text selection trên trang web: hiển thị floating toolbar dạng icon-only với các action (giải thích, dịch, viết lại, tóm tắt, tạo action list, giải thích từ vựng, giải thích ngữ pháp), validate độ dài selection, và quản lý toolbar lifecycle.

## Types chính

```typescript
SelectionAction =
  | "explain"
  | "translate_vi"
  | "rewrite_professional"
  | "summarize"
  | "action_list"
  | "explain_vocabulary"
  | "explain_grammar"
```

## API Export

| Export | Kiểu / Chữ ký | Mô tả |
|--------|---------------|-------|
| `SELECTION_ACTIONS` | `{action, label, iconSvg}[]` | 7 actions với label tiếng Việt + inline SVG icon |
| `isSelectionLengthAllowed(text)` | `string -> boolean` | Check selection 3-20,000 ký tự |
| `isSelectionTooLong(text)` | `string -> boolean` | Check selection > 20,000 ký tự |
| `renderSelectionToolbar(position, onAction, onDismiss?)` | `-> HTMLElement` | Render floating icon-only toolbar tại position |
| `renderTooLongIndicator(position)` | `-> HTMLElement` | Render indicator "Văn bản quá dài" |

## Data Flow

1. User select text -> content script detect selection -> check length
2. Nếu 3-20,000 chars: `renderSelectionToolbar(position, onAction)` tại vị trí selection với 7 action icon-only
3. Nếu > 20,000 chars: `renderTooLongIndicator(position)` thông báo quá dài
4. Nếu rỗng hoặc < 3 chars: không hiển thị toolbar
5. User click action -> toolbar gọi `onAction(action)` -> background xử lý
6. Toolbar tự huỷ khi: scroll, resize, click outside, hoặc Escape
7. CSS selector cleanup: `document.querySelectorAll('[data-personal-ai-toolbar]').forEach(el => el.remove())`

## Dependencies

- Không depend vào module internal nào khác

## Edge Cases / Lưu ý

- `MIN_SELECTION_CHARS = 3`, `MAX_SELECTION_CHARS = 20000`
- Toolbar dùng `position: fixed`, z-index `2147483647` (cao nhất)
- Toolbar có arrow nhỏ hướng xuống selection
- Toolbar button chỉ render inline SVG icon; không render text label trong button body
- Mỗi button vẫn có `title` và `aria-label` tiếng Việt để hỗ trợ hover tooltip và accessibility
- SVG icons dùng `currentColor`, `aria-hidden="true"`, và `focusable="false"`
- Mỗi button trong toolbar có hover (surface-hover), mousedown (scale 0.96), click handlers
- Entrance animation: opacity 0->1 + scale 0.95->1 + translateY 4px->0 với cubic-bezier(0.16, 1, 0.3, 1)
- Toolbar elements đều có `dataset.personalAiToolbar = "true"` để dễ cleanup
- `explain_vocabulary` dùng prompt học ngoại ngữ chi tiết: nghĩa theo ngữ cảnh, loại từ, phát âm nếu xác định được, sắc thái, collocation, ví dụ và lỗi dùng từ phổ biến.
- `explain_grammar` ưu tiên phân tích ngữ pháp tiếng Anh bằng tiếng Việt; nếu selection không rõ là tiếng Anh, prompt yêu cầu AI nói rõ giới hạn thay vì suy diễn.
