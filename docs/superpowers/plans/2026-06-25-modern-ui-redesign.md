# Modern UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Personal AI Sidebar with a warm, friendly UI (violet/amber palette, stone tones, bubble chat, skeleton loading, proper animations).

**Architecture:** Extend Tailwind config with warm palette + animation keyframes. Refactor each UI component independently — bubble chat for messages, floating send button, glassmorphism header, card-based settings/prompts/saved, redesigned selection toolbar. Pure CSS animations (no library). No logic changes to AI streaming, storage, or messaging.

**Tech Stack:** React 19, Tailwind CSS 3, TypeScript, WXT, Vitest + Testing Library

## Global Constraints

- All colors must use the approved palette (violet primary `#7C3AED`, warm-bg `#1C1917`, surface `#292524`, stone tones replacing zinc)
- No new dependencies (animation via CSS keyframes only, no framer-motion/GSAP)
- All component tests must pass after changes
- UI labels remain in Vietnamese
- Side panel max-width unchanged (~400px)
- Selection toolbar uses inline styles (runs outside React, in page context)

---

### Task 1: Tailwind Config + Global CSS Animations

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `entrypoints/sidepanel/styles.css`
- Test: `tests/sidepanel-app.test.tsx` (sanity check — app still renders)

**Interfaces:**
- Consumes: existing Tailwind setup
- Produces: `tailwind.config.ts` with extended colors + animation utilities usable by all components

**Design notes:**
- Warm palette: use `stone` instead of `zinc`, add custom `primary`/`surface`/`warm-bg` colors
- Re-maps zinc utility classes across all components are handled in their respective tasks — this task only adds the tokens
- Animation keyframes: `bounce-dot`, `slide-in-right`, `fade-in-up`, `spinner`, `skeleton-shimmer`

- [ ] **Step 1: Read current files**

- [ ] **Step 2: Update tailwind.config.ts with palette + animations**

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./entrypoints/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#7C3AED", light: "#A78BFA" },
        "warm-bg": "#1C1917",
        surface: { DEFAULT: "#292524", hover: "#3C3833" },
        border: "#44403C",
        secondary: "#A8A29E",
      },
      keyframes: {
        "bounce-dot": {
          "0%, 80%, 100%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-6px)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "spinner": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "bounce-dot": "bounce-dot 1.4s infinite",
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.3s ease-out",
        "spinner": "spinner 0.8s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Add spinner SVG component path to styles.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
}
```

No changes needed — spinner is rendered as an SVG element (inline JSX), not a CSS class.

- [ ] **Step 4: Run existing test to confirm no breakage**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts entrypoints/sidepanel/styles.css
git commit -m "feat(ui): add warm palette and animation keyframes to tailwind config"
```

---

### Task 2: HeaderBar — Icon Navigation + Glassmorphism

**Files:**
- Modify: `entrypoints/sidepanel/components/HeaderBar.tsx`
- Test: create `tests/header-bar.test.tsx`

**Interfaces:**
- Consumes: `HeaderView` type, `readingPage` boolean, `onReadPage` callback
- Produces: same props interface, redesigned DOM output

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { HeaderBar } from "../entrypoints/sidepanel/components/HeaderBar";

test("renders brand name and all navigation tabs", () => {
  render(<HeaderBar view="chat" onViewChange={() => {}} onReadPage={() => {}} readingPage={false} />);

  expect(screen.getByText("AI Cá Nhân")).toBeInTheDocument();
  expect(screen.getByTitle("Đọc trang")).toBeInTheDocument();
  expect(screen.getByTitle("Mẫu lệnh")).toBeInTheDocument();
  expect(screen.getByTitle("Đã lưu")).toBeInTheDocument();
  expect(screen.getByTitle("Cài đặt")).toBeInTheDocument();
});

test("active tab has primary color and underline", () => {
  render(<HeaderBar view="settings" onViewChange={() => {}} onReadPage={() => {}} />);

  const settingsBtn = screen.getByTitle("Cài đặt");
  expect(settingsBtn.className).toContain("text-primary");
});

test("read page button shows spinner when reading", () => {
  const { container } = render(<HeaderBar view="chat" onViewChange={() => {}} onReadPage={() => {}} readingPage={true} />);

  expect(container.querySelector(".animate-spinner")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/header-bar.test.tsx`
Expected: FAIL — components not found

- [ ] **Step 3: Implement HeaderBar**

```tsx
export type HeaderView = "chat" | "prompts" | "saved" | "settings";

function RobotIcon() {
  return (
    <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <circle cx="9" cy="13" r="1.5" fill="currentColor" />
      <circle cx="15" cy="13" r="1.5" fill="currentColor" />
      <path d="M12 3v3" strokeLinecap="round" />
      <path d="M8 3l2 2" strokeLinecap="round" />
      <path d="M16 3l-2 2" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spinner" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function HeaderBar(props: {
  view: HeaderView;
  onViewChange: (view: HeaderView) => void;
  onReadPage: () => void;
  readingPage?: boolean;
}) {
  const tabs: { view: HeaderView; title: string; icon: string }[] = [
    { view: "prompts", title: "Mẫu lệnh", icon: "📋" },
    { view: "saved", title: "Đã lưu", icon: "💾" },
    { view: "settings", title: "Cài đặt", icon: "⚙️" },
  ];

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-800 bg-warm-bg/80 px-3 py-2 backdrop-blur-sm">
      <button className="flex items-center gap-1.5 text-sm font-semibold text-stone-50 hover:text-primary-light transition-colors" onClick={() => props.onViewChange("chat")}>
        <RobotIcon />
        AI Cá Nhân
      </button>
      <div className="flex items-center gap-0.5">
        <button
          className="flex items-center justify-center rounded-lg px-2 py-1.5 text-xs text-stone-50 hover:bg-surface-hover transition-colors disabled:opacity-50"
          title="Đọc trang"
          onClick={props.onReadPage}
          disabled={props.readingPage}
        >
          {props.readingPage ? <Spinner /> : <span className="mr-1">📄</span>}
          <span className="hidden sm:inline">{props.readingPage ? "Đang đọc..." : "Đọc trang"}</span>
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.view}
            className={`flex items-center justify-center rounded-lg px-2 py-1.5 text-xs transition-colors ${
              props.view === tab.view
                ? "text-primary shadow-[inset_0_-2px_0_theme(colors.primary.DEFAULT)]"
                : "text-stone-400 hover:text-stone-50 hover:bg-surface-hover"
            }`}
            title={tab.title}
            onClick={() => props.onViewChange(tab.view)}
          >
            {tab.icon}
          </button>
        ))}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/header-bar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/components/HeaderBar.tsx tests/header-bar.test.tsx
git commit -m "feat(ui): redesign header with icon nav and glassmorphism"
```

---

### Task 3: ChatMessage — Bubble Layout + Typing Indicator

**Files:**
- Modify: `entrypoints/sidepanel/components/ChatMessage.tsx`
- Test: create `tests/chat-message.test.tsx`

**Interfaces:**
- Consumes: `role`, `content`, `onSave?` props
- Produces: bubble layout (user right / AI left), typing indicator component, save button

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "../entrypoints/sidepanel/components/ChatMessage";

test("renders user message right-aligned with primary bg", () => {
  const { container } = render(<ChatMessage role="user" content="Hello" />);
  const msg = container.querySelector(".rounded-2xl");
  expect(msg).toBeInTheDocument();
  expect(msg!.className).toContain("bg-primary");
});

test("renders AI message left-aligned with avatar", () => {
  render(<ChatMessage role="assistant" content="Hi there" />);
  expect(screen.getByText("Hi there")).toBeInTheDocument();
});

test("shows save button for assistant messages", () => {
  render(<ChatMessage role="assistant" content="Response" onSave={() => {}} />);
  expect(screen.getByTitle("Lưu")).toBeInTheDocument();
});

test("hides save button for user messages", () => {
  render(<ChatMessage role="user" content="Hello" onSave={() => {}} />);
  expect(screen.queryByTitle("Lưu")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/chat-message.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement ChatMessage**

```tsx
function RobotAvatar() {
  return (
    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface border border-stone-700">
      <svg className="h-3.5 w-3.5 text-primary-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <circle cx="9" cy="13" r="1.5" fill="currentColor" />
        <circle cx="15" cy="13" r="1.5" fill="currentColor" />
        <path d="M12 3v3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function ChatMessage(props: {
  role: "user" | "assistant" | "system";
  content: string;
  onSave?: () => void;
}) {
  const isUser = props.role === "user";

  return (
    <div className={`flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up`}>
      {!isUser && <RobotAvatar />}
      <div className={`max-w-[85%] ${isUser ? "max-w-[80%]" : ""}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-primary text-white rounded-br-md"
              : "bg-surface border border-stone-700/50 text-stone-50 rounded-bl-md"
          }`}
        >
          {props.content}
        </div>
        {!isUser && props.onSave && (
          <button
            className="mt-1 flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-stone-500 hover:text-stone-300 hover:bg-surface-hover transition-colors"
            title="Lưu"
            onClick={props.onSave}
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Lưu
          </button>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <RobotAvatar />
      <div className="rounded-2xl rounded-bl-md bg-surface border border-stone-700/50 px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0s" }} />
          <div className="h-2 w-2 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0.2s" }} />
          <div className="h-2 w-2 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0.4s" }} />
        </div>
        <div className="mt-1 text-[11px] text-stone-500">đang trả lời...</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/chat-message.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/components/ChatMessage.tsx tests/chat-message.test.tsx
git commit -m "feat(ui): redesign chat bubbles with avatar and typing indicator"
```

---

### Task 4: ChatComposer — Floating Send Button + Banner

**Files:**
- Modify: `entrypoints/sidepanel/components/ChatComposer.tsx`
- Test: create `tests/chat-composer.test.tsx`

**Interfaces:**
- Consumes: `disabled`, `onSend` props
- Produces: redesigned composer with floating send button, spinner on send, missing key banner

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatComposer } from "../entrypoints/sidepanel/components/ChatComposer";

test("renders textarea and send button", () => {
  render(<ChatComposer disabled={false} onSend={() => {}} />);
  expect(screen.getByPlaceholderText("Hỏi về công việc của bạn...")).toBeInTheDocument();
});

test("send button disabled when disabled prop is true", () => {
  render(<ChatComposer disabled={true} onSend={() => {}} />);
  expect(screen.getByTitle("Gửi")).toBeDisabled();
});

test("calls onSend with textarea content on submit", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  render(<ChatComposer disabled={false} onSend={onSend} />);

  const textarea = screen.getByPlaceholderText("Hỏi về công việc của bạn...");
  await user.type(textarea, "Hello");

  const button = screen.getByTitle("Gửi");
  await user.click(button);

  expect(onSend).toHaveBeenCalledWith("Hello");
});

test("missing key banner visible when showMissingKeyBanner is true", () => {
  render(<ChatComposer disabled={true} onSend={() => {}} showMissingKeyBanner={true} />);
  expect(screen.getByText(/Thêm khóa API/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/chat-composer.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement ChatComposer**

```tsx
import { useState } from "react";

function SendArrow() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SendSpinner() {
  return (
    <svg className="h-5 w-5 animate-spinner" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ChatComposer(props: {
  disabled: boolean;
  onSend: (text: string) => void;
  showMissingKeyBanner?: boolean;
  missingType?: "key" | "model";
  providerLabel?: string;
  sending?: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="sticky bottom-0 bg-gradient-to-t from-warm-bg via-warm-bg/95 to-transparent pt-4 pb-3 px-3">
      {props.showMissingKeyBanner && (
        <div className="mb-2 rounded-lg border border-amber-800/50 bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
          {props.missingType === "key"
            ? `Thêm khóa API cho ${props.providerLabel || "nhà cung cấp"} trong Cài đặt trước khi gửi.`
            : `Chọn mô hình cho ${props.providerLabel || "nhà cung cấp"} trong Cài đặt trước khi gửi.`}
        </div>
      )}
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          const text = value.trim();
          if (!text || props.disabled) return;
          props.onSend(text);
          setValue("");
        }}
      >
        <textarea
          className="min-h-[44px] max-h-24 w-full resize-none rounded-lg border border-stone-700 bg-surface p-3 pr-12 text-sm text-stone-50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
          value={value}
          disabled={props.disabled}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Hỏi về công việc của bạn..."
          rows={1}
        />
        <button
          className="absolute bottom-[6px] right-[6px] flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          type="submit"
          disabled={props.disabled || !value.trim()}
          title="Gửi"
        >
          {props.sending ? <SendSpinner /> : <SendArrow />}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/chat-composer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/components/ChatComposer.tsx tests/chat-composer.test.tsx
git commit -m "feat(ui): redesign composer with floating send button and missing key banner"
```

---

### Task 5: App.tsx — Skeleton, Empty State, Error Auto-Dismiss, Component Wires

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`
- Modify: `tests/sidepanel-app.test.tsx`
- Create: `tests/skeleton.test.tsx`

**Interfaces:**
- Consumes: all redesigned components, existing settings/prompts/saved storage
- Produces: integrated app with skeleton loading, empty state with chips, auto-dismiss errors, TypingIndicator during streaming

- [ ] **Step 1: Create Skeleton component + test**

Create `entrypoints/sidepanel/components/Skeleton.tsx`:

```tsx
export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={`h-16 w-full rounded-xl bg-surface animate-pulse ${className}`} />
  );
}

export function SkeletonPanel() {
  return (
    <div className="flex flex-col gap-3 p-3">
      <SkeletonRow />
      <SkeletonRow className="w-[85%]" />
      <SkeletonRow className="w-[70%]" />
      <SkeletonRow className="w-[90%]" />
    </div>
  );
}
```

Create `tests/skeleton.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { SkeletonPanel } from "../entrypoints/sidepanel/components/Skeleton";

test("renders skeleton rows", () => {
  const { container } = render(<SkeletonPanel />);
  expect(container.querySelectorAll(".animate-pulse").length).toBe(4);
});
```

- [ ] **Step 2: Create EmptyState component**

Create `entrypoints/sidepanel/components/EmptyState.tsx`:

```tsx
export function EmptyState(props: { onChipClick?: (text: string) => void }) {
  const chips = [
    { label: "📝 Tóm tắt trang này", prompt: "Hãy tóm tắt nội dung trang này một cách súc tích, tập trung vào các điểm chính." },
    { label: "💡 Phân tích đoạn văn", prompt: "Phân tích nội dung được chọn dưới góc nhìn CEO, đưa ra nhận định thực tế." },
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
        <svg className="h-8 w-8 text-stone-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="text-sm text-stone-400 leading-relaxed">
        Hỏi về trang, văn bản đã chọn, hoặc công việc của bạn.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip.label}
            className="cursor-pointer rounded-full bg-surface px-3 py-1.5 text-xs text-stone-300 hover:bg-surface-hover active:scale-95 transition-all"
            onClick={() => props.onChipClick?.(chip.prompt)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement auto-dismiss error hook**

Add to `entrypoints/sidepanel/App.tsx` — replace `error` state with auto-dismiss logic:

```tsx
// Inside App component, replace:
// const [error, setError] = useState("");
// With:
const [error, setError] = useState("");
const errorTimerRef = useRef<ReturnType<typeof setTimeout>>();

function setAutoDismissError(msg: string, durationMs = 8000) {
  if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  setError(msg);
  if (msg) {
    errorTimerRef.current = setTimeout(() => setError(""), durationMs);
  }
}
```

- [ ] **Step 4: Wire up App.tsx with all new components**

Update the App render block. Key changes:
- Show `<SkeletonPanel />` while `!settings`
- Show `<EmptyState />` when `messages.length === 0`
- Replace `ChatMessage` usage with new bubble layout
- Add `<TypingIndicator />` when streaming
- Replace error banner with styled auto-dismiss version
- Replace missing API key banner with `showMissingKeyBanner` prop on ChatComposer
- Pass `sending` prop to ChatComposer
- Remove old "Đọc trang" suffix from header (handled in HeaderBar)

```tsx
// In App.tsx, update the render section to:

if (!settings) {
  return (
    <main className="flex min-h-screen flex-col bg-warm-bg text-stone-50">
      <SkeletonPanel />
    </main>
  );
}

return (
  <main className="flex min-h-screen flex-col bg-warm-bg text-stone-50">
    <HeaderBar view={view} onViewChange={setView} onReadPage={readPage} readingPage={readingPage} />
    {error ? (
      <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-red-900/30 bg-red-950/10 px-3 py-2 text-xs text-red-400">
        <span>⚠️</span>
        <span className="flex-1">{error}</span>
      </div>
    ) : null}
    {view === "settings" ? <SettingsPanel settings={settings} onChange={updateSettings} /> : null}
    {view === "prompts" ? <PromptManager prompts={prompts} onChange={updatePrompts} /> : null}
    {view === "saved" ? <SavedResults results={savedResults} onDelete={(id) => updateSavedResults(savedResults.filter((item) => item.id !== id))} /> : null}
    {view === "chat" ? (
      <>
        <section className="flex-1 space-y-3 overflow-auto p-3" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 ? <EmptyState onChipClick={(text) => sendPrompt(text)} /> : null}
          {messages.map((item) => (
            <ChatMessage key={item.id} role={item.role} content={item.content} onSave={item.role === "assistant" ? () => saveMessage(item) : undefined} />
          ))}
          {streaming && messages.length > 0 && messages[messages.length - 1].content === "" ? <TypingIndicator /> : null}
        </section>
        <ChatComposer
          disabled={streaming || missingApiKey || missingModel}
          onSend={sendPrompt}
          showMissingKeyBanner={missingApiKey || missingModel}
          missingType={missingApiKey ? "key" : "model"}
          providerLabel={provider?.label}
          sending={streaming}
        />
      </>
    ) : null}
  </main>
);
```

- [ ] **Step 5: Update app test for new selectors**

Update `tests/sidepanel-app.test.tsx` to match new DOM:

```tsx
import { render, screen } from "@testing-library/react";
import App from "../entrypoints/sidepanel/App";

test("renders the sidebar after settings load", async () => {
  render(<App />);

  expect(await screen.findByText(/Thêm khóa API/)).toBeInTheDocument();
});
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add entrypoints/sidepanel/App.tsx entrypoints/sidepanel/components/Skeleton.tsx entrypoints/sidepanel/components/EmptyState.tsx tests/sidepanel-app.test.tsx tests/skeleton.test.tsx
git commit -m "feat(ui): add skeleton loading, empty state chips, auto-dismiss errors"
```

---

### Task 6: SettingsPanel — Card Layout + Skeleton + Eye Toggle

**Files:**
- Modify: `entrypoints/sidepanel/components/SettingsPanel.tsx`
- Modify: `tests/sidepanel-settings.test.tsx`

**Interfaces:**
- Consumes: `settings`, `onChange` props
- Produces: redesigned settings with card containers, password eye toggle, skeleton loading for models

- [ ] **Step 1: Write/update test**

```tsx
import { render, screen } from "@testing-library/react";
import { SettingsPanel } from "../entrypoints/sidepanel/components/SettingsPanel";
import type { Settings } from "../src/lib/storage/types";

const mockSettings: Settings = {
  providerId: "openai",
  apiKeys: {},
  selectedModels: {},
  promptStyle: "",
  createdAt: "",
  updatedAt: "",
  schemaVersion: 3,
};

test("renders provider select and API key input", () => {
  render(<SettingsPanel settings={mockSettings} onChange={() => {}} />);
  expect(screen.getByText("Nhà cung cấp")).toBeInTheDocument();
  expect(screen.getByText("Khóa API")).toBeInTheDocument();
});

test("shows eye toggle for API key input", () => {
  render(<SettingsPanel settings={mockSettings} onChange={() => {}} />);
  expect(screen.getByTitle("Hiện/ẩn khóa API")).toBeInTheDocument();
});

test("renders test connection button", () => {
  render(<SettingsPanel settings={mockSettings} onChange={() => {}} />);
  expect(screen.getByText("Kiểm tra kết nối")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sidepanel-settings.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement SettingsPanel redesign**

Update file with:
- Card containers (`bg-surface rounded-xl p-3`) for each section
- Provider select with `appearance-none` + custom chevron
- API key input with eye toggle (toggle input `type` between `password`/`text`)
- Model select with skeleton placeholder when loading
- Model warning/error with amber/red text + icon
- Test connection button with plug icon, spinner when testing, result with checkmark/x

```tsx
import { useEffect, useState } from "react";
import { getProvider, getProviderOptions } from "../../../src/lib/ai/providers";
import type { LoadModelsResponse, TestConnectionResponse } from "../../../src/lib/messaging/types";
import type { Settings } from "../../../src/lib/storage/types";

function EyeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4 text-stone-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a6 6 0 0 1-12 0V8" />
    </svg>
  );
}

function ModelSkeleton() {
  return <div className="h-10 w-full animate-pulse rounded-lg bg-surface" />;
}

export function SettingsPanel(props: {
  settings: Settings;
  onChange: (settings: Settings) => void | Promise<void>;
}) {
  const provider = getProvider(props.settings.providerId) ?? getProvider("openai");
  const providerId = provider?.id ?? "openai";
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<string[]>(provider?.knownModels ?? []);
  const [modelWarning, setModelWarning] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [localApiKey, setLocalApiKey] = useState(props.settings.apiKeys[providerId] ?? "");
  const [showKey, setShowKey] = useState(false);

  const requiresKey = provider?.requiresApiKey ?? true;
  const selectedModel = props.settings.selectedModels[providerId] ?? "";

  useEffect(() => {
    setLocalApiKey(props.settings.apiKeys[providerId] ?? "");
  }, [providerId]);

  function createNextSettings(patch: Partial<Settings>): Settings {
    return { ...props.settings, ...patch, updatedAt: new Date().toISOString() };
  }

  async function commit(next: Settings) {
    await props.onChange(next);
  }

  async function updateApiKey(value: string) {
    setLocalApiKey(value);
    const nextKeys = { ...props.settings.apiKeys };
    if (value.trim()) nextKeys[providerId] = value;
    else delete nextKeys[providerId];
    await commit(createNextSettings({ apiKeys: nextKeys }));
  }

  async function updateSelectedModel(value: string) {
    await commit(createNextSettings({
      selectedModels: { ...props.settings.selectedModels, [providerId]: value }
    }));
  }

  async function updateProvider(value: string) {
    const nextProvider = getProvider(value);
    const nextModels = nextProvider?.knownModels ?? [];
    setModels(nextModels);
    setModelWarning(null);
    setModelError(null);
    const nextKeys = { ...props.settings.apiKeys };
    const existingKey = props.settings.apiKeys[value] ?? "";
    setLocalApiKey(existingKey);
    await commit(createNextSettings({ providerId: value }));
  }

  useEffect(() => {
    let cancelled = false;
    const knownModels = provider?.knownModels ?? [];
    setModels(knownModels);
    setModelError(null);
    setModelWarning(null);

    if (!provider) return;
    if (provider.requiresApiKey && !localApiKey.trim()) {
      if (knownModels.length > 0) setModelWarning("Thêm khóa API để tải mô hình trực tiếp. Đang dùng danh sách mô hình có sẵn.");
      return;
    }

    setLoadingModels(true);
    chrome.runtime.sendMessage({ type: "LOAD_MODELS", requestId: crypto.randomUUID() })
      .then((response: LoadModelsResponse) => {
        if (cancelled) return;
        if (response?.ok) {
          setModels(response.models);
          setModelWarning(null);
          const current = props.settings.selectedModels[provider.id];
          const nextModel = current && response.models.includes(current)
            ? current
            : provider.defaultModel && response.models.includes(provider.defaultModel)
              ? provider.defaultModel
              : response.models[0];
          if (nextModel && nextModel !== current) {
            props.onChange(createNextSettings({ selectedModels: { ...props.settings.selectedModels, [provider.id]: nextModel } }));
          }
        } else if (knownModels.length > 0) {
          setModels(knownModels);
          setModelWarning("Không tải được danh sách mô hình. Đang dùng mô hình có sẵn.");
        } else {
          setModels([]);
          setModelError(response?.error ?? "Không thể tải mô hình.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (knownModels.length > 0) {
          setModels(knownModels);
          setModelWarning("Không tải được danh sách mô hình. Đang dùng mô hình có sẵn.");
        } else {
          setModels([]);
          setModelError("Không thể tải mô hình.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });

    return () => { cancelled = true; };
  }, [providerId, localApiKey]);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      await props.onChange(props.settings);
      const response: TestConnectionResponse = await chrome.runtime.sendMessage({ type: "TEST_CONNECTION", requestId: crypto.randomUUID() });
      setTestResult(response.ok ? { ok: true, message: "Kết nối thành công." } : { ok: false, message: response.error });
    } catch {
      setTestResult({ ok: false, message: "Không thể gửi yêu cầu kiểm tra." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="space-y-4 p-3">
      {/* Provider */}
      <div className="rounded-xl bg-surface p-3">
        <label className="block text-xs text-stone-400">Nhà cung cấp</label>
        <div className="relative mt-1">
          <select
            className="w-full appearance-none rounded-lg border border-stone-700 bg-warm-bg p-2.5 pr-8 text-sm text-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
            value={providerId}
            onChange={(event) => updateProvider(event.target.value)}
          >
            {getProviderOptions().map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <ChevronIcon />
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2 rounded-lg border border-stone-700 bg-stone-800/50 px-3 py-2 text-xs text-stone-400">
        <ShieldIcon />
        <span>Khóa API được lưu trong bộ nhớ Chrome extension. Đây là phiên bản MVP, chưa mã hóa.</span>
      </div>

      {/* API Key */}
      <div className="rounded-xl bg-surface p-3">
        <label className="block text-xs text-stone-400">
          {requiresKey ? "Khóa API" : "Khóa API (không bắt buộc)"}
        </label>
        <div className="relative mt-1">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <LockIcon />
          </div>
          <input
            className="w-full rounded-lg border border-stone-700 bg-warm-bg py-2.5 pl-10 pr-10 text-sm text-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
            type={showKey ? "text" : "password"}
            value={localApiKey}
            onChange={(event) => updateApiKey(event.target.value)}
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors"
            type="button"
            title="Hiện/ẩn khóa API"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {/* Model */}
      <div className="rounded-xl bg-surface p-3">
        <label className="block text-xs text-stone-400">Mô hình</label>
        <div className="relative mt-1">
          {loadingModels ? (
            <ModelSkeleton />
          ) : (
            <select
              className="w-full appearance-none rounded-lg border border-stone-700 bg-warm-bg p-2.5 pr-8 text-sm text-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors disabled:opacity-50"
              value={selectedModel}
              onChange={(event) => updateSelectedModel(event.target.value)}
              disabled={models.length === 0}
            >
              {selectedModel && !models.includes(selectedModel) ? <option value={selectedModel}>{selectedModel}</option> : null}
              {models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          )}
          {!loadingModels && <ChevronIcon />}
        </div>
        {!loadingModels && modelWarning ? (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-400">
            <span>⚠️</span> {modelWarning}
          </div>
        ) : null}
        {!loadingModels && modelError ? (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
            <span>❌</span> {modelError}
          </div>
        ) : null}
      </div>

      {/* Test Connection */}
      <div className="rounded-xl bg-surface p-3">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-700 bg-warm-bg py-2.5 text-sm text-stone-50 hover:bg-surface-hover transition-colors disabled:opacity-50"
          disabled={testing}
          onClick={handleTestConnection}
        >
          {testing ? (
            <svg className="h-4 w-4 animate-spinner" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <PlugIcon />
          )}
          {testing ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
        </button>
        {testResult ? (
          <div className={`mt-2 flex items-center gap-1 text-xs ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>
            {testResult.ok ? <span>✅</span> : <span>❌</span>}
            {testResult.message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sidepanel-settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/components/SettingsPanel.tsx tests/sidepanel-settings.test.tsx
git commit -m "feat(ui): redesign settings panel with card layout, eye toggle, model skeleton"
```

---

### Task 7: PromptManager + SavedResults — Card Redesign

**Files:**
- Modify: `entrypoints/sidepanel/components/PromptManager.tsx`
- Modify: `entrypoints/sidepanel/components/SavedResults.tsx`
- Test: create `tests/prompt-manager.test.tsx` + `tests/saved-results.test.tsx`

**Interfaces:**
- Consumes: prompts/results arrays + onChange/onDelete callbacks
- Produces: redesigned cards with warm palette, sticky add button, expand/collapse for saved

- [ ] **Step 1: Write failing tests**

`tests/prompt-manager.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptManager } from "../entrypoints/sidepanel/components/PromptManager";
import type { PromptTemplate } from "../src/lib/prompts/types";

const mockPrompts: PromptTemplate[] = [
  { id: "1", name: "Test Prompt", instruction: "Analyze this", category: "custom", sortOrder: 0, createdAt: "", updatedAt: "" }
];

test("renders prompt cards and add button", () => {
  render(<PromptManager prompts={mockPrompts} onChange={() => {}} />);
  expect(screen.getByText("Test Prompt")).toBeInTheDocument();
  expect(screen.getByText("Thêm mẫu lệnh")).toBeInTheDocument();
});

test("adds a new prompt on button click", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<PromptManager prompts={[]} onChange={onChange} />);

  await user.click(screen.getByText("Thêm mẫu lệnh"));
  expect(onChange).toHaveBeenCalledOnce();
});
```

`tests/saved-results.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { SavedResults } from "../entrypoints/sidepanel/components/SavedResults";
import type { SavedResult } from "../src/lib/storage/types";

const mockResults: SavedResult[] = [
  { id: "1", title: "Saved Analysis", sourceType: "chat", outputMarkdown: "This is a saved analysis", createdAt: "2026-01-01T00:00:00Z" }
];

test("renders saved results cards", () => {
  render(<SavedResults results={mockResults} onDelete={() => {}} />);
  expect(screen.getByText("Saved Analysis")).toBeInTheDocument();
});

test("shows empty state when no results", () => {
  render(<SavedResults results={[]} onDelete={() => {}} />);
  expect(screen.getByText("Chưa có kết quả nào.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/prompt-manager.test.tsx tests/saved-results.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PromptManager redesign**

```tsx
import { useState } from "react";
import type { PromptTemplate } from "../../../src/lib/prompts/types";

export function PromptManager(props: {
  prompts: PromptTemplate[];
  onChange: (prompts: PromptTemplate[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function updatePrompt(id: string, instruction: string) {
    props.onChange(
      props.prompts.map((prompt) =>
        prompt.id === id ? { ...prompt, instruction, updatedAt: new Date().toISOString() } : prompt
      )
    );
  }

  function updateName(id: string, name: string) {
    props.onChange(
      props.prompts.map((prompt) =>
        prompt.id === id ? { ...prompt, name, updatedAt: new Date().toISOString() } : prompt
      )
    );
  }

  function addPrompt() {
    const now = new Date().toISOString();
    props.onChange([
      ...props.prompts,
      {
        id: crypto.randomUUID(),
        name: "Mẫu lệnh tùy chỉnh",
        instruction: "Phân tích nội dung này và đưa ra đề xuất thực tế súc tích.",
        category: "custom",
        sortOrder: props.prompts.length,
        createdAt: now,
        updatedAt: now
      }
    ]);
  }

  function deletePrompt(id: string) {
    props.onChange(props.prompts.filter((prompt) => prompt.id !== id));
  }

  return (
    <section className="space-y-3 p-3">
      <button
        className="sticky top-0 z-10 flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm text-white hover:bg-primary-light transition-colors"
        onClick={addPrompt}
      >
        <span>+</span> Thêm mẫu lệnh
      </button>
      {props.prompts.map((prompt) => (
        <article key={prompt.id} className="relative rounded-xl border border-stone-800 bg-surface p-4">
          <button
            className="absolute right-3 top-3 text-stone-500 hover:text-red-400 transition-colors"
            title="Xóa"
            onClick={() => deletePrompt(prompt.id)}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <div className="mb-2 text-sm font-medium text-primary-light">{prompt.name}</div>
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-stone-700 bg-warm-bg p-2.5 text-sm text-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
            value={prompt.instruction}
            onChange={(event) => updatePrompt(prompt.id, event.target.value)}
          />
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Implement SavedResults redesign**

```tsx
import { useState } from "react";
import type { SavedResult } from "../../../src/lib/storage/types";

export function SavedResults(props: {
  results: SavedResult[];
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (props.results.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
          <svg className="h-6 w-6 text-stone-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm text-stone-400">Chưa có kết quả nào.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 p-3">
      {props.results.map((result) => (
        <article key={result.id} className="relative rounded-xl border border-stone-800 bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <button
              className="flex-1 text-left text-sm font-medium text-primary-light"
              onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
            >
              {result.title}
            </button>
            <button
              className="flex-shrink-0 text-stone-500 hover:text-red-400 transition-colors"
              title="Xóa"
              onClick={() => setConfirmDeleteId(result.id)}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
          {expandedId === result.id ? (
            <div className="mt-2 whitespace-pre-wrap text-sm text-stone-300 leading-relaxed">{result.outputMarkdown}</div>
          ) : (
            <div className="mt-2 line-clamp-3 text-sm text-stone-400">{result.outputMarkdown}</div>
          )}
          <div className="mt-2 flex items-center justify-between">
            {result.outputMarkdown.length > 150 ? (
              <button
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
                onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
              >
                {expandedId === result.id ? "Thu gọn" : "Xem thêm"}
              </button>
            ) : <div />}
            <time className="text-xs text-stone-600">{new Date(result.createdAt).toLocaleDateString("vi-VN")}</time>
          </div>
          {confirmDeleteId === result.id && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-warm-bg/90 backdrop-blur-sm">
              <div className="rounded-xl bg-surface p-4 shadow-lg">
                <p className="mb-3 text-sm text-stone-200">Xóa kết quả này?</p>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-500 transition-colors"
                    onClick={() => { props.onDelete(result.id); setConfirmDeleteId(null); }}
                  >
                    Xóa
                  </button>
                  <button
                    className="rounded-lg bg-surface-hover px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-600 transition-colors"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/prompt-manager.test.tsx tests/saved-results.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add entrypoints/sidepanel/components/PromptManager.tsx entrypoints/sidepanel/components/SavedResults.tsx tests/prompt-manager.test.tsx tests/saved-results.test.tsx
git commit -m "feat(ui): redesign prompt manager and saved results cards"
```

---

### Task 8: Selection Toolbar — Warm Palette + Animations

**Files:**
- Modify: `src/lib/selection/toolbar.ts` (inline style updates)
- Modify: `entrypoints/active-tab-agent.ts` (entry/exit animation timing)
- Test: update `tests/selection/toolbar.test.tsx` if exists

**Interfaces:**
- Consumes: `SelectionAction` type, existing toolbar rendering logic
- Produces: toolbar with warm palette, entry/exit animations, backdrop blur

- [ ] **Step 1: Update toolbar.ts — new warm palette + entry animation**

```ts
import { SELECTION_ACTIONS } from "./actions";
import type { SelectionAction } from "./types";

const MIN_SELECTION_CHARS = 20;
const MAX_SELECTION_CHARS = 20000;
const TOOLBAR_HEIGHT = 42;
const GAP = 6;
const ARROW_SIZE = 5;

export function isSelectionLengthAllowed(text: string): boolean {
  const length = text.trim().length;
  return length >= MIN_SELECTION_CHARS && length <= MAX_SELECTION_CHARS;
}

export function isSelectionTooLong(text: string): boolean {
  return text.trim().length > MAX_SELECTION_CHARS;
}

function applyBaseStyles(el: HTMLElement) {
  el.dataset.personalAiToolbar = "true";
  el.style.position = "fixed";
  el.style.zIndex = "2147483647";
  el.style.boxSizing = "border-box";
}

export function renderTooLongIndicator(
  position: { top: number; left: number }
): HTMLElement {
  const el = document.createElement("div");
  applyBaseStyles(el);
  el.style.top = `${position.top}px`;
  el.style.left = `${position.left}px`;
  el.style.padding = "6px 12px";
  el.style.border = "1px solid rgba(245, 158, 11, 0.5)"; // amber/500
  el.style.borderRadius = "8px";
  el.style.background = "#292524"; // surface
  el.style.color = "#fbbf24"; // amber-400
  el.style.font = "12px system-ui, sans-serif";
  el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.32)";
  el.style.whiteSpace = "nowrap";
  el.style.opacity = "0";
  el.style.transition = "opacity 0.15s ease-out";
  el.textContent = "Văn bản quá dài (tối đa 20,000 ký tự)";

  // Trigger entry animation
  requestAnimationFrame(() => { el.style.opacity = "1"; });

  return el;
}

export function renderSelectionToolbar(
  position: { top: number; left: number },
  onAction: (action: SelectionAction) => void,
  onDismiss?: () => void
): HTMLElement {
  const toolbar = document.createElement("div");
  applyBaseStyles(toolbar);
  toolbar.style.top = `${position.top}px`;
  toolbar.style.left = `${position.left}px`;
  toolbar.style.display = "flex";
  toolbar.style.alignItems = "center";
  toolbar.style.gap = "2px";
  toolbar.style.padding = "4px 6px";
  toolbar.style.border = "1px solid rgba(68, 64, 60, 0.5)"; // border/50
  toolbar.style.borderRadius = "12px";
  toolbar.style.background = "rgba(28, 25, 23, 0.95)"; // warm-bg/95
  toolbar.style.backdropFilter = "blur(8px)";
  toolbar.style.boxShadow = "0 8px 24px rgba(0,0,0,0.32)";
  toolbar.style.whiteSpace = "nowrap";
  toolbar.style.opacity = "0";
  toolbar.style.transform = "scale(0.95)";
  toolbar.style.transition = "opacity 0.15s ease-out, transform 0.15s ease-out";

  // Entry animation
  requestAnimationFrame(() => {
    toolbar.style.opacity = "1";
    toolbar.style.transform = "scale(1)";
  });

  // Arrow pointing toward selection
  const arrow = document.createElement("div");
  arrow.style.position = "absolute";
  arrow.style.width = "8px";
  arrow.style.height = "8px";
  arrow.style.background = "rgba(28, 25, 23, 0.95)";
  arrow.style.borderLeft = "1px solid rgba(68, 64, 60, 0.5)";
  arrow.style.borderTop = "1px solid rgba(68, 64, 60, 0.5)";
  arrow.style.transform = "rotate(45deg)";
  arrow.style.bottom = "-5px";
  arrow.style.left = "50%";
  arrow.style.marginLeft = "-4px";
  arrow.style.zIndex = "-1";
  arrow.style.backdropFilter = "blur(8px)";
  toolbar.appendChild(arrow);

  for (const item of SELECTION_ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = item.label;
    button.innerHTML = `<span style="font-size:14px;line-height:1">${item.icon}</span><span style="margin-left:4px">${item.label}</span>`;
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.color = "#FAFAF9"; // text-primary
    button.style.background = "transparent";
    button.style.border = "0";
    button.style.borderRadius = "8px";
    button.style.padding = "6px 8px";
    button.style.font = "12px system-ui, sans-serif";
    button.style.cursor = "pointer";
    button.style.transition = "background 0.15s";
    button.addEventListener("mouseenter", () => { button.style.background = "#3C3833"; }); // surface-hover
    button.addEventListener("mouseleave", () => { button.style.background = "transparent"; });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onAction(item.action);
    });
    toolbar.appendChild(button);

    if (item !== SELECTION_ACTIONS[SELECTION_ACTIONS.length - 1]) {
      const divider = document.createElement("span");
      divider.style.width = "1px";
      divider.style.height = "16px";
      divider.style.background = "#44403C"; // border color
      divider.style.margin = "0 2px";
      toolbar.appendChild(divider);
    }
  }

  return toolbar;
}
```

- [ ] **Step 2: Run existing tests (no selection toolbar tests exist — skip if none)**

Run: `ls tests/selection/` — if directory missing, skip.

- [ ] **Step 3: Verify existing tests pass**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/selection/toolbar.ts entrypoints/active-tab-agent.ts
git commit -m "feat(ui): redesign selection toolbar with warm palette and entry animation"
```

---

### Final Verification

- [ ] **Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Build extension**

Run: `npx wxt build`
Expected: Build succeeds, no errors

- [ ] **Final commit**

```bash
git commit --allow-empty -m "chore: complete modern UI redesign implementation"
```
