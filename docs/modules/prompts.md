# Prompts Module

`src/lib/prompts/`

## Mục đích

Xây dựng prompt messages cho AI: system message cho chat, page reading prompt (góc nhìn CEO), selection action prompts (giải thích/dịch/viết lại/tóm tắt), và seed templates.

## Types chính

```typescript
PromptCategory = "general" | "ceo" | "dev" | "legal" | "sales" | "marketing" | "custom"

PromptTemplate = {
  id: string; name: string; instruction: string;
  category: PromptCategory; sortOrder: number;
  createdAt: string; updatedAt: string
}

PagePromptInput = { title: string; url: string; text: string; warnings: string[] }
```

## API Export

| Function | Input | Output | Mô tả |
|----------|-------|--------|-------|
| `buildUserChatMessages(input)` | `string` | `AiMessage[]` | Build `[{system}, {user}]` messages cho chat |
| `buildPagePrompt(input)` | `PagePromptInput` | `string` | Build prompt đọc page với CEO template |
| `buildSelectionPrompt(action, text)` | `SelectionAction`, `string` | `string` | Build prompt theo action type |
| `createSeedPromptTemplates(now)` | `string` | `PromptTemplate[]` | Tạo 5 seed templates mặc định |

## Data Flow

**Chat:** user gõ text → `buildUserChatMessages(text)` → `[{role:"system", content:"Bạn là trợ lý AI..."}, {role:"user", content:text}]` → gửi tới AI module

**Page:** user click "Read page" → extract content → `buildPagePrompt({title, url, text, warnings})` → prompt yêu cầu phân tích CEO perspective

**Selection:** user chọn action từ toolbar → `buildSelectionPrompt(action, selectedText)` → prompt theo action:
- `explain`: Giải thích rõ ràng
- `translate_vi`: Dịch sang tiếng Việt
- `rewrite_professional`: Viết lại chuyên nghiệp
- `summarize`: Tóm tắt
- `action_list`: Chuyển thành action list

## Dependencies

- `src/lib/ai/types.ts` (AiMessage type)
- `src/lib/selection/types.ts` (SelectionAction type)

## Edge Cases / Lưu ý

- System message luôn là constant: "Bạn là trợ lý AI cá nhân, chuyên giúp đọc hiểu..."
- 5 seed templates: CEO rewrite, Problem-Cause-Solution table, Operations analysis, Action plan, Senior dev review
- Seed templates có `id` prefix `"seed-"` để phân biệt với user-created templates
- UI language: Vietnamese
