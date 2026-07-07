# Danh sách chức năng

## 1. Trò chuyện AI (AI Chat)

### 1.1 Chat side panel
- **File**: `entrypoints/sidepanel/App.tsx`, `entrypoints/sidepanel/hooks/useChatController.ts`, `entrypoints/sidepanel/components/ChatComposer.tsx`
- Trò chuyện trực tiếp với AI ngay trong side panel của trình duyệt
- Nhập tin nhắn qua textarea (Enter gửi, Shift+Enter xuống dòng)
- Tự động resize textarea khi gõ
- Hiển thị tin nhắn người dùng và AI dạng bubble chat
- Phân tích Markdown: **bold**, *italic*, `code`, headings, lists, code blocks
- Lưu kết quả chat vào danh sách đã lưu
- Sao chép nội dung phản hồi AI

### 1.2 Streaming AI response
- **File**: `entrypoints/background.ts`, `src/lib/ai/client.ts`
- Hiển thị phản hồi AI theo thời gian thực (stream) qua SSE (Server-Sent Events)
- Giao tiếp giữa side panel và background service worker qua Port (`chrome.runtime.connect`)
- Các phase stream: `connecting` → `streaming` → `done`
- Hiệu ứng typing indicator (3 chấm nhảy) trong khi chờ
- Nút hủy yêu cầu khi đang kết nối
- Watchdog timeout 30s cho token đầu tiên

### 1.3 Gợi ý nhanh (Empty State)
- **File**: `entrypoints/sidepanel/components/EmptyState.tsx`
- 3 chip gợi ý: "Tóm tắt trang này", "Phân tích CEO", "Viết lại email"
- Click để gửi ngay prompt tương ứng

### 1.4 Chat mới / Xóa chat
- **File**: `entrypoints/sidepanel/App.tsx`
- Nút "Chat mới" xóa toàn bộ lịch sử hội thoại

---

## 2. Chọn văn bản trên trang

### 2.1 Toolbar chọn văn bản
- **File**: `entrypoints/active-tab-agent.ts`, `src/lib/selection/toolbar.ts`
- Khi người dùng bôi đen văn bản trên trang web (≥20 ký tự, ≤20,000 ký tự), hiện toolbar nổi
- Toolbar có 5 nút hành động:
  - 💡 **Giải thích** (`explain`)
  - 🌐 **Dịch sang tiếng Việt** (`translate_vi`)
  - ✍️ **Viết lại chuyên nghiệp** (`rewrite_professional`)
  - 📝 **Tóm tắt** (`summarize`)
  - 📋 **Bullet/Action list** (`action_list`)
- Toolbar tự động định vị phía trên hoặc dưới vùng chọn
- Hiệu ứng fade-in, scale-in khi xuất hiện
- Mũi tên nhỏ chỉ về vùng chọn
- Có divider giữa các nút

### 2.2 Xử lý văn bản quá dài
- **File**: `src/lib/selection/toolbar.ts`
- Nếu văn bản >20,000 ký tự, hiển thị indicator "Văn bản quá dài" thay vì toolbar

### 2.3 Hành vi đóng toolbar
- Tự động ẩn khi scroll, click ra ngoài, nhấn Escape, resize trình duyệt
- Debounce 150ms khi selection thay đổi

### 2.4 Floating Window
- **File**: `src/lib/floating-window/FloatingWindow.tsx`, `src/lib/floating-window/mount.ts`
- Khi chọn action từ toolbar, kết quả AI hiển thị trong cửa sổ nổi trên trang
- Cửa sổ nổi có thể: kéo thả (drag), thay đổi kích thước (resize), phóng to (maximize), thu nhỏ (minimize), đóng
- Render trong Shadow DOM để cách ly style
- Tích hợp streaming AI response trực tiếp

---

## 3. Đọc trang (Page Extraction)

### 3.1 Trích xuất nội dung trang
- **File**: `entrypoints/background.ts`, `entrypoints/active-tab-agent.ts`, `src/lib/extraction/`
- Nút "Đọc trang" trên HeaderBar để trích xuất nội dung tab hiện tại
- Phương pháp trích xuất:
  - **Readability** (`@mozilla/readability`): ưu tiên, clone DOM và parse bài viết chính
  - **DOM Fallback**: nếu Readability thất bại, quét các thẻ H1-H4, P, LI, TD, TH, blockquote, pre, code, dt, dd, figcaption
- Tự động inject content agent vào tab nếu chưa có
- Retry 5 lần (100ms间隔) chờ content script sẵn sàng
- Giới hạn nội dung 40,000 ký tự, có cảnh báo nếu bị cắt

### 3.2 Prompt đọc trang
- **File**: `src/lib/prompts/builders.ts`
- Sau khi trích xuất, gửi prompt yêu cầu AI tóm tắt từ góc nhìn CEO
- Cấu trúc trả về: Điểm chính, Cơ hội áp dụng, Rủi ro triển khai, Hành động ngay

---

## 4. AI Provider (Nhà cung cấp AI)

### 4.1 Danh sách provider
- **File**: `src/lib/ai/providers.json`, `src/lib/ai/providers.ts`
- Hỗ trợ 4 provider:
  - **OpenAI** (api.openai.com)
  - **OpenCode** (opencode.ai)
  - **CommandCode** (api.commandcode.ai)
  - **LMStudio** (localhost:1234)
- Mỗi provider có: base_url, model_url, requires_api_key, default_model, known_models

### 4.2 Kiểm tra kết nối
- **File**: `src/lib/ai/client.ts` (`testConnection`)
- Gửi request test đơn giản (non-stream) để kiểm tra provider
- Kiểm tra cấu trúc response đúng định dạng OpenAI-style

### 4.3 Tải danh sách model
- **File**: `src/lib/ai/client.ts` (`fetchModels`)
- Tự động tải danh sách model từ provider API
- Fallback về danh sách known_models nếu không tải được

### 4.4 Runtime config
- **File**: `src/lib/ai/runtime.ts`
- Resolve cấu hình runtime: kiểm tra provider tồn tại, API key, model được chọn
- Trả về discriminated union `{ ok, config } | { ok, error }`

### 4.5 Xử lý lỗi stream
- **File**: `src/lib/ai/stream.ts`
- Ánh xạ lỗi: AbortError (hủy), TimeoutError (quá chậm), TypeError (mạng), SyntaxError (dữ liệu sai)

---

## 5. Cài đặt (Settings)

### 5.1 Chọn nhà cung cấp
- **File**: `entrypoints/sidepanel/components/SettingsPanel.tsx`
- Dropdown chọn AI provider
- Tự động cập nhật danh sách model khi đổi provider

### 5.2 Quản lý API Key
- Nhập/lưu API key cho từng provider
- Hiện/ẩn API key (toggle password)
- Lưu trữ local trong `chrome.storage.local`
- Cảnh báo bảo mật: lưu local chưa mã hóa

### 5.3 Chọn Model
- Dropdown chọn model từ danh sách đã tải
- Loading skeleton khi đang tải model
- Cảnh báo nếu không tải được danh sách model

### 5.4 Kiểm tra kết nối
- Nút "Kiểm tra kết nối" gọi API test
- Hiển thị kết quả thành công/thất bại

---

## 6. Mẫu lệnh (Prompt Manager)

### 6.1 Quản lý mẫu lệnh
- **File**: `entrypoints/sidepanel/components/PromptManager.tsx`
- Xem danh sách mẫu lệnh, thêm mới, xóa, chỉnh sửa
- Mỗi mẫu lệnh có: id, name, instruction, category, sortOrder

### 6.2 Mẫu lệnh mặc định (Seeds)
- **File**: `src/lib/prompts/seeds.ts`
- 5 mẫu lệnh khởi tạo:
  - Viết lại phong cách CEO (ceo)
  - Vấn đề - Nguyên nhân - Giải pháp (general)
  - Phân tích vận hành (ceo)
  - Kế hoạch hành động (general)
  - Senior dev đánh giá code (dev)

### 6.3 Categories
- **File**: `src/lib/prompts/types.ts`
- 7 category: general, ceo, dev, legal, sales, marketing, custom

---

## 7. Kết quả đã lưu (Saved Results)

### 7.1 Lưu kết quả
- **File**: `entrypoints/sidepanel/App.tsx`, `entrypoints/sidepanel/components/SavedResults.tsx`
- Lưu phản hồi AI vào danh sách (từ chat, page, selection)

### 7.2 Xem và quản lý
- Danh sách kết quả đã lưu với tiêu đề, ngày tháng
- Mở rộng/thu gọn nội dung dài (toggle >150 ký tự)
- Xóa kết quả với xác nhận (confirm overlay)

---

## 8. Lưu trữ (Storage)

### 8.1 Storage CRUD
- **File**: `src/lib/storage/index.ts`
- 3 key: `settings`, `promptTemplates`, `savedResults`
- Lưu/đọc `chrome.storage.local` với `StorageEnvelope<T>` (schemaVersion + data)

### 8.2 Migrations
- **File**: `src/lib/storage/migrations.ts`
- Schema version hiện tại: 3
- Migrate từ định dạng cũ (flat) sang định dạng mới (envelope)
- Xử lý providerId legacy, apiKeys, selectedModels

### 8.3 Defaults
- **File**: `src/lib/storage/defaults.ts`
- Settings mặc định: provider mặc định (openai), language "vi"
- Prompt templates khởi tạo từ seeds

---

## 9. Giao tiếp nội bộ (Messaging)

### 9.1 Message types
- **File**: `src/lib/messaging/types.ts`
- 10+ loại message giữa các thành phần:
  - `ACTIVATE_ACTIVE_TAB_AGENT` — kích hoạt content script
  - `EXTRACT_ACTIVE_PAGE` — trích xuất nội dung trang
  - `LOAD_MODELS` — tải danh sách model
  - `SELECTION_ACTION` — xử lý văn bản đã chọn
  - `TEST_CONNECTION` — kiểm tra kết nối
  - `FORWARD_SELECTION_ACTION` — chuyển tiếp action đến side panel
  - `SETTINGS_UPDATED` — thông báo settings thay đổi
  - `AI_CHAT_REQUEST` — request chat qua port

### 9.2 Port streaming
- **File**: `src/lib/messaging/ports.ts`
- Port name: `ai-stream`
- Kết nối port lifecycle: connect → postMessage → onMessage → onDisconnect
- Một port mới được tạo mỗi lần gửi tin nhắn

---

## 10. UI Components

### 10.1 HeaderBar
- **File**: `entrypoints/sidepanel/components/HeaderBar.tsx`
- Logo + tên "AI Cá Nhân"
- Nút "Đọc trang" (loading state khi đang đọc)
- 3 tab: Mẫu lệnh, Đã lưu, Cài đặt
- Active indicator (chấm tròn phía dưới)
- Backdrop blur effect

### 10.2 ChatMessage
- **File**: `entrypoints/sidepanel/components/ChatMessage.tsx`
- Avatar robot cho AI
- User message: gradient màu primary, căn phải
- AI message: nền surface, căn trái
- Nút "Sao chép" (với feedback "Đã sao chép" 1.8s)
- Nút "Lưu kết quả" (cho message AI)
- Hiệu ứng fade-in-up
- TypingIndicator: 3 chấm bounce + phase text

### 10.3 MessageContent (Markdown render)
- **File**: `src/lib/ui/MessageContent.tsx`
- Parse inline: **bold**, *italic*, `code`
- Parse block: headings (H1-H3), unordered lists, code blocks (có lang label)
- Line breaks, empty lines spacing

### 10.4 Skeleton Loading
- **File**: `entrypoints/sidepanel/components/Skeleton.tsx`
- Hiển thị skeleton khi settings chưa load
- Shimmer animation

---

## 11. Background Service Worker

### 11.1 Khởi tạo
- **File**: `entrypoints/background.ts`
- `runtime.onInstalled`: set panel behavior (open on action click)
- Cache settings 5 giây

### 11.2 Xử lý message
- `ACTIVATE_ACTIVE_TAB_AGENT`: inject content script, set badge "ON"/"ERR"
- `LOAD_MODELS`: gọi API lấy danh sách model
- `TEST_CONNECTION`: kiểm tra kết nối provider
- `SELECTION_ACTION`: forward đến content script
- `EXTRACT_ACTIVE_PAGE`: inject agent + retry extraction
- `SETTINGS_UPDATED`: clear cache settings

### 11.3 Port AI Stream
- Lắng nghe port `ai-stream`
- Signal abort khi port disconnect
- Busy flag để tránh concurrent request

---

## 12. Content Script (Active Tab Agent)

### 12.1 Khởi tạo
- **File**: `entrypoints/active-tab-agent.ts`
- Kiểm tra `window.__personalAiSidebarAgentInstalled` để tránh inject trùng
- Set flag để đánh dấu đã install

### 12.2 Xử lý selection
- Lắng nghe `selectionchange` → debounce 150ms → hiển thị toolbar
- Lắng nghe scroll, mousedown, keydown Escape, resize để ẩn toolbar

### 12.3 Xử lý message từ background
- `FORWARD_SELECTION_ACTION`: mount floating window với kết quả AI
- `EXTRACT_PAGE_CONTENT`: trả về nội dung trang đã trích xuất

---

## 13. Floating Window (In-Page)

### 13.1 Cửa sổ nổi
- **File**: `src/lib/floating-window/FloatingWindow.tsx`
- 3 trạng thái: `default`, `minimized` (thu nhỏ), `maximized` (phóng to)
- Kích thước mặc định: 380×500
- Kích thước tối thiểu: 280×200
- Kéo thả tự do, clamp trong viewport
- Resize từ góc dưới phải

### 13.2 Shadow DOM
- **File**: `src/lib/floating-window/mount.ts`
- Mount trong Shadow DOM (closed mode) để cách ly style
- Inject keyframes animation, scrollbar style

### 13.3 WindowHeader
- **File**: `src/lib/floating-window/WindowHeader.tsx`
- 3 nút điều khiển: Thu nhỏ, Phóng to, Đóng
- Kéo thả window

### 13.4 FloatingChatMessage
- **File**: `src/lib/floating-window/FloatingChatMessage.tsx`
- Render Markdown với styling inline
- Blink cursor khi đang streaming

---

## 14. Bảo mật

- API keys lưu trong `chrome.storage.local` — không gửi đến server nào khác ngoài AI provider
- Extension permissions: `storage`, `activeTab`, `sidePanel`, `scripting`
- Host permissions: OpenAI, localhost, https://*/* (cho content script)
- Không tự động inject content script — chỉ khi người dùng chủ động tương tác
- Floating window render trong Shadow DOM closed

---

## 15. Hỗ trợ ngôn ngữ

- UI: Tiếng Việt (vi)
- Settings: hỗ trợ `defaultLanguage` với giá trị `"vi"` hoặc `"en"`
- Hệ thống prompt: Tiếng Việt
- Action labels: Tiếng Việt
