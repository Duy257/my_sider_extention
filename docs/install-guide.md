# Personal AI Sidebar — Hướng dẫn cài đặt

## Yêu cầu

- Google Chrome hoặc Chromium (bản mới nhất)
- Node.js 18+ và npm (đã cài sẵn)
- API key cho provider bạn chọn (OpenAI, OpenCode, CommandCode, v.v.)

## Cài đặt

### 1. Build extension

Mở terminal tại thư mục dự án:

```powershell
npm install
npm run build
```

Output sẽ nằm ở `.output/chrome-mv3/`.

### 2. Load vào Chrome

1. Mở Chrome, vào `chrome://extensions`
2. Bật **Developer mode** (góc trên bên phải)
3. Chọn **Load unpacked**
4. Chọn thư mục `.output/chrome-mv3/`

### 3. Sử dụng lần đầu

1. Nhấn icon extension trên thanh toolbar để mở side panel
2. Vào tab **Settings**
3. Chọn provider từ danh sách bundled JSON
4. Nhập API key nếu provider yêu cầu
5. Chọn model được load từ provider hoặc danh sách bundled fallback
6. Quay lại **Chat** và bắt đầu sử dụng

## Dev mode (tự động reload)

```powershell
npm run dev
```

WXT sẽ build và watch thay đổi. Vào `chrome://extensions`, load unpacked từ `.output/chrome-mv3/`. Extension sẽ tự reload khi code thay đổi.

## Cấu trúc output

```
.output/chrome-mv3/
├── manifest.json          # Manifest V3
├── background.js          # Service worker
├── sidepanel.html         # Side panel entry
├── active-tab-agent.js    # Content script (injected theo yêu cầu)
├── chunks/                # React UI chunks
└── assets/                # CSS assets
```

## Lưu ý

- Provider được khai báo trong bundled JSON của extension
- Model được auto-load từ `model_url` của provider nếu API key hợp lệ hoặc provider không yêu cầu API key
- Extension có host permissions cho OpenAI, HTTPS provider, localhost và 127.0.0.1 để hỗ trợ provider tùy chỉnh được build sẵn
- Extension không có backend — API key lưu local trong `chrome.storage.local`
- Content script chỉ được inject khi bạn chủ động bấm **Read page** hoặc mở side panel
