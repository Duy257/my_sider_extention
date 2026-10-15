# Code Review - Luồng UI DevTools (AI trace)

**Project**: Personal AI Sidebar (Chrome Manifest V3 Browser Extension)
**Review Date**: 2026-10-15
**Reviewer**: AI Code Review
**Branch**: `feat/mastra-ai-migration`
**Scope**: Luồng hiển thị dev trace từ service worker tới UI (sidepanel, cửa sổ nổi, reader)
**Mục đích**: Tìm nguyên nhân "luồng UI devtools hay bị lỗi, chậm" và đề xuất fix.

> Tài liệu này bổ sung cho `docs/review-code/COMPONENTS_REVIEW.md`. Một số mục ở đó
> (D3, D4, D5, C5) liên quan trực tiếp tới các vấn đề dưới đây; xem §7.
>
> **Cập nhật 2026-10-15**: đã sửa toàn bộ DV1–DV12 (kèm test hồi quy), xem `CHANGELOG.md` mục
> `[Unreleased]`. Sửa thêm ngoài danh sách: `tailwind.config.ts` chưa quét `src/**` nên class của
> `DebugDetails` (vd. `max-h-60` của ô reasoning) không có trong CSS build.

---

## 1. Phạm vi và luồng dữ liệu

```
background.ts (service worker)
  streamChatCompletion ── callbacks ──▶ createAiPortTraceEmitter (chỉ khi devMode + devContext)
    onFirstToken      → AI_STREAM_FIRST_TOKEN   (không kèm thời điểm)
    onReasoningDelta  → AI_STREAM_REASONING     (chỉ gửi khi có emitter)
    onDelta           → AI_STREAM_CHUNK
    onUsage / finish  → AI_STREAM_DEBUG_UPDATE
    onDone            → AI_STREAM_DONE  (+ trace đã chốt, gồm toàn bộ reasoning)
    onError           → AI_STREAM_ERROR (+ trace đã chốt)
    port bị ngắt      → abort, KHÔNG gửi gì thêm
                              │  Port "ai-stream"
                              ▼
                 src/hooks/useAiStream.ts
        ┌────────────────────┼─────────────────────────┐
useChatController      FloatingWindow             SummaryTab / QATab
(gom delta 100ms)      (setState mỗi delta)       (setState mỗi delta, không có trace)
        │                    │
ChatMessage ─▶ DebugDetails  DebugDetails
```

**File đã đọc**:
- `entrypoints/background.ts` (handler port `ai-stream`)
- `src/core/devtools/{background-trace,trace-reducer,types,copy}.ts`
- `src/core/messaging/types.ts`
- `src/hooks/useAiStream.ts`
- `entrypoints/sidepanel/{App.tsx,hooks/useChatController.ts,components/ChatMessage.tsx,components/ChatComposer.tsx}`
- `src/components/devtools/DebugDetails.tsx`
- `src/components/floating-window/FloatingWindow.tsx`
- `entrypoints/reader/components/{SummaryTab,QATab,DefinitionPopover}.tsx`

---

## 2. Tóm tắt

| ID | Mức độ | Vấn đề | Nguồn |
|----|:------:|--------|-------|
| [DV1](#dv1) | 🔴 | Trace kẹt ở `pending` sau lỗi, hủy hoặc mất kết nối | **Đo được** |
| [DV2](#dv2) | 🟠 | Danh sách chat tự cuộn về đáy mỗi 100ms | Đọc code |
| [DV3](#dv3) | 🟠 | Ô reasoning không cuộn theo nội dung mới | Đọc code |
| [DV4](#dv4) | 🟡 | Thời gian và TTFT không cập nhật trong lúc chờ | Đọc code |
| [DV5](#dv5) | 🟡 | Pha thinking: bong bóng rỗng, chữ "đang trả lời…" sai | Đọc code |
| [DV6](#dv6) | 🟠 | Không còn nút hủy sau pha "đang kết nối" | Đọc code |
| [DV7](#dv7) | 🔴 | Sidepanel vẽ lại toàn bộ lịch sử mỗi 100ms | **Đo được** |
| [DV8](#dv8) | 🔴 | Cửa sổ nổi và reader render một lần cho mỗi delta | **Đo được** |
| [DV9](#dv9) | 🟡 | `aria-live` bọc khối reasoning; panel mở mãi không đóng | Đọc code |
| [DV10](#dv10) | 🟢 | Reader không có AI trace | Đọc code |
| [DV11](#dv11) | 🟢 | Cửa sổ nổi đoán dev mode dựa vào `toolTrace` | Đọc code |
| [DV12](#dv12) | 🟢 | `AI_STREAM_DONE` gửi lại toàn bộ reasoning | Đọc code |

**Triệu chứng người dùng thấy**: DV1 cộng DV7. Tin bị lỗi hoặc bị hủy hiện màu vàng
`pending` mãi, dấu `...` nhấp nháy mãi, và **số giây cứ tăng**. Lý do: `DebugDetails` lấy
`Date.now()` khi chưa có `finishedAt`, mà danh sách lại vẽ lại mỗi 100ms trong lúc stream
tin khác. Phần "chậm" đến từ DV7 và DV8, nặng nhất khi model trả về reasoning dài
(hàng nghìn delta).

---

## 3. Số đo

Đo bằng một test tạm (Vitest + jsdom, giả lập port qua `portEntries`, đếm commit bằng
`React.Profiler`). Test đã xóa sau khi đo. jsdom không có layout nên chỉ đo **số lần render**
và **trạng thái**, không đo thời gian tuyệt đối.

| Kịch bản | Kết quả |
|----------|---------|
| Sidepanel nhận `AI_STREAM_ERROR` có kèm `trace` (status `error`) | `debug.status = "pending"`, `finishedAt = undefined` |
| Sidepanel gọi `cancelStream()` giữa chừng | `debug.status = "pending"`, `finishedAt = undefined` |
| Sidepanel: một tin assistant **cũ, đã xong**, trong 2 giây stream tin kế tiếp | Bị render lại **23 lần** |
| Cửa sổ nổi nhận 400 delta | **401 commit** |

---

## 4. Lỗi hiển thị

### <a id="dv1"></a>🔴 [DV1] Trace kẹt ở `pending` sau lỗi, hủy hoặc mất kết nối

**Vị trí**:
- `entrypoints/sidepanel/hooks/useChatController.ts:184`: `onError: (message) =>` bỏ qua
  tham số thứ hai `trace`, dù background đã gửi trace có `status: "error"`.
- `useChatController.ts:189` (`onDisconnect`) và `:198` (`cancelStream`): không chốt trace.
  Khi port bị ngắt, background chỉ abort và **không gửi gì thêm**
  (`src/core/ai/client.ts:148`), nên UI phải tự chốt.
- `src/components/floating-window/FloatingWindow.tsx:180`: cửa sổ nổi xử lý `onError`
  đúng, nhưng `onDisconnect` cũng không chốt trace. Nếu port bị ngắt mà không có
  `chrome.runtime.lastError` (ví dụ service worker bị dừng) thì `streamState` cũng không
  rời khỏi `loading`/`streaming`.

**Hệ quả**: `DebugDetails` hiện status vàng, khối thinking hiện `...` nhấp nháy
(`DebugDetails.tsx:127`), thời gian tính bằng `Date.now()` (`DebugDetails.tsx:59`) nên cứ
tăng mỗi lần re-render.

**Fix đề xuất**: dùng trace background gửi về nếu có; nếu không thì tự chốt bằng
`failAiTrace` (đã có sẵn trong `src/core/devtools/trace-reducer.ts:42`).

```ts
// useChatController.ts
import { appendReasoning, applyDebugUpdate, failAiTrace } from "../../../src/core/devtools/trace-reducer";

// Cách kết thúc một lượt stream: trace background đã chốt, hoặc UI tự chốt
type TraceEnding =
  | { trace: AiDevTrace }
  | { error: string; status: "error" | "cancelled" | "interrupted" };

const stopFlushTimerAndFlush = (id: string | null, ending?: TraceEnding) => {
  // ... giữ nguyên phần dừng timer và lấy buffer ...
  setMessages((current) =>
    current.map((item) => {
      if (item.id !== id || item.kind !== "message") return item;
      const updated = { ...item };
      if (contentDelta) updated.content += contentDelta;
      if (ending && "trace" in ending) {
        updated.debug = ending.trace;
      } else if (updated.debug) {
        if (reasoningDelta) updated.debug = appendReasoning(updated.debug, reasoningDelta);
        if (ending && updated.debug.status === "pending") {
          updated.debug = failAiTrace(updated.debug, ending.error, Date.now(), ending.status);
        }
      }
      return updated;
    })
  );
};

// Trong useAiStream({...})
onDone: (finalTrace) => {
  stopFlushTimerAndFlush(activeAssistantIdRef.current, finalTrace ? { trace: finalTrace } : undefined);
  resetStreamState();
},
onError: (message, trace) => {
  stopFlushTimerAndFlush(activeAssistantIdRef.current, trace ? { trace } : { error: message, status: "error" });
  resetStreamState();
  setError(message);
},
onDisconnect: () => {
  const message = chrome.runtime.lastError?.message || "Mất kết nối.";
  stopFlushTimerAndFlush(activeAssistantIdRef.current, { error: message, status: "interrupted" });
  resetStreamState();
  if (chrome.runtime.lastError) setError(message);
},

function cancelStream() {
  stopAiStream();
  stopFlushTimerAndFlush(activeAssistantIdRef.current, { error: DEV_COPY.cancelledByUser, status: "cancelled" });
  resetStreamState();
}
```

```ts
// src/core/devtools/copy.ts: thêm chuỗi
cancelledByUser: "Người dùng đã hủy yêu cầu.",
```

```ts
// FloatingWindow.tsx: chốt trace và trạng thái khi port bị ngắt trước DONE/ERROR
onDisconnect: () => {
  if (isDoneRef.current) return;
  isDoneRef.current = true;
  const message = chrome.runtime.lastError?.message || "Mất kết nối.";
  setStreamState("error");
  setErrorMessage(message);
  setAiTrace((prev) =>
    prev?.status === "pending" ? failAiTrace(prev, message, Date.now(), "interrupted") : prev
  );
},
```

> `onDisconnect` của port chỉ chạy khi **phía bên kia** ngắt. Sau DONE/ERROR, `useAiStream`
> tự `disconnect()` nên callback này không bị gọi nhầm. Riêng sidepanel còn được chặn thêm
> vì `activeAssistantIdRef` đã về `null`.

**Test hồi quy** (`tests/use-chat-controller.test.tsx`, `tests/floating-window.test.tsx`):
- `AI_STREAM_ERROR` có `trace` thì `debug.status === "error"` và `finishedAt` có giá trị.
- `AI_STREAM_ERROR` không có `trace` nhưng tin đang có `debug` thì status `error`.
- `cancelStream()` cho ra status `cancelled`; `onDisconnect` cho ra status `interrupted`.
- Cửa sổ nổi: port ngắt trước DONE thì `streamState` thành `error` và trace thành `interrupted`.

---

### <a id="dv2"></a>🟠 [DV2] Danh sách chat tự cuộn về đáy mỗi 100ms

**Vị trí**: `entrypoints/sidepanel/App.tsx:82-84`

```tsx
useEffect(() => {
  chatEndRef.current?.scrollIntoView({ block: "end" });
}, [chat.messages, chat.streamingPhase]);
```

**Vấn đề**: `chat.messages` đổi sau mỗi lần flush (100ms), nên trong lúc stream người dùng
không thể cuộn lên đọc tin cũ hoặc mở panel DEV của tin cũ. Màn hình bị kéo xuống ngay.

**Fix đề xuất**: chỉ bám đáy khi người dùng đang ở gần đáy. Khi gửi tin mới thì luôn bám đáy.

Container cuộn thực tế là **document**. `main` dùng `min-h-screen` và `html, body, #root`
dùng `min-height: 100%` (`entrypoints/sidepanel/styles.css:7-13`), nên `section.overflow-auto`
không bị giới hạn chiều cao.

```tsx
// entrypoints/sidepanel/hooks/useStickToBottom.ts
import { useEffect, useRef } from "react";

// Theo dõi người dùng có đang ở gần cuối trang hay không
export function useStickToBottom(threshold = 80) {
  const stickRef = useRef(true);
  useEffect(() => {
    const handleScroll = () => {
      const el = document.scrollingElement ?? document.documentElement;
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);
  return stickRef;
}
```

```tsx
// App.tsx
const stickToBottomRef = useStickToBottom();

useEffect(() => {
  if (stickToBottomRef.current) {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }
}, [chat.messages, chat.streamingPhase]);

// Trong onSend / EmptyState / FORWARD_SELECTION_ACTION: luôn bám đáy khi gửi tin mới
stickToBottomRef.current = true;
```

**Test hồi quy** (`tests/sidepanel-app.test.tsx`): mock `scrollIntoView`; dùng
`Object.defineProperty` gán `scrollHeight`, `scrollTop`, `clientHeight` cho
`document.documentElement` để giả lập người dùng đã cuộn lên, phát sự kiện `scroll`, rồi
stream thêm delta. Kỳ vọng `scrollIntoView` không được gọi.

---

### <a id="dv3"></a>🟠 [DV3] Ô reasoning không cuộn theo nội dung mới

**Vị trí**: `src/components/devtools/DebugDetails.tsx:130`

```tsx
<pre className="max-h-60 overflow-y-auto ...">{trace.thinking.content}</pre>
```

**Vấn đề**: ô cao tối đa 240px và vị trí cuộn bên trong luôn đứng ở đầu. Người dùng chỉ
thấy đoạn reasoning đầu tiên nên tưởng stream bị treo.

**Fix đề xuất**: cùng nguyên tắc với DV2, áp dụng cho chính thẻ `<pre>`.

```tsx
const thinkingRef = useRef<HTMLPreElement>(null);
const thinkingStickRef = useRef(true);

// Chạy trước khi trình duyệt vẽ để không bị nháy
useLayoutEffect(() => {
  const el = thinkingRef.current;
  if (el && isStreamingReasoning && thinkingStickRef.current) {
    el.scrollTop = el.scrollHeight;
  }
}, [trace.thinking.content, isStreamingReasoning]);

<pre
  ref={thinkingRef}
  onScroll={(e) => {
    const el = e.currentTarget;
    thinkingStickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }}
  className="max-h-60 overflow-y-auto ..."
>
```

**Test hồi quy** (`tests/devtools/debug-details.test.tsx`): gán `scrollHeight` cho `<pre>`,
rerender với `thinking.content` dài hơn, kỳ vọng `scrollTop === scrollHeight`. Sau khi người
dùng cuộn lên (phát `scroll` với `scrollTop` nhỏ) thì rerender không đổi `scrollTop`.

---

### <a id="dv4"></a>🟡 [DV4] Thời gian và TTFT không cập nhật trong lúc chờ

**Vị trí**:
- `src/core/devtools/background-trace.ts:74`: `onFirstToken` chỉ ghi `firstTokenAt` vào trace
  nội bộ của background, không gửi xuống UI. UI chỉ biết TTFT khi nhận `AI_STREAM_DONE`.
- `entrypoints/background.ts:203-209`: `AI_STREAM_FIRST_TOKEN` không kèm thời điểm.
- `DebugDetails.tsx:46-69`: dòng tóm tắt không có timer. Trong pha connecting/thinking
  (chưa có delta nào làm re-render) nó đứng ở `0.0 s`, sau đó nhảy cóc.

**Fix đề xuất**:

```ts
// src/core/messaging/types.ts
| { type: "AI_STREAM_FIRST_TOKEN"; requestId: string; at?: number }

// src/core/devtools/background-trace.ts: trả về thời điểm để background gửi kèm
onFirstToken: (): number => {
  trace = markFirstToken(trace, input.now());
  return trace.firstTokenAt!;
},

// entrypoints/background.ts
onFirstToken: () => {
  const at = emitter?.onFirstToken();
  send({ type: "AI_STREAM_FIRST_TOKEN", requestId: message.requestId, ...(at ? { at } : {}) });
},

// src/hooks/useAiStream.ts
onFirstToken?: (at?: number) => void;
// ...
case "AI_STREAM_FIRST_TOKEN":
  current.onFirstToken?.(message.at);
  break;

// useChatController.ts / FloatingWindow.tsx: ghi vào trace đang hiển thị
onFirstToken: (at) => {
  if (at) updateActiveDebug((debug) => markFirstToken(debug, at));
},
```

```tsx
// DebugDetails.tsx: tick mỗi giây, chỉ khi trace còn pending
const [, forceTick] = useReducer((n: number) => n + 1, 0);
useEffect(() => {
  if (trace.status !== "pending") return;
  const timer = setInterval(forceTick, 1000);
  return () => clearInterval(timer);
}, [trace.status]);
```

> ⚠️ Phải sửa **DV1 trước**. Nếu chưa sửa, mọi trace kẹt `pending` sẽ giữ một interval
> chạy mãi.

**Test hồi quy**:
- `tests/background-dev-trace.test.ts`: `AI_STREAM_FIRST_TOKEN` có `at >= startedAt`.
- `tests/devtools/debug-details.test.tsx` (fake timers): trace `pending` thì sau 1 giây
  dòng tóm tắt đổi số giây. Trace `success` thì không đặt interval.

---

### <a id="dv5"></a>🟡 [DV5] Pha thinking: bong bóng rỗng, chữ "đang trả lời…" sai

**Vị trí**:
- `entrypoints/sidepanel/components/ChatMessage.tsx:83-111`: luôn vẽ bong bóng và nút
  "Sao chép / Lưu kết quả", kể cả khi `content === ""`.
- `App.tsx:185-190`: `TypingIndicator` hiện thêm bên dưới, nên có hai avatar.
- `useChatController.ts:148`: `onFirstToken` đặt phase `streaming`. `onFirstToken` lại được
  kích hoạt bởi cả reasoning (`src/core/ai/client.ts:107`), nên khi model còn đang suy nghĩ
  UI đã ghi "đang trả lời…". Khi **tắt** dev mode, background không gửi `AI_STREAM_REASONING`
  (`background.ts:216-218`), nên UI không có cách nào biết model đang suy nghĩ.

**Fix đề xuất**:

1. Background báo loại token đầu tiên:
   ```ts
   // client.ts: StreamCallbacks
   onFirstToken?: (kind: "reasoning" | "text") => void;
   // messaging/types.ts
   | { type: "AI_STREAM_FIRST_TOKEN"; requestId: string; at?: number; kind?: "reasoning" | "text" }
   ```
   Khi `kind === "reasoning"`, UI chuyển sang phase `thinking`. Delta text luôn đến qua
   `AI_STREAM_CHUNK` (kể cả khi tắt dev mode), nên `onChunk` đủ để chuyển sang `streaming`.
2. `StreamingPhase = "idle" | "connecting" | "thinking" | "streaming"`.
3. Vẽ chỉ báo **bên trong** `ChatMessage` thay cho bong bóng rỗng, bỏ khối
   `TypingIndicator` riêng ở `App.tsx:185-190`:
   ```tsx
   // App.tsx: chỉ tin cuối, đang stream, chưa có nội dung
   const isPending = chat.streaming && index === chat.messages.length - 1 && !item.content;
   <ChatMessage ... pendingPhase={isPending ? chat.streamingPhase : undefined} />

   // ChatMessage.tsx
   const hasContent = props.content.length > 0;
   if (!isUser && !hasContent && !props.pendingPhase && !props.debug) return null;
   // bong bóng: hasContent ? <MessageContent/> : <TypingDots phase={props.pendingPhase}/>
   // nút Sao chép / Lưu: chỉ khi hasContent
   ```
4. Chữ: `connecting` → "đang kết nối…", `thinking` → "đang suy nghĩ…",
   `streaming` → "đang trả lời…".

**Test hồi quy** (`tests/chat-message.test.tsx`): `content=""` và `pendingPhase="thinking"`
thì hiện "đang suy nghĩ…", không có nút "Sao chép". `content=""` và không pending, không
debug thì không render gì.

---

### <a id="dv6"></a>🟠 [DV6] Không còn nút hủy sau pha "đang kết nối"

**Vị trí**:
- `App.tsx:191`: nút "Hủy yêu cầu" chỉ hiện khi `chat.streamingPhase === "connecting"`.
- `App.tsx:205-210`: `ChatComposer` bị `disabled` trong lúc stream, và `sending` chỉ đổi
  icon thành spinner. Không có nút dừng.

**Vấn đề**: khi model đã bắt đầu suy nghĩ hoặc trả lời, người dùng không dừng được. Với
mức thinking `high`/`max`, pha suy nghĩ có thể kéo dài vài phút mà vẫn bị tính token.

**Fix đề xuất**: hiện nút dừng trong mọi phase khi `chat.streaming`. Có hai cách:
- Đổi điều kiện ở `App.tsx:191` thành `chat.streaming`, đổi chữ thành "Dừng" khi phase khác
  `connecting`.
- Hoặc biến nút gửi trong `ChatComposer` thành nút dừng khi `sending` (thêm prop `onStop`).
  Cách này quen thuộc hơn với người dùng các ứng dụng chat.

Sau khi dừng, trace phải có status `cancelled` (đã xử lý trong DV1).

**Test hồi quy** (`tests/sidepanel-app.test.tsx`): sau `AI_STREAM_FIRST_TOKEN` vẫn có nút
dừng. Bấm nút thì port bị `disconnect` và trace thành `cancelled`.

---

## 5. Hiệu năng

### <a id="dv7"></a>🔴 [DV7] Sidepanel vẽ lại toàn bộ lịch sử mỗi 100ms

**Số đo**: một tin cũ đã xong bị render lại 23 lần trong 2 giây stream tin kế tiếp.
Có N tin thì chi phí nhân N, cộng thêm chi phí parse markdown của `MessageContent` cho từng
tin.

**Vị trí**:
- `entrypoints/sidepanel/components/ChatMessage.tsx:20`: không bọc `React.memo`.
- `App.tsx:179`: `onSave={() => saveMessage(item)}` tạo hàm mới mỗi render.
- `App.tsx:180`: `onActionError={chat.setError}`. `setError` là function khai báo thường
  trong `useChatController.ts:68`, nên đổi reference mỗi render.
- `useChatController.ts:266`: `dismissError: () => setError("")` cũng tạo mới mỗi render.

Khi flush, `setMessages` giữ nguyên object của các tin không đổi (`current.map` trả về
`item` cũ), nên chỉ cần callback ổn định thì `memo` có tác dụng ngay.

**Fix đề xuất**:

```tsx
// ChatMessage.tsx
export const ChatMessage = memo(function ChatMessage(props: {
  role: "user" | "assistant" | "system";
  content: string;
  debug?: AiDevTrace;
  onSave?: (content: string) => void | Promise<void>;
  onActionError?: (message: string) => void;
}) {
  // ...
  await props.onSave(props.content);
  // ...
});
```

```tsx
// App.tsx: saveMessage chỉ cần content và dùng setter ổn định
const saveMessage = useCallback(async (content: string) => {
  const newResult: SavedResult = {
    id: crypto.randomUUID(),
    title: content.slice(0, 60) || "Phản hồi đã lưu",
    sourceType: "chat" as const,
    outputMarkdown: content,
    createdAt: new Date().toISOString()
  };
  // ... giữ nguyên phần setSavedResultsState / setStorageError
}, []);

<ChatMessage
  key={item.id}
  role={item.role}
  content={item.content}
  debug={item.debug}
  onSave={item.role === "assistant" ? saveMessage : undefined}
  onActionError={chat.setError}
/>
```

```ts
// useChatController.ts
const setError = useCallback((message: string) => {
  setErrorState(message);
  if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  if (message && autoDismissErrorMs > 0) {
    errorTimerRef.current = setTimeout(() => setErrorState(""), autoDismissErrorMs);
  }
}, [autoDismissErrorMs]);
const dismissError = useCallback(() => setError(""), [setError]);
```

Nên làm thêm mục C5 trong `COMPONENTS_REVIEW.md`: `useMemo` kết quả parse trong
`MessageContent`, để chính tin đang stream không phải parse lại khi chỉ trace thay đổi.

**Test hồi quy**: chuyển kịch bản đo thành test. Bọc từng `ChatMessage` trong
`React.Profiler`, stream tin thứ hai trong 2 giây (fake timers), kỳ vọng tin thứ nhất có
**0** commit.

---

### <a id="dv8"></a>🔴 [DV8] Cửa sổ nổi và reader render một lần cho mỗi delta

**Số đo**: 400 delta thì 401 commit.

**Vị trí**:
- `src/components/floating-window/FloatingWindow.tsx:157-159`: `onChunk` gọi
  `setResponseContent` cho từng delta.
- `FloatingWindow.tsx:162`: `onReasoning` gọi `setAiTrace(appendReasoning(...))` cho từng
  delta. Mỗi lần nối chuỗi reasoning tạo object trace mới, nên `DebugDetails` vẽ lại cả khối
  `<pre>`.
- `entrypoints/reader/components/SummaryTab.tsx:36` và `QATab.tsx:42`: cùng mẫu
  `setState` mỗi delta.

**Vì sao nặng**: mỗi commit parse lại **toàn bộ** nội dung (`FloatingChatMessage`), nên tổng
chi phí tăng theo bình phương độ dài. Cửa sổ nổi lại chạy **ngay trong trang web người dùng
đang mở**, tranh main thread với trang. Model có reasoning thường gửi hàng nghìn delta nhỏ.

**Fix đề xuất**: đưa cơ chế gom delta vào `useAiStream` thành một tùy chọn, để mọi nơi dùng
chung thay vì mỗi consumer tự viết buffer.

```ts
// src/hooks/useAiStream.ts
export type AiStreamOptions = {
  // Gom CHUNK/REASONING rồi gọi onChunk/onReasoning tối đa một lần mỗi flushMs (0 = gọi ngay)
  flushMs?: number;
};

export function useAiStream(handlers: AiStreamHandlers, options: AiStreamOptions = {}) {
  const flushMs = options.flushMs ?? 0;
  const pendingRef = useRef({ chunk: "", reasoning: "" });
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đẩy phần đang gom ra handler; reasoning luôn đi trước text
  const flush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const { chunk, reasoning } = pendingRef.current;
    pendingRef.current = { chunk: "", reasoning: "" };
    if (reasoning) handlersRef.current.onReasoning?.(reasoning);
    if (chunk) handlersRef.current.onChunk?.(chunk);
  }, []);

  function enqueue(kind: "chunk" | "reasoning", delta: string) {
    if (flushMs <= 0) {
      pendingRef.current[kind] += delta;
      flush();
      return;
    }
    pendingRef.current[kind] += delta;
    flushTimerRef.current ??= setTimeout(flush, flushMs);
  }

  // Trong port.onMessage:
  //   AI_STREAM_CHUNK      → enqueue("chunk", message.delta)
  //   AI_STREAM_REASONING  → enqueue("reasoning", message.delta)
  //   mọi loại khác        → flush() TRƯỚC rồi mới gọi handler, để giữ đúng thứ tự
  //                          (DONE phải đến sau delta cuối cùng)
  // stop():                flush() rồi mới disconnect
  // unmount:               chỉ clearTimeout, không gọi handler
}
```

Áp dụng:
- `FloatingWindow.tsx`, `SummaryTab.tsx`, `QATab.tsx`:
  `useAiStream({...}, { flushMs: CHAT_SETTINGS.STREAM_FLUSH_MS })`.
- `useChatController.ts` có thể bỏ bộ buffer riêng (`contentBufferRef`,
  `reasoningBufferRef`, `startFlushTimer`, `stopFlushTimerAndFlush`) và dùng tùy chọn này.
  Nên làm ở bước sau, khi DV1 đã có test bảo vệ.

**Kỳ vọng**: 400 delta trong khoảng 2 giây giảm từ khoảng 400 commit xuống khoảng 20.

**Test hồi quy**:
- `tests/floating-window.test.tsx` (fake timers): 400 delta thì số commit ≤ 25 và nội dung
  cuối cùng đầy đủ.
- DONE đến khi buffer còn dữ liệu: nội dung vẫn đủ và `streamState === "done"`.
- `flushMs = 0` giữ nguyên hành vi cũ (các test hiện có không phải sửa).

---

### <a id="dv9"></a>🟡 [DV9] `aria-live` bọc khối reasoning; panel mở mãi không đóng

**Vị trí**:
- `DebugDetails.tsx:75`: `aria-live="polite"` đặt trên **cả** `<section>`. `aria-relevant`
  mặc định là `additions text`, nên mỗi lần reasoning được nối thêm (100ms ở sidepanel, mỗi
  delta ở cửa sổ nổi) đều là một thay đổi của vùng live. Trình đọc màn hình bị spam, và trình
  duyệt phải tính lại cây accessibility cho khối chữ lớn.
- `DebugDetails.tsx:18-24`: tự mở khi reasoning bắt đầu nhưng không bao giờ tự đóng. Mọi tin
  có reasoning trong phiên đều giữ khối `<pre>` lớn trong DOM.

**Fix đề xuất**:

```tsx
// Bỏ aria-live khỏi section; chỉ thông báo khi status đổi
<section role="region" aria-label="AI dev trace" className="...">
  <span className="sr-only" aria-live="polite">{trace.status === "pending" ? "" : trace.status}</span>
  ...
</section>
```

```tsx
// Tự đóng khi xong, nhưng chỉ khi panel do hệ thống tự mở (người dùng chưa bấm)
const autoExpandedRef = useRef(false);
useEffect(() => {
  const wasStreaming = prevStreamingRef.current;
  prevStreamingRef.current = isStreamingReasoning;
  if (!wasStreaming && isStreamingReasoning) {
    autoExpandedRef.current = true;
    setExpanded(true);
  } else if (wasStreaming && !isStreamingReasoning && autoExpandedRef.current) {
    autoExpandedRef.current = false;
    setExpanded(false);
  }
}, [isStreamingReasoning]);

// onClick của nút toggle
onClick={() => {
  autoExpandedRef.current = false; // người dùng đã tự chọn thì không tự đóng nữa
  setExpanded(!expanded);
}}
```

> **Đã chốt (2026-10-15)**: panel **tự đóng khi trace kết thúc**, áp dụng cho mọi trạng thái
> kết thúc (success, error, cancelled, interrupted). Panel chỉ tự đóng nếu do hệ thống tự mở:
> người dùng đã bấm mở hoặc đóng thì giữ nguyên lựa chọn của họ.
> Đoạn code trên đã xử lý đủ. `isStreamingReasoning` chuyển sang `false` khi status rời
> `pending`, bất kể trạng thái kết thúc là gì. Trace không có reasoning thì panel không tự mở,
> nên cũng không cần đóng.

Chỗ khác cũng nên xem: `App.tsx:165` đặt `aria-live="polite" aria-relevant="additions"` trên
cả danh sách chat. Khi `MessageContent` parse thêm đoạn mới, mỗi node mới đều được đọc lên.

**Test hồi quy** (`tests/devtools/debug-details.test.tsx`): `section` không có `aria-live`.
Chuyển từ `pending` sang `success` thì panel tự đóng nếu người dùng chưa bấm, và vẫn mở nếu
người dùng đã bấm.

---

## 6. Thiếu sót thiết kế (tùy chọn)

### <a id="dv10"></a>🟢 [DV10] Reader không có AI trace

- `SummaryTab.tsx` và `QATab.tsx` gọi `start({ requestId, sessionId, messages })` mà không có
  `devContext`, nên background không tạo trace. Các feature `reader-summary`, `reader-qa`,
  `reader-definition` khai báo ở `src/core/devtools/types.ts:7-9` nhưng chưa nơi nào dùng.
- `DefinitionPopover.tsx:46` gọi thẳng `fetchCompletion` trong trang reader, không qua port,
  nên không có trace và không dùng chung timeout/xử lý lỗi của background.

**Đề xuất**: reader đọc `settings.devMode` (giống `DefinitionPopover.tsx:37` đang gọi
`getSettings()`), truyền `devContext: { surface: "reader", feature: "reader-summary" | "reader-qa" }`
và render `DebugDetails` bên dưới kết quả. `DefinitionPopover` có thể giữ nguyên nếu không cần
trace cho tính năng tra nghĩa.

### <a id="dv11"></a>🟢 [DV11] Cửa sổ nổi đoán dev mode dựa vào `toolTrace`

**Vị trí**: `FloatingWindow.tsx:194`: `const isDevModeActive = Boolean(toolTraceRef.current);`

Đây là coupling ngầm. Nếu sau này `toolTrace` được gửi cả khi tắt dev mode, hoặc dev mode bật
mà không có tool trace, thì cửa sổ nổi bật/tắt trace sai mà không ai để ý.

**Đề xuất**: thêm `devMode?: boolean` vào options của `src/scripts/floating-mount.ts:17` và
props `FloatingWindow`, truyền từ nơi đã biết settings (`entrypoints/active-tab-agent.ts:207`).

### <a id="dv12"></a>🟢 [DV12] `AI_STREAM_DONE` gửi lại toàn bộ reasoning

`background-trace.ts:93-96` trả về trace đầy đủ, gồm `thinking.content` đã stream xong. Vì
vậy DONE gửi lại toàn bộ reasoning một lần nữa. UI thay `debug` bằng object mới nên
`DebugDetails` vẽ lại cả khối `<pre>`.

**Đề xuất** (ưu tiên thấp): DONE và ERROR gửi trace không kèm `thinking.content`; UI giữ phần
reasoning đã nhận qua delta và chỉ merge các trường còn lại. Port giữ đúng thứ tự message nên
không lo mất reasoning.

---

## 7. Liên hệ với `COMPONENTS_REVIEW.md`

| Mục cũ | Tình trạng hiện tại | Liên quan |
|--------|---------------------|-----------|
| D3: thêm ARIA cho dev panel | Đã áp dụng, **kể cả `aria-live` trên cả section**, gây ra DV9 | Sửa lại theo DV9 |
| D4: auto-expand chỉ lần đầu | Đã áp dụng phần "chỉ mở lần đầu"; chưa có tự đóng | DV9 |
| D5: ticker 1 giây cho elapsed | Chưa áp dụng | DV4 (làm sau DV1) |
| C5: `useMemo` trong `MessageContent` | Chưa áp dụng | DV7, DV8 |
| F8: fallback khi nội dung rỗng | Đã áp dụng cho cửa sổ nổi; sidepanel chưa có | DV5 |

---

## 8. Thứ tự triển khai đề xuất

**Đợt 1: sửa lỗi (mỗi mục là thay đổi nhỏ, có test riêng)**
1. DV1: chốt trace khi lỗi, hủy, mất kết nối (sidepanel và cửa sổ nổi).
2. DV6: nút dừng trong mọi phase.
3. DV2, DV3: chỉ tự cuộn khi đang ở gần đáy.
4. DV4: gửi `at` cùng FIRST_TOKEN, thêm ticker (sau DV1).
5. DV5: phase `thinking`, ẩn bong bóng rỗng.

**Đợt 2: hiệu năng**
6. DV7: `memo` cho `ChatMessage` và callback ổn định.
7. DV8: tùy chọn `flushMs` trong `useAiStream`, áp dụng cho cửa sổ nổi và reader.
8. DV9: bỏ `aria-live` khỏi panel, tự đóng panel khi trace kết thúc.

**Đợt 3: tùy chọn**
9. DV10, DV11, DV12.

Mỗi đợt nên là một commit hoặc PR riêng, title theo dạng
`[devtools] Finalize trace on error and cancel`. Không nên gộp chung với phần migrate AI SDK
đang nằm trên cùng nhánh.

---

## 9. Lệnh kiểm tra sau khi sửa

```sh
npm run compile
npm test
npm test -- tests/use-chat-controller.test.tsx tests/floating-window.test.tsx tests/devtools/debug-details.test.tsx tests/chat-message.test.tsx tests/sidepanel-app.test.tsx tests/background-dev-trace.test.ts
npm run build
```

Kiểm tra thủ công trên Chrome (bật Dev Mode, chọn model có reasoning, mức thinking `high`):
- Bấm dừng giữa lúc đang suy nghĩ: trace thành `cancelled`, thời gian đứng yên.
- Cuộn lên đọc tin cũ trong lúc stream: màn hình không bị kéo xuống.
- Ô reasoning chạy theo nội dung mới. Cuộn lên trong ô thì ô không bị kéo xuống.
- Cửa sổ nổi với câu trả lời dài: trang web bên dưới không bị giật khi cuộn.
