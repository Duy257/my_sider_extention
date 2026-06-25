# Module Context Docs Design

## Product

Tài liệu context cho AI Agent — mỗi module trong `src/lib/` có 1 file markdown mô tả API surface, data flow, và edge cases. Mục đích để AI Agent đọc và nắm bắt context mà không cần load toàn bộ source code.

## Scope

6 files, mỗi file cho 1 module:

| File | Module path | Nội dung chính |
|------|-------------|----------------|
| `docs/modules/storage.md` | `src/lib/storage/` | StorageEnvelope pattern, schema versioning, CRUD, migrations |
| `docs/modules/messaging.md` | `src/lib/messaging/` | Port protocol, message types, request/response contracts |
| `docs/modules/ai.md` | `src/lib/ai/` | Provider registry, streaming client, error mapping, runtime config |
| `docs/modules/extraction.md` | `src/lib/extraction/` | Readability.js pipeline, DOM fallback, 40k truncation |
| `docs/modules/prompts.md` | `src/lib/prompts/` | Prompt builders, seed templates, action definitions |
| `docs/modules/selection.md` | `src/lib/selection/` | Selection types, action defs, floating toolbar lifecycle |

## Format chung

Mỗi file theo cấu trúc:

```
# <Module Name>

## Mục đích
1-2 câu.

## Types chính
Key type definitions (dạng pseudocode).

## API Export
Function signatures + mô tả ngắn.

## Data Flow
Luồng dữ liệu vào-ra, sequence.

## Dependencies
Internal + external dependencies.

## Edge Cases / Lưu ý
Điều cần biết khi dùng module.
```

## Location

```
docs/modules/
├── README.md         — Index + dependency graph
├── storage.md
├── messaging.md
├── ai.md
├── extraction.md
├── prompts.md
└── selection.md
```

## Implementation approach

Viết tuần tự theo dependency order:
1. storage.md (zero deps)
2. messaging.md (zero deps)
3. ai.md (depends on messaging types)
4. extraction.md (depends on messaging types)
5. prompts.md (depends on messaging types for selection actions)
6. selection.md (depends on messaging types)

## Non-goals

- Không generate từ source code (viết tay để đảm bảo high-level context)
- Không chứa implementation details dài dòng
- Không thay thế source code — chỉ là entry point để AI Agent hiểu nhanh
