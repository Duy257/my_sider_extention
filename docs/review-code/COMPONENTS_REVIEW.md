# Code Review - `src/components` (Personal AI Sidebar)

**Project**: Personal AI Sidebar (Chrome Manifest V3 Browser Extension)
**Review Date**: 2026-09-07
**Reviewer**: AI Code Review
**Scope**: Toàn bộ thư mục `src/components/` (chat, devtools, floating-window)
**Mục đích**: Rà soát các vấn đề UI, logic và đề xuất fix.

> Tài liệu này bổ sung cho `docs/review-code/CODE_REVIEW.md` (review tổng thể dự án).
> Ở đây tập trung **sâu** vào 3 nhóm component thuộc `src/components/`.

---

## 1. Phạm vi review

```
src/components/
├── chat/
│   └── MessageContent.tsx          ← markdown renderer cho chat (sidepanel)
├── devtools/
│   ├── DebugDetails.tsx            ← card AI trace (TTFT, tokens, reasoning)
│   └── ToolTraceCard.tsx           ← card tool trace (read-page, selection, ...)
└── floating-window/
    ├── FloatingWindow.tsx          ← cửa sổ nổi, kéo-thả, resize, mini/maximize
    ├── FloatingChatMessage.tsx     ← markdown renderer + cursor cho cửa sổ nổi
    ├── WindowHeader.tsx            ← header cửa sổ nổi (close/min/max)
    └── types.ts                    ← WindowState, StreamState
```

**File đi kèm tham chiếu chéo**:
- `src/hooks/useAiStream.ts` — hook stream chung
- `src/scripts/floating-mount.ts` — mount/unmount + Shadow DOM
- `src/core/devtools/{types,copy,trace-reducer,background-trace}.ts`
- `src/core/messaging/types.ts`
- `src/constants/index.ts`
- `entrypoints/sidepanel/components/ChatMessage.tsx`

---

## 2. Tóm tắt điều hành

| Mức độ | Số lượng | Tình trạng |
|--------|---------:|------------|
| 🔴 Nghiêm trọng (bug/runtime/safety) | 4 | Cần fix ngay |
| 🟠 Cao (UX/leak/maintainability) | 6 | Fix trong sprint tới |
| 🟡 Trung bình (consistency/cleanup) | 6 | Lên kế hoạch fix |
| 🟢 Thấp (nice-to-have) | 4 | Cải tiến khi rảnh |
| 📋 Feature mới (Rich Content Renderer) | 1 | Đã lên kế hoạch (§4.4) |
| **Tổng** | **21 + feature** | — |

**Vấn đề nổi bật**:
1. **Hai bộ markdown renderer gần như giống hệt nhau** (`MessageContent.tsx` & `FloatingChatMessage.tsx`) — trùng lặp logic parse `**bold**`, `*italic*`, `` `code` ``, code-fence, danh sách, heading. Một bản fix chỉ áp dụng được cho một nơi, dễ phát sinh lệch hành vi.
2. **`FloatingWindow.tsx` ~340 dòng** — vừa quản lý state machine cửa sổ, vừa xử lý drag/resize thủ công, vừa render nội dung. Thiếu tách `useDraggable`/`useResizable` hook; resize hiện tại còn leak document cursor nếu component bị unmount giữa chừng.
3. **`MessageContent.tsx` hỗ trợ heading `h1..h6` nhưng chỉ render `h1/h2/h3`** — heading `h4..h6` bị "nuốt" thành heading cấp 3 và bỏ sót semantic. Lỗi regex `parseInline` không xử lý đúng khi văn bản chứa cả `*` đơn lẫn `**` lồng nhau.
4. **CSS-in-JS inline khổng lồ** trong floating-window: tất cả style hard-coded màu sắc, font, shadow, animation — **trái ngược** hoàn toàn với Tailwind được dùng ở phần còn lại của app. Khi theme đổi (light/dark) sẽ phải sửa 3 file, dễ sót.
5. **Task mới — Rich Content Renderer** (§4.4): Mở rộng `MessageContent`/`FloatingChatMessage` để hiển thị Table, Image, JSON, Alert, Stats, Steps, Quote, Definition thay vì chỉ plain markdown text. Ưu tiên Phase 1: Table + Code + Alert (high impact, dễ detect).

---

## 3. Vấn đề chi tiết theo từng component

### 3.1 `src/components/chat/MessageContent.tsx`

#### 🔴 [C1] Heading parser chỉ nhận `h1..h3` — bỏ qua `h4..h6`

**Vị trí**: `MessageContent.tsx:108-122`

```ts
const hMatch = line.match(/^(#{1,6})\s+(.*)/);
if (hMatch) {
  const level = hMatch[1].length;
  const title = hMatch[2];
  const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3"; // ⚠️ h4..h6 đều thành h3
  ...
}
```

**Vấn đề**:
- Mất phân cấp heading khi AI trả lời có cấu trúc markdown `####` hoặc `#####` (khá phổ biến khi tóm tắt kỹ thuật).
- Sai semantic HTML, ảnh hưởng accessibility (screen reader) và outline document.

**Fix đề xuất**:

```tsx
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
const HEADING_TAG: Record<number, HeadingTag> = {
  1: "h1", 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6",
};
const HEADING_CLS: Record<number, string> = {
  1: "text-base font-bold text-stone-50 mt-4 mb-2 pb-1 border-b border-stone-800/50",
  2: "text-sm  font-bold text-stone-50 mt-3 mb-1.5 pb-0.5 border-b border-stone-800/30",
  3: "text-[13px] font-bold text-stone-100 mt-3 mb-1",
  4: "text-[13px] font-semibold text-stone-200 mt-2 mb-1",
  5: "text-[12.5px] font-semibold text-stone-300 mt-2 mb-0.5",
  6: "text-[12px]  font-semibold text-stone-400 mt-2 mb-0.5 uppercase tracking-wide",
};

const Tag = HEADING_TAG[level] ?? "h3";
const cls  = HEADING_CLS[level]  ?? HEADING_CLS[3];
```

---

#### 🔴 [C2] `parseInline` lỗi khi `*` và `**` đan xen / không cân bằng

**Vị trí**: `MessageContent.tsx:5-33`

```ts
const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
...
if (part.startsWith("**") && part.endsWith("**")) { /* bold */ }
if (part.startsWith("*")  && part.endsWith("*"))  { /* italic */ }
if (part.startsWith("`")  && part.endsWith("`"))  { /* code */ }
```

**Vấn đề**:
- Regex non-greedy `.*?` sẽ khớp `*foo *bar* baz*` theo cách khó lường → có thể match luôn cả cụm dài.
- `part.slice(2, -2)` cho bold không an toàn nếu chuỗi chỉ có 1 ký tự `**` (slice ra rỗng nhưng vẫn pass điều kiện `startsWith("**") && endsWith("**")`).
- Thứ tự `if/if/if` không phải `else if`: nếu `part` bằng `***foo***` (cả bold + italic) sẽ rơi vào nhánh bold đầu tiên và `slice(2,-2)` ra `*foo*` (còn `*` dư) — render bold chứ không phải bold-italic.
- Văn bản chứa ký tự `<`, `>`, `&` không qua escape → React tự escape nhưng nếu sau này đổi sang `dangerouslySetInnerHTML` sẽ nguy hiểm.

**Test case tái hiện**:
```
Input: "Đây là **bold** và *italic*, còn ***cả hai*** thì sao?"
Hiện tại: bold = "bold", italic = "italic", ***cả hai*** → bold="*cả hai*" (sai)
```

**Fix đề xuất** (dùng single-pass tokenizer):

```tsx
type InlineToken = { type: "text" | "bold" | "italic" | "code"; text: string };

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  while (i < text.length) {
    // Bold trước (ưu tiên dài hơn)
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        tokens.push({ type: "bold", text: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && end !== i + 1) {
        tokens.push({ type: "italic", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        tokens.push({ type: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // Thuần văn bản: gom đến ký tự đặc biệt kế tiếp
    let j = i;
    while (j < text.length && text[j] !== "*" && text[j] !== "`") j++;
    tokens.push({ type: "text", text: text.slice(i, j) });
    i = j;
  }
  return tokens;
}

function parseInline(text: string): React.ReactNode[] {
  return tokenizeInline(text).map((tok, idx) => {
    switch (tok.type) {
      case "bold":   return <strong key={idx}>{tok.text}</strong>;
      case "italic": return <em key={idx}>{tok.text}</em>;
      case "code":   return <code key={idx} className="...">{tok.text}</code>;
      default:       return <React.Fragment key={idx}>{tok.text}</React.Fragment>;
    }
  });
}
```

---

#### 🟠 [C3] Không hỗ trợ escape `\*`, code-block inline backtick, link — gây regression khi user chọn nội dung code

**Vị trí**: Toàn bộ parser.

**Vấn đề**:
- Không escape ký tự đặc biệt: nếu AI viết `\*not bold\*` thì parser vẫn cố match, fail silently.
- Không hỗ trợ link `[text](url)` — markdown cơ bản mà thiếu.
- Không hỗ trợ code block có ngôn ngữ (chỉ hiển thị tên ngôn ngữ nhưng không có syntax highlight). Không có copy-to-clipboard cho code-block.
- Số tab đầu dòng `> ` (blockquote) chưa hỗ trợ.

**Fix đề xuất**:
- Thêm blockquote parser: `line.startsWith("> ")`.
- Thêm link parser với whitelist scheme (`http`, `https`).
- Thêm nút "Sao chép" trên code block.
- Escape backslash trước khi parse.

---

#### 🟡 [C4] Code block không giới hạn chiều cao → dài quá chiếm hết khung chat

**Vị trí**: `MessageContent.tsx:60-72`

```tsx
<pre className="overflow-x-auto p-3 text-xs leading-relaxed text-purple-300 font-mono">
  <code>{codeBlock.lines.join("\n")}</code>
</pre>
```

**Vấn đề**:
- Chỉ có `overflow-x-auto` (ngang). Khi AI trả code 200 dòng, block sẽ đẩy message bubble rất cao, không scroll dọc.
- Không có nút copy → user phải bôi đen thủ công.

**Fix đề xuất**:

```tsx
<div className="my-3 rounded-lg overflow-hidden border border-stone-800 bg-stone-950">
  <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 bg-stone-900/80 border-b border-stone-800">
    <span>{codeBlock.lang || "code"}</span>
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(codeBlock.lines.join("\n"))}
      className="text-stone-400 hover:text-violet-400 transition-colors"
    >
      Sao chép
    </button>
  </div>
  <pre className="max-h-96 overflow-auto p-3 text-xs leading-relaxed text-purple-300 font-mono">
    <code>{codeBlock.lines.join("\n")}</code>
  </pre>
</div>
```

---

#### 🟢 [C5] Render quá nhiều phần tử → thiếu `useMemo`

**Vị trí**: Toàn bộ `MessageContent` (re-render toàn bộ khi stream thêm 1 token).

**Vấn đề**:
- Mỗi lần `content` thay đổi (liên tục khi streaming), parser chạy lại từ đầu → re-render toàn bộ React tree.
- Chưa áp dụng `useMemo` để cache parse result.
- Sidepanel đã có throttle 100ms cho stream (`CHAT_SETTINGS.STREAM_FLUSH_MS`) nhưng component này vẫn re-render 10 lần/giây với nội dung rất dài.

**Fix đề xuất**:

```tsx
const parsedContent = useMemo(() => parseContent(content), [content]);
return <>{parsedContent}</>;
```

> Lưu ý: `useMemo` không đảm bảo cache tuyệt đối (React có thể discard), nhưng trong thực tế với streaming liên tục thì rất có ích.

---

### 3.2 `src/components/devtools/DebugDetails.tsx`

#### 🔴 [D1] `setTimeout` trong `handleCopy` không cleanup → race condition khi unmount

**Vị trí**: `DebugDetails.tsx:23-29`

```tsx
const handleCopy = async () => {
  if (!trace.thinking.content) return;
  try {
    await navigator.clipboard.writeText(trace.thinking.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // ⚠️ không cleanup
  } catch {}
};
```

**Vấn đề**:
- Nếu component unmount trong khoảng 2s sau khi copy, `setCopied(false)` sẽ gọi setter trên component đã unmount → React warning "Can't perform a state update on an unmounted component".
- Nếu user click "Sao chép" nhiều lần liên tiếp → nhiều timer chồng nhau, `setCopied(false)` của lần trước có thể xảy ra ngay sau `setCopied(true)` của lần sau → feedback bị "nhấp nháy".

**Fix đề xuất**:

```tsx
const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  if (!trace.thinking.content) return;
  try {
    await navigator.clipboard.writeText(trace.thinking.content);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    console.warn("Clipboard write failed:", err);
  }
};

useEffect(() => {
  return () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  };
}, []);
```

---

#### 🟠 [D2] Magic color hex hard-coded trong className `border-stone-850`

**Vị trí**: `DebugDetails.tsx:56`, `ToolTraceCard.tsx:28`

```tsx
<section className="...border border-stone-850 bg-stone-950...">
```

**Vấn đề**:
- Tailwind mặc định **không có** class `border-stone-850`. Class này hoạt động vì có config riêng trong `tailwind.config.ts` nhưng nếu đọc code độc lập sẽ tưởng bug.
- Không có fallback khi `border-stone-850` chưa được generate (ví dụ khi JIT bỏ sót).

**Fix đề xuất**:
- Thêm comment trong `tailwind.config.ts` ngay tại entry `stone.850` để người mới hiểu.
- Hoặc đổi sang `border-stone-800` (đã có sẵn) để giảm magic.

---

#### 🟠 [D3] Không có ARIA region/screen-reader text cho dev panel

**Vị trí**: Toàn bộ component.

**Vấn đề**:
- Toàn bộ panel chỉ là `<section>` không có `role`, `aria-label` → screen reader đọc nguyên cục "DEV · chat · high · 1500 ms · 2.3 s · 300 tok" mà không có ngữ nghĩa.
- Không thông báo trạng thái pending/success/error qua `aria-live` — quan trọng vì đây là thông tin real-time.
- Nút expand/collapse `<button>` thiếu `aria-controls` trỏ tới panel content.

**Fix đề xuất**:

```tsx
<section
  role="region"
  aria-label="AI request dev trace"
  aria-live="polite"
  className="..."
>
  <button
    type="button"
    aria-expanded={expanded}
    aria-controls={`dev-details-${trace.requestId}`}
    onClick={...}
  >
    ...
  </button>
  {expanded && (
    <div id={`dev-details-${trace.requestId}`} className="...">
      ...
    </div>
  )}
</section>
```

---

#### 🟠 [D4] `useEffect` auto-expand khi streaming reasoning có thể gây "nhảy" UI khó chịu

**Vị trí**: `DebugDetails.tsx:17-22`

```tsx
useEffect(() => {
  if (isStreamingReasoning) {
    setExpanded(true);
  }
}, [isStreamingReasoning]);
```

**Vấn đề**:
- Khi user **đã đóng** card thủ công, mỗi lần có delta reasoning mới, component tự mở lại → cướp quyền kiểm soát của user, rất khó chịu.
- Khi stream xong (`status: "success"`), effect không tự đóng → user phải đóng thủ công.

**Fix đề xuất**:

```tsx
// Chỉ auto-expand lần đầu khi reasoning bắt đầu xuất hiện
const prevStreamingRef = useRef(false);
useEffect(() => {
  const wasStreaming = prevStreamingRef.current;
  prevStreamingRef.current = isStreamingReasoning;
  if (!wasStreaming && isStreamingReasoning) {
    setExpanded(true);
  }
}, [isStreamingReasoning]);
```

Hoặc thêm prop `defaultExpanded` để caller quyết định:

```tsx
type DebugDetailsProps = {
  trace: AiDevTrace;
  compact?: boolean;
  autoExpandOnStreaming?: boolean; // mặc định false
};
```

---

#### 🟡 [D5] Tính elapsed time không chính xác khi `Date.now()` thay đổi giữa stream

**Vị trí**: `DebugDetails.tsx:44-45`

```tsx
const endTime = trace.finishedAt || Date.now();
const elapsedSec = ((endTime - trace.startedAt) / 1000).toFixed(1);
```

**Vấn đề**:
- Khi stream đang chạy (status `pending`), gọi `Date.now()` mỗi lần render → giá trị elapsed "chạy" theo thời gian thực (UX tốt) **nhưng** khi user hover/move chuột cũng có thể trigger re-render → số giây nhảy loạn.
- Khi `finishedAt` có, hiển thị chính xác.

**Fix đề xuất** (optional):

```tsx
const [, force] = useReducer((x) => x + 1, 0);
useEffect(() => {
  if (trace.status !== "pending") return;
  const id = setInterval(force, 1000); // tick mỗi giây
  return () => clearInterval(id);
}, [trace.status]);
```

---

#### 🟢 [D6] `JSON.stringify(trace.effectiveRequestParams)` không định dạng

**Vị trí**: `DebugDetails.tsx:78`

```tsx
<div className="break-all">params: <span>{JSON.stringify(trace.effectiveRequestParams)}</span></div>
```

**Vấn đề**: Compact JSON rất khó đọc khi có nhiều key. Nên hiển thị dạng pretty-printed với scroll riêng.

**Fix đề xuất**:

```tsx
<pre className="mt-1 max-h-40 overflow-auto rounded border border-stone-900 bg-stone-900/60 p-2 text-[10px]">
  {JSON.stringify(trace.effectiveRequestParams, null, 2)}
</pre>
```

---

### 3.3 `src/components/devtools/ToolTraceCard.tsx`

#### 🟠 [T1] Cast `as [string, string | number | boolean][]` che giấu lỗi runtime

**Vị trí**: `ToolTraceCard.tsx:18-22`

```tsx
return Object.entries(trace.metadata).filter(([_, value]) => {
  const type = typeof value;
  return type === "string" || type === "number" || type === "boolean";
}) as [string, string | number | boolean][];
```

**Vấn đề**:
- Cast `as` qua mặt type checker. Nếu sau này `trace.metadata` đổi shape (ví dụ thêm `null`), filter trả về `null` nhưng TS nghĩ là `string | number | boolean` → render `[object Object]` ở runtime.
- Cùng pattern `as any` nên tránh.

**Fix đề xuất**:

```tsx
type Scalar = string | number | boolean;
function isScalar(v: unknown): v is Scalar {
  const t = typeof v;
  return t === "string" || t === "number" || t === "boolean";
}

const metadataEntries = Object.entries(trace.metadata).filter(
  (entry): entry is [string, Scalar] => isScalar(entry[1]),
);
```

---

#### 🟠 [T2] Không có test cho error path / `pending` status

**Vị trí**: `ToolTraceCard.tsx` — chỉ test thấy `success` path.

**Vấn đề**:
- Test hiện tại (`tool-trace-card.test.tsx`) chỉ cover `success` status với metadata scalar.
- Không test `pending` (chưa có `finishedAt`), không test `error` (có `error` field), không test metadata rỗng.
- Sơ suất nhỏ có thể phá vỡ UI ở production.

**Fix đề xuất** — bổ sung test:

```tsx
it("shows pending state when finishedAt is undefined", () => {
  const trace = { ...baseTrace, finishedAt: undefined, status: "pending" as const };
  render(<ToolTraceCard trace={trace} />);
  expect(screen.queryByText(/ms/i)).not.toBeInTheDocument();
});

it("renders error message when status is error", () => {
  const trace = { ...baseTrace, status: "error" as const, error: "boom" };
  render(<ToolTraceCard trace={trace} />);
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByText("boom")).toBeInTheDocument();
});
```

---

#### 🟡 [T3] `metadata` hiển thị raw key — nên localize các key phổ biến

**Vị trí**: `ToolTraceCard.tsx:52-54`

**Vấn đề**:
- Hiển thị `extractor: readability` — không sao vì là identifier.
- Nhưng các key như `textLength`, `contentChars` thuần tiếng Anh hiển thị cho user Việt sẽ khó hiểu.
- Hiện không có file i18n nào trong dự án → nên tạo `DEV_COPY.metadataLabels` cho những key đã biết.

**Fix đề xuất** (thêm vào `src/core/devtools/copy.ts`):

```ts
metadataLabels: {
  extractor: "Trình trích xuất",
  contentChars: "Số ký tự",
  textLength: "Độ dài văn bản",
  warnings: "Cảnh báo",
  action: "Hành động",
  url: "URL",
} as Record<string, string>,
```

Trong component:

```tsx
const label = DEV_COPY.metadataLabels[key] ?? key;
```

---

#### 🟢 [T4] Không nhất quán cách dùng icon/arrow với `DebugDetails`

**Vị trí**: Cả 2 component dùng `▲/▼` để toggle expand.

**Vấn đề**: Không phải vấn đề lớn, nhưng nếu sau này muốn đổi sang icon SVG, sẽ phải sửa 2 chỗ.

**Fix đề xuất**: Tạo `CollapseChevron` component dùng chung, hoặc dùng thư viện icon (lucide-react) đã có sẵn trong nhiều dự án.

---

### 3.4 `src/components/floating-window/FloatingWindow.tsx`

#### 🔴 [F1] Memory leak: drag/resize listener có thể bị "kẹt" khi component unmount giữa chừng

**Vị trí**: `FloatingWindow.tsx:198-270`

```tsx
const handleMouseDown = useCallback((e) => {
  // ...
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  // ⚠️ nếu component unmount trước khi mouseup, 2 listener treo vĩnh viễn
}, [...]);
```

**Vấn đề**:
- Khi user nhấn chuột để drag/resize, rồi extension gọi `destroyFloatingWindow()` (xem `scripts/floating-mount.ts`), 2 listener `mousemove`/`mouseup` không bao giờ được remove.
- `handleMouseUp` cố gọi `setSize` trên component đã unmount → React warning.
- Document body `cursor: "nwse-resize"` & `user-select: "none"` cũng không được khôi phục → toàn trang bị "đóng băng" chuột.

**Tái hiện**:
1. Mở cửa sổ nổi → kéo bằng header.
2. Trong khi đang giữ chuột, click icon extension để mở sidepanel → floating window bị destroy (theo `AGENTS.md`).
3. Sau khi sidepanel đóng, cửa sổ nổi biến mất nhưng cursor vẫn ở trạng thái `move`, document không bắt được sự kiện chuột.

**Fix đề xuất**:

```tsx
// Tách thành custom hook dùng chung
function useDraggable(handleRef: RefObject<HTMLElement>) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const dragRef = useRef<{ sx: number; sy: number; st: number; sl: number } | null>(null);

  const start = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, st: pos.top, sl: pos.left };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        top: dragRef.current.st + ev.clientY - dragRef.current.sy,
        left: dragRef.current.sl + ev.clientX - dragRef.current.sx,
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pos]);

  // Cleanup khi unmount
  useEffect(() => () => {
    dragRef.current = null;
    // removeEventListener không có tham chiếu → leak vẫn còn nếu drag đang chạy
    // cần lưu onMove/onUp vào ref
  }, []);

  return { pos, start };
}
```

Hoặc đơn giản hơn — dùng `AbortController`:

```tsx
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  // ...
  const ac = new AbortController();
  document.addEventListener("mousemove", handleMouseMove, { signal: ac.signal });
  document.addEventListener("mouseup", handleMouseUp, { signal: ac.signal });

  // Cleanup hook:
  return () => ac.abort();
}, [...]);
```

Hoặc thêm safety net trong cleanup effect:

```tsx
useEffect(() => {
  return () => {
    dragRef.current = null;
    resizeRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    // Best-effort: remove all listeners
    // (Không có tham chiếu nên chỉ khôi phục CSS)
  };
}, []);
```

---

#### 🔴 [F2] Không có giới hạn trên khi maximize ở màn hình rất nhỏ

**Vị trí**: `FloatingWindow.tsx:295-303`

```tsx
} else if (windowState === "maximized") {
  const vw = window.innerWidth * MAXIMIZED_RATIO;   // 0.9
  const vh = window.innerHeight * MAXIMIZED_RATIO;
  containerStyle = {
    width: `${vw}px`,
    height: `${vh}px`,
    top: `${(window.innerHeight - vh) / 2}px`,
    left: `${(window.innerWidth - vw) / 2}px`,
  };
}
```

**Vấn đề**:
- Khi window trình duyệt nhỏ (≤ 320px), `vw * 0.9 = 288px` < `MIN_WIDTH = 280px` (gần ngưỡng).
- Trên mobile browser hoặc cửa sổ 240px thì cửa sổ nổi 216×… px, gần như không sử dụng được.
- Không có logic "full screen" cho thiết bị rất nhỏ.

**Fix đề xuất**:

```tsx
const vw = Math.max(MIN_WIDTH, Math.min(window.innerWidth * MAXIMIZED_RATIO, 1600));
const vh = Math.max(MIN_HEIGHT, Math.min(window.innerHeight * MAXIMIZED_RATIO, 1200));
```

Hoặc responsive: nếu `window.innerWidth < 480` thì dùng full-screen thay vì 0.9 ratio.

---

#### 🟠 [F3] Style object tái tạo mỗi render → không tận dụng React.memo cho child

**Vị trí**: `FloatingWindow.tsx:60-78`

```tsx
const loadingDot = (delay: number): React.CSSProperties => ({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "#A78BFA",
  animation: "floating-dot-bounce 1.2s ease-in-out infinite",
  animationDelay: `${delay}s`,
});
```

**Vấn đề**:
- Style được tạo mới mỗi lần render → child component (nếu được `React.memo`) sẽ luôn re-render.
- Inline style cũng tăng bundle size và khó debug (DevTools panel "Styles" trống).

**Fix đề xuất**: Nên dùng Tailwind (giống phần còn lại của app) hoặc tách className cố định:

```tsx
<div className="h-2 w-2 rounded-full bg-violet-400 animate-[floating-dot-bounce_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${delay}s` }} />
```

> Như `tailwind.config.ts` đã có `primary`, `primary-light`, animation custom thì hoàn toàn khả thi.

---

#### 🟠 [F4] Inconsistency: sidepanel dùng Tailwind, floating-window dùng inline style

**Vị trí**: Toàn bộ 4 file trong `floating-window/`.

**Vấn đề**:
- `MessageContent`, `DebugDetails`, `ToolTraceCard` đều dùng Tailwind className.
- `FloatingWindow`, `WindowHeader`, `FloatingChatMessage` dùng inline `style={{ ... }}` với màu hex hard-coded.
- 2 hệ thống theme song song → khi đổi màu primary, hover, border, animation đều phải sửa 2 nơi.
- Khó thêm dark/light theme.

**Fix đề xuất**:
- Refactor toàn bộ `floating-window` sang Tailwind. Tận dụng:
  - `bg-stone-900` thay cho `#1C1917`
  - `text-stone-50` thay cho `#FAFAF9`
  - `shadow-2xl` thay cho custom shadow
  - Animation keyframes đã có sẵn trong `tailwind.config.ts` (xem `floating-fade-in-up`, v.v.).
- Hoặc nếu muốn giữ inline (do Shadow DOM), tạo CSS-in-JS helper + theme tokens.

> Lưu ý: trong `floating-mount.ts` có file CSS mini-tailwind bên trong Shadow DOM — chứng tỏ team đã có hướng dùng Tailwind trong Shadow DOM. Nên mở rộng giải pháp này.

---

#### 🟠 [F5] `clampToViewport` không xử lý tốt khi cửa sổ kéo xuống dưới `0` (thanh taskbar)

**Vị trí**: `FloatingWindow.tsx:115-122`

```tsx
const clampToViewport = useCallback((top, left, w?, h?) => {
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const cw = w ?? size.width;
  const ch = h ?? size.height;
  return {
    top: Math.max(0, Math.min(top, wh - Math.min(ch, wh))),
    left: Math.max(0, Math.min(left, ww - Math.min(cw, ww))),
  };
}, [size]);
```

**Vấn đề**:
- `Math.min(ch, wh)` đảm bảo `top + ch ≤ wh`. Đúng.
- Nhưng nếu `ch > wh` (cửa sổ rất cao), `top` sẽ bị clamp về `0` và phần dưới cùng bị cắt → user không thấy footer.
- Khi window trình duyệt resize (kéo cạnh), giá trị `pos` không được clamp lại → cửa sổ có thể "trôi" ra ngoài viewport.

**Fix đề xuất**:

```tsx
useEffect(() => {
  const onResize = () => {
    setPos((p) => clampToViewport(p.top, p.left));
  };
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, [clampToViewport]);
```

---

#### 🟡 [F6] Race condition: `useEffect` start stream dựa trên `props.toolTrace` reference

**Vị trí**: `FloatingWindow.tsx:165-183`

```tsx
useEffect(() => {
  isDoneRef.current = false;
  const isDevModeActive = Boolean(props.toolTrace);
  start({...});
  return () => { stop(); };
}, [props.requestId, props.messages, props.toolTrace, start, stop]);
```

**Vấn đề**:
- Mỗi lần `props.toolTrace` reference đổi (kể cả object mới có cùng giá trị), effect chạy lại → `stop()` cũ + `start()` mới → AI request bị hủy và bắt đầu lại.
- Nếu parent component (`floating-mount.ts` hoặc `entrypoints/active-tab-agent.ts`) cập nhật `toolTrace` trong khi stream đang chạy, user sẽ thấy "đang tải..." nhảy liên tục.

**Fix đề xuất**:
- Tách 2 effect: 1 cho việc khởi động stream (phụ thuộc `requestId`, `messages`), 1 cho việc cập nhật `toolTrace` (không restart stream).

```tsx
useEffect(() => {
  isDoneRef.current = false;
  start({ requestId, sessionId, messages, devContext: props.toolTrace ? { surface: "floating", feature: "chat" } : undefined });
  return () => stop();
}, [props.requestId, props.messages, start, stop]);
```

`devContext` không cần nằm trong dependency array của effect khởi động — có thể set qua ref hoặc prop riêng.

---

#### 🟡 [F7] `useRef` initialization với `crypto.randomUUID()` mỗi mount → mất session affinity khi re-mount

**Vị trí**: `FloatingWindow.tsx:130`

```tsx
const sessionIdRef = useRef<string>(crypto.randomUUID());
```

**Vấn đề**:
- Mỗi lần component remount (ví dụ khi user bôi đen text mới → floating window được destroy → mount lại), `sessionId` mới được tạo → theo CHANGELOG `[0.3.2]`, session affinity với OpenCode backend bị mất → mất cache + re-route.
- Nên truyền `sessionId` từ caller hoặc persist qua `chrome.storage.session`.

**Fix đề xuất**:
- Caller truyền `sessionId` qua props (cùng sessionId từ chat sidepanel).
- Hoặc đọc từ `chrome.storage.session.get("floatingSessionId")` và fallback sang UUID mới.

---

#### 🟡 [F8] Thiếu hiển thị khi `responseContent` rỗng và `streamState === "done"` (finish rỗng)

**Vị trí**: `FloatingWindow.tsx:368-380`

```tsx
{(streamState === "streaming" || streamState === "done") && (
  <>
    <FloatingChatMessage content={responseContent} streamState={streamState} />
    ...
  </>
)}
```

**Vấn đề**:
- Khi AI trả về response rỗng (lỗi provider, model không trả gì), `FloatingChatMessage` sẽ render `<div>` rỗng. User không hiểu chuyện gì đã xảy ra.
- Nên có fallback: "AI không trả về nội dung. Vui lòng thử lại."

---

#### 🟢 [F9] `defaultPosRef` lưu vị trí khởi đầu nhưng không restore khi user maximize → restore sai

**Vị trí**: `FloatingWindow.tsx:87-88`, `handleMaximize` line 322

```tsx
const defaultPosRef = useRef(props.initialPosition);
// ...
const handleMaximize = useCallback(() => {
  if (windowState === "maximized") {
    setWindowState("default");
    setPos(defaultPosRef.current);
    setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    ...
  }
}, [windowState]);
```

**Vấn đề**:
- Sau khi user drag tới vị trí mới, nếu họ minimize → restore: `setPos(defaultPosRef.current)` luôn quay về vị trí khởi đầu, **không phải** vị trí trước khi minimize.
- Đây là bug UX: user expect "khôi phục vị trí trước khi minimize" chứ không phải "về vị trí lúc đầu mount".

**Fix đề xuất**:

```tsx
const lastDefaultStateRef = useRef({ pos: props.initialPosition, size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT } });

const handleMinimize = () => {
  if (windowState !== "minimized") {
    // Lưu vị trí hiện tại trước khi minimize
    lastDefaultStateRef.current = { pos, size };
  }
  setWindowState(windowState === "minimized" ? "default" : "minimized");
};

const handleMaximize = useCallback(() => {
  if (windowState !== "default") {
    // Lưu vị trí hiện tại trước khi maximize
    lastDefaultStateRef.current = { pos, size };
  }
  if (windowState === "maximized") {
    setWindowState("default");
    setPos(lastDefaultStateRef.current.pos);
    setSize(lastDefaultStateRef.current.size);
    sizeRef.current = lastDefaultStateRef.current.size;
  } else {
    setWindowState("maximized");
  }
}, [windowState, pos, size]);
```

---

### 3.5 `src/components/floating-window/FloatingChatMessage.tsx`

#### 🔴 [FC1] Duplicate gần như toàn bộ logic với `MessageContent.tsx` — drift không tránh khỏi

**Vị trí**: Toàn bộ file, ~230 dòng.

**Vấn đề**:
- Parse `**bold**`, `*italic*`, `` `code` ``, code-block, danh sách, heading — **giống hệt** `MessageContent.tsx` chỉ khác:
  - Dùng inline style thay vì Tailwind.
  - Thêm "cursor" vào element cuối cùng khi streaming.
  - Render `h3` cố định thay vì switch `h1/h2/h3`.
- Nếu fix bug parse ở 1 file, file kia vẫn sai. Đây là single source of truth bị phá vỡ.
- Test coverage chỉ có ở `MessageContent` (qua integration), `FloatingChatMessage` **không có test riêng**.

**Fix đề xuất** (refactor lớn):

Tách `src/core/markdown/renderer.ts`:

```ts
// src/core/markdown/renderer.ts
export type RenderMode = "tailwind" | "inline";
export type ParsedBlock =
  | { kind: "paragraph"; nodes: ReactNode[] }
  | { kind: "codeBlock"; lang: string; content: string }
  | { kind: "heading"; level: number; nodes: ReactNode[] }
  | { kind: "list"; items: ReactNode[][] }
  | { kind: "spacer" };

export function parseMarkdown(content: string): ParsedBlock[] { /* ... */ }
export function tokenizeInline(text: string): InlineToken[] { /* ... */ }
```

Sau đó 2 component chỉ là "skin":

```tsx
// MessageContent.tsx
import { parseMarkdown, tokenizeInline } from "../../core/markdown/renderer";
export function MessageContent({ content }: { content: string }) {
  return <>{parseMarkdown(content).map((b, i) => renderBlockTailwind(b, i))}</>;
}

// FloatingChatMessage.tsx
export function FloatingChatMessage({ content, streamState }: Props) {
  const isStreaming = streamState === "streaming";
  return <>{parseMarkdown(content).map((b, i) => renderBlockInline(b, i, isStreaming))}</>;
}
```

Cùng lúc sửa luôn:
- Heading `h4..h6` (bug [C1]).
- Inline parse bug (bug [C2]).
- Thêm blockquote, link, copy-code.

---

#### 🟠 [FC2] Inline parse `*italic*` greedy có cùng bug với `MessageContent`

**Vị trí**: `FloatingChatMessage.tsx:33-67`

```tsx
const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
// ...
if (part.startsWith("**") && part.endsWith("**")) {
  return <strong key={idx} style={{...}}>{part.slice(2, -2)}</strong>;
}
```

**Vấn đề**: giống [C2] — cùng fix chung khi refactor.

---

#### 🟠 [FC3] Cursor chỉ xuất hiện trên 1 element cuối — không nhảy khi user thấy "drop" thụt vào dòng mới

**Vị trí**: `FloatingChatMessage.tsx:140-225`

**Vấn đề**:
- Logic `appendCursor && isLastLine` chỉ đặt cursor ở phần tử cuối cùng trong array. Nếu dòng cuối rỗng (`""`), cursor được push 1 span riêng. OK.
- Nhưng nếu dòng cuối là heading, cursor nằm trong heading → trông như cursor đang nhấp nháy trong tiêu đề, dễ gây hiểu nhầm là cursor trong `<h3>`.

**Fix đề xuất**:
- Tách cursor ra khỏi block cuối: render cursor ở ngoài `parseMarkdown`, chỉ khi `isStreaming`.

```tsx
export function FloatingChatMessage({ content, streamState }: Props) {
  const isStreaming = streamState === "streaming";
  return (
    <div>
      {renderMarkdown(content, false)} {/* không truyền cursor vào parser */}
      {isStreaming && <span style={styles.cursor} />}
    </div>
  );
}
```

---

#### 🟡 [FC4] Không có test cho `FloatingChatMessage`

**Vị trí**: `tests/` — không tìm thấy file test cho `FloatingChatMessage`.

**Vấn đề**: Thay đổi parse logic sẽ không bị phát hiện nếu chỉ test integration.

**Fix đề xuất**: Thêm `tests/components/floating-chat-message.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FloatingChatMessage } from "../../src/components/floating-window/FloatingChatMessage";

describe("FloatingChatMessage", () => {
  it("renders bold/italic/code inline", () => {
    const { container } = render(<FloatingChatMessage content="**B** *I* `C`" streamState="done" />);
    expect(container.querySelector("strong")?.textContent).toBe("B");
    expect(container.querySelector("em")?.textContent).toBe("I");
    expect(container.querySelector("code")?.textContent).toBe("C");
  });

  it("appends cursor when streaming and content not empty", () => {
    const { container } = render(<FloatingChatMessage content="hi" streamState="streaming" />);
    expect(container.querySelectorAll("span[style*='floating-blink']").length).toBeGreaterThan(0);
  });

  it("handles headings h4..h6", () => {
    const { container } = render(<FloatingChatMessage content="#### H4" streamState="done" />);
    expect(container.querySelector("h4")?.textContent).toBe("H4");
  });
});
```

---

### 3.6 `src/components/floating-window/WindowHeader.tsx`

#### 🟠 [WH1] Hover state dùng inline conditional style thay vì Tailwind

**Vị trí**: `WindowHeader.tsx:46-63`

```tsx
controlBtn: (hover: boolean): React.CSSProperties => ({
  ...,
  background: hover ? "#3C3833" : "transparent",
  ...
}),
```

**Vấn đề**:
- `useState` riêng cho mỗi `ControlButton` → 3 useState + 3 re-render khi user hover lần lượt qua 3 button.
- Inline style chỉ hover bg, không có hover text-color hoặc focus ring → accessibility yếu.

**Fix đề xuất**:

```tsx
function ControlButton({ label, onClick, children }: Props) {
  return (
    <button
      data-window-control="true"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="w-[22px] h-[22px] rounded-md border-0 bg-transparent text-stone-400 hover:bg-stone-700/60 hover:text-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 cursor-pointer flex items-center justify-center text-xs font-bold transition-colors duration-150 p-0 leading-none"
    >
      {children}
    </button>
  );
}
```

Tiết kiệm 1 `useState`, dùng CSS thuần, dễ style hơn.

---

#### 🟡 [WH2] Title thay đổi theo `windowState` nhưng không sync với loading/error state

**Vị trí**: `WindowHeader.tsx:97-100`

```tsx
<span style={styles.title}>
  {props.windowState === "minimized" ? "AI" : props.title}
</span>
```

**Vấn đề**:
- Khi đang streaming, title vẫn là "AI Assistant" — user không biết AI đang nghĩ hay đã xong.
- Khi error, vẫn hiển thị "AI Assistant" — không có indicator.

**Fix đề xuất**:

```tsx
type Status = "loading" | "streaming" | "done" | "error";
// Truyền thêm prop status từ FloatingWindow
<span>
  {status === "streaming" && "AI đang trả lời..."}
  {status === "loading" && "AI đang kết nối..."}
  {status === "error" && "Lỗi"}
  {(status === "done" || !status) && (windowState === "minimized" ? "AI" : title)}
</span>
```

---

### 3.7 `src/components/floating-window/types.ts`

#### 🟢 [WT1] `StreamState` có `"idle"` nhưng không dùng

**Vị trí**: `types.ts:2`

```ts
export type StreamState = "idle" | "loading" | "streaming" | "done" | "error";
```

**Vấn đề**: Tìm qua code, không có chỗ nào set `streamState` thành `"idle"`. State ban đầu là `"loading"`.

**Fix đề xuất**: Bỏ `"idle"` khỏi type union để tránh dead code.

---

## 4. Cross-cutting issues (toàn bộ `src/components`)

### 4.1 Trùng lặp giữa hai markdown renderer

Đã trình bày ở [FC1]. Đây là vấn đề **lớn nhất** cần ưu tiên refactor.

### 4.2 Magic color hex scattered

Tổng kết các màu hard-code:

| File | Hex | Ý nghĩa | Tương đương Tailwind |
|------|-----|----------|----------------------|
| `FloatingWindow.tsx` | `#1C1917` | bg chính | `bg-stone-900` |
| `FloatingWindow.tsx` | `#FAFAF9` | text chính | `text-stone-50` |
| `FloatingWindow.tsx` | `#A78BFA` | accent | `text-primary-light` |
| `FloatingWindow.tsx` | `#FCA5A5` | error text | `text-red-300` |
| `FloatingWindow.tsx` | `rgba(68,64,60,0.5)` | border | `border-stone-700/50` |
| `WindowHeader.tsx` | `#292524` | header bg | `bg-stone-800` |
| `WindowHeader.tsx` | `#3C3833` | hover bg | `bg-stone-700` |
| `FloatingChatMessage.tsx` | `#F472B6` | code text | `text-pink-400` |
| `FloatingChatMessage.tsx` | `#C084FC` | pre code text | `text-purple-400` |
| `DebugDetails.tsx` | `#34d399`, `#fbbf24`, `#f87171` | status colors | đã có trong Tailwind |

**Fix đề xuất**: Định nghĩa `src/constants/theme.ts` làm single source of truth cho các màu hex đặc thù (ví dụ primary gradient trong `WindowHeader`), hoặc migrate sang Tailwind.

### 4.3 Accessibility toàn diện

| Component | Thiếu |
|-----------|-------|
| `MessageContent` | `pre` không có `aria-label` cho code block |
| `DebugDetails` | thiếu `aria-live`, `role="region"` |
| `ToolTraceCard` | thiếu `role="region"`, button thiếu `aria-controls` |
| `FloatingWindow` | không có keyboard trap khi maximize, không có `role="dialog"` |
| `WindowHeader` | button thiếu `aria-label` (chỉ có `title`) |
| `FloatingChatMessage` | streaming cursor thiếu `aria-live` để báo cho screen reader |

**Fix đề xuất**: Thêm 1 file `src/components/_accessibility.ts` chứa các helper:

```ts
export const ariaLabels = {
  closeWindow: "Đóng cửa sổ",
  minimize: "Thu nhỏ cửa sổ",
  maximize: "Phóng to cửa sổ",
  restore: "Khôi phục kích thước",
  copyThinking: "Sao chép nội dung suy nghĩ",
  copyCodeBlock: "Sao chép đoạn code",
  streamingCursor: "AI đang trả lời",
} as const;
```

### 4.4 Task mới: Mở rộng MessageContent — từ Markdown Renderer sang Rich Content Renderer

#### Mục tiêu

Hiện tại `MessageContent` và `FloatingChatMessage` chỉ parse markdown text thuần túy. Để extension có thể hiển thị nhiều loại dữ liệu phong phú hơn từ AI response, cần mở rộng thành **Rich Content Renderer** hỗ trợ nhiều block types ngoài markdown.

#### Các loại block cần hỗ trợ

| # | Block Type | Mô tả | Ví dụ từ AI | UI mẫu |
|---|------------|--------|-------------|---------|
| 1 | **Markdown text** | Văn bản markdown cơ bản (giữ nguyên) | Giải thích, tóm tắt | Bubble text thường |
| 2 | **Code block** | Đoạn code có syntax highlight | Giải thích code, refactor | Dark panel + copy button |
| 3 | **Table** | Bảng dữ liệu | So sánh options, bảng giá | `<table>` responsive |
| 4 | **Image** | Hình ảnh từ URL | Sơ đồ, biểu đồ, minh họa | `<img>` với lazy load |
| 5 | **JSON/Object** | Dữ liệu structured | API response, config, JSON | Collapsible `<pre>` với syntax color |
| 6 | **Alert/Callout** | Nhấn mạnh thông tin | Cảnh báo, lưu ý, tip | Colored border panel |
| 7 | **Step/Process** | Danh sách bước thực hiện | Hướng dẫn từng bước | Numbered list với icon |
| 8 | **Comparison** | So sánh 2 mặt | Ưu/nhược, before/after | 2-column layout |
| 9 | **Stats/Metrics** | Số liệu thống kê | Kết quả phân tích, benchmark | Cards với icon + số |
| 10 | **Definition/Term** | Định nghĩa từ vựng/khái niệm | Khi user hỏi về thuật ngữ | Term + definition card |
| 11 | **Quote/Blockquote** | Trích dẫn | Trích từ bài viết, sách | Indented với left border |
| 12 | **Chart placeholder** | Vẽ biểu đồ đơn giản | Dữ liệu dạng bảng → biểu đồ | Canvas/SVG mini chart |

#### Kiến trúc đề xuất

**1. Tách parser thành 2 tầng:**

```
AI Response (raw string / structured JSON)
         ▼
Block Parser (Phase 1)
- Markdown → [TextBlock, CodeBlock, HeadingBlock, ...]
- Detected structured data → [TableBlock, JsonBlock]
         ▼
Block Renderer (Phase 2)
TextBlock  → <p> với inline styles
CodeBlock  → <pre> + copy button + syntax highlight
TableBlock → <table> responsive
ImageBlock → <img> lazy load
JsonBlock  → collapsible <pre> colored
AlertBlock → callout panel
...
```

**2. Thêm structured data detection:**

```tsx
// src/core/message-parser/detectors.ts

type BlockType =
  | "text" | "code" | "table" | "image"
  | "json" | "alert" | "steps" | "comparison"
  | "stats" | "definition" | "quote";

interface DetectedBlock {
  type: BlockType;
  content: string;
  metadata?: Record<string, unknown>;
  confidence: number; // 0-1, độ chắc chắn của detector
}

// Detector registry — mỗi detector trả về confidence
const detectors: Array<(block: string) => DetectedBlock | null> = [
  detectJsonBlock,    // JSON.parse() thành công + confidence cao
  detectTableBlock,   // có nhiều dòng | pipes
  detectCodeBlock,    // ``` hoặc indent 4 spaces
  detectImageBlock,   // URL ảnh (jpg, png, gif, webp, svg)
  detectAlertBlock,   // bắt đầu bằng ⚠️, ❗, 💡, ✅, 📌
  detectStepsBlock,   // bắt đầu bằng số. (1. 2. 3.)
  detectQuoteBlock,   // bắt đầu bằng >
  detectStatsBlock,   // nhiều số + nhãn (accuracy: 95%, ...)
];

// Chạy tất cả detectors, lấy confidence cao nhất
function detectBlockType(raw: string): DetectedBlock {
  let best: DetectedBlock = { type: "text", content: raw, confidence: 0 };
  for (const detector of detectors) {
    const result = detector(raw);
    if (result && result.confidence > best.confidence) {
      best = result;
    }
  }
  return best;
}
```

**3. File structure mới:**

```
src/
├── core/
│   └── message-parser/
│       ├── index.ts              ← exports chính
│       ├── block-types.ts        ← BlockType enum + interfaces
│       ├── detectors/
│       │   ├── index.ts          ← registry + detectBlock
│       │   ├── json.ts           ← detect JSON
│       │   ├── table.ts          ← detect markdown table
│       │   ├── image.ts          ← detect image URL
│       │   ├── alert.ts          ← detect callout/alert
│       │   ├── steps.ts          ← detect numbered steps
│       │   ├── stats.ts          ← detect metrics
│       │   └── quote.ts          ← detect blockquote
│       └── renderers/
│           ├── index.ts          ← renderBlock factory
│           ├── text.tsx           ← TextBlock renderer
│           ├── code.tsx           ← CodeBlock + syntax highlight
│           ├── table.tsx          ← TableBlock responsive
│           ├── image.tsx          ← ImageBlock + lazy load
│           ├── json.tsx           ← JsonBlock collapsible
│           ├── alert.tsx          ← AlertBlock callout
│           ├── steps.tsx          ← StepsBlock numbered
│           ├── comparison.tsx     ← ComparisonBlock 2-col
│           ├── stats.tsx          ← StatsBlock cards
│           ├── definition.tsx     ← DefinitionBlock term card
│           └── quote.tsx          ← QuoteBlock
├── components/
│   ├── chat/
│   │   └── MessageContent.tsx   ← simplified, chỉ compose blocks
│   └── floating-window/
│       └── FloatingChatMessage.tsx ← reuse renderers
```

**4. Ví dụ detector cụ thể:**

```tsx
// json.ts
export function detectJsonBlock(raw: string): DetectedBlock | null {
  const trimmed = raw.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      JSON.parse(trimmed);
      return { type: "json", content: trimmed, confidence: 0.95 };
    } catch {}
  }
  return null;
}

// table.ts
export function detectTableBlock(lines: string[]): DetectedBlock | null {
  // Markdown table: | col1 | col2 | ... |
  //                  |-----|-----|       |
  //                  | val | val |       |
  const hasHeader = lines[0]?.match(/^\|.+\|$/);
  const hasSeparator = lines[1]?.match(/^\|[-:\s]+\|[-:\s]+\|$/);
  const hasRows = lines.slice(2).every(l => l.match(/^\|.+\|$/));
  if (hasHeader && hasSeparator && hasRows) {
    return {
      type: "table",
      content: lines.join("\n"),
      confidence: 0.9,
    };
  }
  // Pipe-separated values (CSV-like)
  const pipeCount = (lines[0]?.match(/\|/g) || []).length;
  if (lines.length >= 2 && lines.every(l => l.split("|").length >= pipeCount)) {
    return { type: "table", content: lines.join("\n"), confidence: 0.7 };
  }
  return null;
}

// alert.ts
export function detectAlertBlock(raw: string): DetectedBlock | null {
  const alertPrefixes = [
    { icon: "⚠️",  label: "Cảnh báo", color: "amber" },
    { icon: "❗",  label: "Quan trọng", color: "red" },
    { icon: "💡",  label: "Mẹo", color: "blue" },
    { icon: "✅",  label: "Lưu ý", color: "green" },
    { icon: "📌",  label: "Ghi chú", color: "purple" },
    { icon: "🔴",  label: "Lỗi", color: "red" },
    { icon: "🟡",  label: "Cảnh báo", color: "amber" },
    { icon: "🟢",  label: "Thành công", color: "green" },
  ];
  for (const { icon, label, color } of alertPrefixes) {
    if (raw.startsWith(icon) || raw.startsWith(label)) {
      return { type: "alert", content: raw, metadata: { color, label }, confidence: 0.85 };
    }
  }
  return null;
}
```

**5. Ví dụ renderer cụ thể:**

```tsx
// table.tsx — TableBlock renderer
export function TableBlock({ content }: { content: string }) {
  const rows = content
    .split("\n")
    .filter(l => l.trim() && !l.match(/^\|[-:\s]+\|$/)) // bỏ separator
    .map(row => row.split("|").filter(c => c.trim()).map(c => c.trim()));

  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = sortCol !== null
    ? [...rows.slice(1)].sort((a, b) => {
        const va = a[sortCol] ?? "", vb = b[sortCol] ?? "";
        return sortDir === "asc"
          ? va.localeCompare(vb, "vi", { numeric: true })
          : vb.localeCompare(va, "vi", { numeric: true });
      })
    : rows.slice(1);

  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-stone-800">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-stone-800/60">
            {rows[0].map((h, i) => (
              <th
                key={i}
                className="cursor-pointer px-3 py-2 text-left font-semibold text-stone-300 hover:text-primary-light"
                onClick={() => {
                  if (sortCol === i) setSortDir(d => d === "asc" ? "desc" : "asc");
                  else { setSortCol(i); setSortDir("asc"); }
                }}
              >
                {h}
                {sortCol === i && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, ri) => (
            <tr key={ri} className="border-t border-stone-800/60 hover:bg-stone-800/30">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-stone-200">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// image.tsx — ImageBlock renderer
export function ImageBlock({ url, alt }: { url: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-stone-800">
      {!loaded && !error && (
        <div className="h-40 flex items-center justify-center bg-stone-800/40 animate-pulse">
          <span className="text-stone-500 text-sm">Đang tải hình ảnh...</span>
        </div>
      )}
      {error && (
        <div className="h-20 flex items-center justify-center bg-stone-800/40 text-stone-500 text-sm">
          Không thể tải hình ảnh
        </div>
      )}
      <img
        src={url}
        alt={alt ?? "Hình ảnh từ AI"}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`max-w-full h-auto transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

// alert.tsx — AlertBlock renderer
export function AlertBlock({
  content,
  color = "blue",
  label,
}: {
  content: string;
  color?: "red" | "amber" | "green" | "blue" | "purple";
  label?: string;
}) {
  const colors = {
    red:    "border-red-500/50 bg-red-950/20 text-red-300",
    amber:  "border-amber-500/50 bg-amber-950/20 text-amber-300",
    green:  "border-emerald-500/50 bg-emerald-950/20 text-emerald-300",
    blue:   "border-blue-500/50 bg-blue-950/20 text-blue-300",
    purple: "border-violet-500/50 bg-violet-950/20 text-violet-300",
  };

  return (
    <div className={`my-3 rounded-lg border-l-4 p-3 ${colors[color]}`}>
      {label && <div className="font-semibold text-xs uppercase tracking-wide mb-1 opacity-80">{label}</div>}
      <div className="text-[13px] leading-relaxed">{content}</div>
    </div>
  );
}
```

**6. Backward compatibility:**

`MessageContent` giữ nguyên props:

```tsx
export function MessageContent({ content }: { content: string }) {
  const blocks = parseMessageBlocks(content); // detect all blocks
  return (
    <div className="space-y-1">
      {blocks.map((block, i) => (
        <MessageBlock key={i} block={block} />
      ))}
    </div>
  );
}
```

→ Consumer (`ChatMessage`, `SummaryTab`, `QATab`) **không cần thay đổi**.

**7. FloatingChatMessage reuse:**

```tsx
// floating-window/FloatingChatMessage.tsx
import { parseMessageBlocks } from "../../core/message-parser";
import { renderBlock as renderBlockInline } from "../../core/message-parser/renderers"; // inline-style version

export function FloatingChatMessage({ content, streamState }) {
  const isStreaming = streamState === "streaming";
  const blocks = parseMessageBlocks(content);
  return (
    <div>
      {blocks.map((block, i) => renderBlockInline(block, i, isStreaming))}
      {isStreaming && <StreamingCursor />}
    </div>
  );
}
```

#### Thứ tự triển khai đề xuất

| Phase | Blocks | Lí do |
|-------|--------|-------|
| **Phase 1** | Code, Table, Alert | Dễ detect (syntax clear), high-impact |
| **Phase 2** | JSON, Image | AI hay trả về JSON config + hình ảnh minh họa |
| **Phase 3** | Steps, Quote, Definition | Cần thêm context từ AI prompt |
| **Phase 4** | Comparison, Stats, Chart | Phức tạp hơn, cần UX tốt |

#### Test plan

```tsx
// tests/message-parser/detectors.test.ts
describe("detectTableBlock", () => {
  it("detects markdown table", () => {
    const input = [
      "| Tên | Giá |",
      "|------|------|",
      "| A   | 100 |",
      "| B   | 200 |",
    ].join("\n");
    expect(detectTableBlock(input.split("\n"))?.type).toBe("table");
  });
  it("rejects plain text", () => {
    expect(detectTableBlock(["hello world"])).toBeNull();
  });
});

// tests/message-parser/renderers/table.test.tsx
describe("TableBlock", () => {
  it("sorts ascending on column click", async () => {
    render(<TableBlock content="| Name |\n|----|\n| Bob |\n| Ana |" />);
    await user.click(screen.getByText("Name"));
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });
});
```

#### KPI đo lường thành công

- AI trả về markdown table → hiển thị bảng responsive (sort được)
- AI trả về JSON config → collapsible `<pre>` có màu syntax
- AI trả về `⚠️ Cảnh báo: ...` → callout panel đúng màu
- AI trả về URL ảnh → lazy load + fallback error
- Không regression với markdown text thường
- FloatingWindow hiển thị đúng như Sidepanel

---

### 4.5 Test coverage

| File | Test? | Ghi chú |
|------|-------|---------|
| `MessageContent.tsx` | ❌ | Không có unit test — chỉ test qua `chat-message.test.tsx` |
| `FloatingChatMessage.tsx` | ❌ | Không có |
| `DebugDetails.tsx` | ✅ | `tests/devtools/debug-details.test.tsx` (đủ) |
| `ToolTraceCard.tsx` | ✅ | `tests/devtools/tool-trace-card.test.tsx` (chỉ success) |
| `FloatingWindow.tsx` | ✅ | `tests/floating-window.test.tsx` (5 cases, thiếu drag/resize/error) |
| `WindowHeader.tsx` | ❌ | Test qua FloatingWindow |

**Fix đề xuất**:
- Thêm test cho `MessageContent` và `FloatingChatMessage`.
- Bổ sung test cho drag/resize (`FloatingWindow`).
- Bổ sung test cho error/pending paths (`ToolTraceCard`).

---

## 5. Đề xuất thứ tự ưu tiên sửa

### Sprint này (P0) — phải fix

1. **[F1] Drag/resize leak** — bug gây "đóng băng" trang trong điều kiện đặc biệt.
2. **[C2] Inline parse `*` vs `**`** — bug hiển thị rất phổ biến khi user chat.
3. **[D1] `setTimeout` cleanup** — React warning + UX feedback race.
4. **[C1] Heading `h4..h6`** — bug semantic + accessibility.

### Sprint tới (P1) — refactor

5. **[FC1] Tách markdown renderer dùng chung** — refactor lớn, dọn debt kỹ thuật.
6. **[F4] Migrate floating-window sang Tailwind** — thống nhất design system.
7. **[F9] Restore vị trí sau minimize/maximize** — fix UX.
8. **[T1] Bỏ cast `as` trong ToolTraceCard** — type safety.
9. **[D4] Auto-expand gây khó chịu** — fix UX.
10. **[WH1] Bỏ hover state vô ích** — performance + a11y.

### Backlog (P2) — cải tiến

11. [C3] Hỗ trợ blockquote/link/escape.
12. [C4] Code block scroll + copy button.
13. [D3] Aria cho DebugDetails.
14. [F2] Maximize ở màn hình nhỏ.
15. [F5] Re-clamp khi resize window.
16. [F6] Tách effect stream start vs toolTrace update.
17. [FC4] Test FloatingChatMessage.
18. [T2] Test error/pending paths.
19. [T3] Localize metadata keys.
20. [C5] `useMemo` parse markdown.
21. [NEW] **Rich Content Renderer** — mở rộng MessageContent/FloatingChatMessage hỗ trợ Table, Image, JSON, Alert, Stats, Steps, Quote, Definition (xem §4.4).
22. [NEW] **Syntax highlight cho code block** — thay vì plain text, dùng `highlight.js` hoặc `prism-react-renderer` để colorize code theo ngôn ngữ.
23. [NEW] **Streaming cursor tách riêng** — cursor chỉ là span ngoài block, không nhảy vào element cuối cùng.

---

## 6. Lệnh chạy test/kiểm tra sau khi sửa

```bash
# Type check
npm run compile

# Chạy tất cả test
npm test

# Chạy test liên quan component
npm vitest run tests/floating-window.test.tsx
npm vitest run tests/devtools/
npm vitest run tests/chat-message.test.tsx

# Coverage
npm vitest run --coverage
```

> Trước khi merge, đảm bảo `npm run compile` pass (TypeScript strict mode) và không có React warning trong console test.

---

## 7. Phụ lục: mapping component ↔ chức năng

```
┌─────────────────────────────────────────────────────────────────────┐
│                     src/components/ (deps graph)                    │
└─────────────────────────────────────────────────────────────────────┘

  MessageContent.tsx ─────► (no deps)
  │
  ├─ used by ChatMessage.tsx (sidepanel)
  └─ used by reader components (SummaryTab, QATab)

  DebugDetails.tsx ───────► core/devtools/{types,copy}
  ToolTraceCard.tsx ──────► core/devtools/{types,copy}
  │
  └─ used by ChatMessage.tsx (sidepanel)
     FloatingWindow.tsx
     reader components

  FloatingWindow.tsx ─────► hooks/useAiStream
                          core/devtools/{types,trace-reducer}
                          devtools/{DebugDetails, ToolTraceCard}
                          floating-window/{WindowHeader, FloatingChatMessage}
                          scripts/floating-mount
                          core/messaging/types
                          core/ai/types
  │
  └─ mounted by scripts/floating-mount.ts
     (Shadow DOM, animation keyframes)

  FloatingChatMessage.tsx ► (no deps, pure renderer)
  WindowHeader.tsx ───────► floating-window/types
  types.ts ───────────────► (no deps, shared types)
```

**Vòng phụ thuộc (cycles)**: không có cycle. Tốt.

**Tuy nhiên**: `FloatingWindow` đang là 1 file **god component** (~340 dòng, 8 hook, nhiều concern). Nên tách:

- `hooks/useWindowState.ts` — state machine default/minimized/maximized.
- `hooks/useDraggable.ts` — drag logic.
- `hooks/useResizable.ts` — resize logic.
- `hooks/useAiStreamLifecycle.ts` — start/stop khi mount/unmount.

→ Component chính sẽ còn ~100 dòng, chỉ lo compose.

---

*Report generated: 2026-09-07*
