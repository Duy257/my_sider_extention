# Module Context Docs

Tài liệu này giúp AI Agent nắm bắt context của từng module trong `src/lib/` mà không cần đọc toàn bộ source code.

## Dependency Graph

```
storage ──> messaging ──> ai
                   │
                   ├──> extraction
                   ├──> prompts
                   └──> selection
```

Chi tiết từng module:

| File | Module | Mô tả |
|------|--------|-------|
| [storage.md](./storage.md) | `src/lib/storage/` | StorageEnvelope, schema versioning, CRUD, migrations |
| [messaging.md](./messaging.md) | `src/lib/messaging/` | Port protocol, message contracts, request/response types |
| [ai.md](./ai.md) | `src/lib/ai/` | Provider registry, streaming client, runtime config, error mapping |
| [extraction.md](./extraction.md) | `src/lib/extraction/` | Readability.js pipeline, DOM fallback, 40k truncation |
| [prompts.md](./prompts.md) | `src/lib/prompts/` | Prompt builders (page/selection/chat), seed templates |
| [selection.md](./selection.md) | `src/lib/selection/` | Selection types, action definitions, floating toolbar lifecycle |
