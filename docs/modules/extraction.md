# Extraction Module

`src/lib/extraction/`

## Mục đích

Trích xuất nội dung trang web để gửi cho AI phân tích. Dùng Readability.js trước, fallback về DOM text extraction nếu Readability không parse được.

## Types chính

```typescript
ExtractionMethod = "readability" | "dom-fallback"

ExtractedPageContent = {
  title: string
  url: string
  text: string
  method: ExtractionMethod
  warnings: string[]
}
```

## API Export

| Function | Input | Output | Mô tả |
|----------|-------|--------|-------|
| `extractPageContent(url?)` | `string` (optional) | `ExtractedPageContent` | Entry point: chạy readability, fallback, truncate 40k chars |
| `extractReadableText(document)` | `Document` | `string` | Dùng @mozilla/readability, clone DOM để không mutate |
| `extractDomText(root)` | `Document` | `string` | Quét h1-h4, p, li, td, th, blockquote, pre, code... |

## Data Flow

1. `extractPageContent()` gọi `extractReadableText(document)`
2. Readability clone document, parse article, trả về text content
3. Nếu Readability fail (empty text) → gọi `extractDomText(document)` (DOM fallback)
4. DOM fallback: clone document → remove script/style/nav/footer/aside → query selector h1-h4, p, li, td, etc. → join bằng newline
5. Output bị truncate ở 40,000 characters nếu quá dài
6. Trả về `{ title, url, text, method, warnings }`

## Dependencies

- `@mozilla/readability` (npm)
- Chỉ chạy ở content script context (có `document` global)

## Edge Cases / Lưu ý

- 40k char limit: `MAX_PAGE_CONTEXT_CHARS = 40000` + warning message nếu bị truncate
- Readability fail trên single-page apps, PDF viewer, hoặc trang không có article structure
- DOM fallback skip: `script, style, nav, footer, aside, noscript, svg, canvas, header, [hidden], [aria-hidden="true"]`
- Clone document trước khi mutate để không ảnh hưởng tới DOM gốc
