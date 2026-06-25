# Storage Module

`src/lib/storage/`

## Mục đích

Typed wrapper quanh `chrome.storage.local` với schema versioning, tự động migration khi storage shape thay đổi.

## Types chính

```typescript
StorageEnvelope<T> = { schemaVersion: number; data: T }
Settings = { providerId, apiKeys, selectedModels, defaultLanguage, updatedAt }
SavedResult = { id, title, sourceType, sourceUrl?, sourceTitle?, prompt?, inputExcerpt?, outputMarkdown, createdAt }
ExtensionStorage = {
  settings: StorageEnvelope<Settings>,
  promptTemplates: StorageEnvelope<PromptTemplate[]>,
  savedResults: StorageEnvelope<SavedResult[]>
}
```

## API Export

| Function | Input | Output | Mô tả |
|----------|-------|--------|-------|
| `getSettings` | — | `Promise<Settings>` | Đọc settings, tự động migrate nếu cần |
| `saveSettings` | `Settings` | `Promise<void>` | Ghi settings với schema version hiện tại |
| `getPromptTemplates` | — | `Promise<PromptTemplate[]>` | Đọc prompt templates, fallback về seeds |
| `savePromptTemplates` | `PromptTemplate[]` | `Promise<void>` | Ghi prompt templates |
| `getSavedResults` | — | `Promise<SavedResult[]>` | Đọc saved results |
| `saveSavedResults` | `SavedResult[]` | `Promise<void>` | Ghi saved results |

Migration helpers: `migrateSettingsEnvelope`, `migrateStorageEnvelope`, `migrateSettingsData`.

## Data Flow

1. UI component gọi `getSettings()` / `getPromptTemplates()` / `getSavedResults()`
2. Storage module đọc từ `chrome.storage.local`, kiểm tra `schemaVersion`
3. Nếu version mismatch → chạy migration → write-back envelope với `CURRENT_SCHEMA_VERSION`
4. Trả về `envelope.data` (unwrap)
5. Ghi: UI gọi `save*()` → wrap vào envelope → `chrome.storage.local.set()`

## Dependencies

- `chrome.storage.local` (Chrome API)
- `src/lib/ai/providers.ts` (getDefaultProviderId)
- `src/lib/prompts/seeds.ts` (createSeedPromptTemplates)

## Edge Cases / Lưu ý

- Tự động migrate từ schema 1→3, xử lý cả format cũ (`provider: "openai"`) và mới (`providerId: "openai"`)
- `getSettings` catch all errors, luôn trả về default settings không throw
- Storage key constants: `"settings"`, `"promptTemplates"`, `"savedResults"`
