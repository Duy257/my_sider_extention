# Product: Personal AI Sidebar for Work (Browser Extension)

## 1. Positioning

> **Not** "a Sider clone" — scope too large, risky.

**Target position:**
- EN: Personal AI Sidebar for Work
- VN: Trợ lý AI cá nhân ngay trong trình duyệt

**Goal:** When the user reads websites, Google Sheets, documents, CRMs, dashboards, articles, draft emails — one click to get AI assistance, no copy-paste to ChatGPT.

---

## 2. MVP — 5 Features

### Feature 1: Sidebar Chat
- Icon button on the right edge of the browser.
- Opens a sidebar with an AI chat frame.
- **This is the backbone.** No sidebar = not "Sider-like".

### Feature 2: Ask About Current Page
- User reads an article, report, or technical doc.
- Clicks: _"Read this page and summarize it for me."_
- Extension extracts current page text → sends to AI → returns result in sidebar.
- **Most valuable feature.**

### Feature 3: Context Menu on Text Selection
- User selects text → right-click or popup menu appears.
- Actions:
  - Explain
  - Translate to Vietnamese
  - Rewrite more professionally
  - Summarize
  - Convert to bullet/action list
- Heavily used in operations, contracts, documents, emails, research.

### Feature 4: Saved Custom Prompts
- User has fixed prompts:
  - _"Rewrite in CEO style: clear, firm, no exaggeration."_
  - _"Summarize as table: Problem – Cause – Solution."_
  - _"Analyze from a business operations perspective."_
  - _"Turn this content into an action plan."_
  - _"Review technical errors as a senior developer."_
- **Key differentiator.** Sider serves the masses; this serves the user's specific work mindset.

### Feature 5: BYOK — Bring Your Own API Key
- User enters their own OpenAI / Claude / Gemini API key.
- Data flows from browser directly to AI provider — no intermediate server.
- Faster MVP, lower backend cost, less data liability.

---

## 3. Technical Architecture

### Minimal Viable Architecture
```
Chrome Extension
├── Manifest V3
├── Sidebar UI
├── Content Script: extract page text / selected text
├── Background Service Worker: call AI APIs
├── Chrome Storage: save API keys, prompt templates, settings
└── Optional local history: save recent sessions
```

### Recommended Stack
| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript + Vite |
| Extension | Chrome Manifest V3 |
| UI | Tailwind CSS or shadcn/ui |
| Storage | `chrome.storage.local` |
| AI API | OpenAI / Anthropic / Gemini |
| Build tool | Plasmo or WXT |

> **Recommendation:** Use WXT + React + TypeScript or Plasmo. Don't write raw extension from scratch unless deep control is needed.

---

## 4. Real Usage Flows

### Flow A: Reading an article about corporate operations
1. User clicks sidebar.
2. Prompt: _Summarize this page from a CEO perspective. Divide into:_
   1. Key points
   2. Applicable opportunities
   3. Implementation risks
   4. Immediate action items

### Flow B: Selecting a contract clause
- Prompt: _Analyze legal/commercial risks in this section. Rewrite more tightly while keeping it readable._

### Flow C: Reviewing error code
- Prompt: _Explain this error like a senior backend engineer. Give the most likely root cause and a temporary fix._

> This is "personal toolkit" — not a flashy extension.

---

## 5. MVP Roadmap (3 Phases)

### Phase 1: Private MVP
**Goal:** Works for the user only.
- Sidebar chat
- Extract current page content
- Text selection → send to AI
- Save prompt templates
- Enter personal API key
- Runs locally/privately, not published to Chrome Web Store

### Phase 2: Work Assistant
**Goal:** Serves daily work.
- Local chat history
- Prompt library by role: CEO, Sales, Dev, Legal, Marketing
- Export results as Markdown
- Quick copy
- "Rewrite in my style" mode

### Phase 3: Internal Tool
**Goal:** Team usage (if needed later).
- Login
- Role-based access control
- Department-specific prompts
- Usage logging
- Admin model configuration
- Backend API proxy for cost control

---

## 6. Permissions (Critical)

Be extremely conservative:

```json
"permissions": [
  "storage",
  "contextMenus",
  "activeTab",
  "sidePanel"
]
```

**Avoid:**
```json
"<all_urls>"
```

**Design principles:**
- Only extract page content when user explicitly triggers an action.
- Never auto-read every tab.
- Never send content in the background.

This is the difference between "trustworthy personal tool" and "creepy surveillance".

---

## 7. Conclusion

- This idea is **viable, worth doing, and highly aligned** with the user's needs.
- The correct product is **not** "a mini Sider".
- The correct product is: **A deeply personalized AI extension for the user's workflow: read → understand → rewrite → analyze → turn into action.**

### MVP Summary (5 features)
1. Sidebar chat
2. Read current page
3. Process selected text
4. Personal prompts
5. BYOK (own API key)

**Key insight:** Build lean like this → usable private build ships fast, clean, low-risk. Build bloated like Sider → it becomes a full SaaS product, and the problem is no longer an extension but a full product: security, infrastructure, payments, support, compliance.
