<div align="center">

# Personal AI Sidebar

**Trợ lý AI cá nhân — đọc, viết lại, tóm tắt, phân tích ngay trong trình duyệt**

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## Tổng quan

**Personal AI Sidebar** là extension Chrome cho phép bạn trò chuyện với AI ngay trong sidebar trình duyệt. Hỗ trợ đọc nội dung trang web, tóm tắt, phân tích văn bản được chọn, và nhiều tác vụ xử lý thông tin khác.

Mô hình **BYOK (Bring Your Own API Key)** — bạn tự cấu hình API key, không cần backend server, dữ liệu hoàn toàn riêng tư.

## Tính năng

- **Chat với AI** — Giao diện chat trong sidebar, hỗ trợ streaming phản hồi
- **Đọc & tóm tắt trang** — Tự động trích xuất nội dung trang web, tóm tắt hoặc hỏi đáp về nội dung
- **Chọn text để xử lý** — Bôi đen văn bản bất kỳ, toolbar xuất hiện để phân tích, tóm tắt, dịch
- **Quản lý Prompt** — Tạo, chỉnh sửa, tổ chức các prompt mẫu
- **Lưu kết quả** — Lưu lại các phản hồi quan trọng để tra cứu sau
- **Thinking Mode** — Bật chế độ "suy nghĩ" cho các câu hỏi phức tạp (OpenAI models hỗ trợ)
- **Đa dạng AI Provider** — OpenAI, OpenCode, CommandCode, LMStudio

## Yêu cầu hệ thống

- **Trình duyệt:** Chrome (bản mới nhất)
- **API Key:** Cần có API key từ ít nhất một AI provider hỗ trợ
- **Quyền extension:** storage, activeTab, sidePanel, scripting, contextMenus

## Hướng dẫn cài đặt

### Từ Chrome Web Store

_Coming soon — extension đang trong giai đoạn phát triển._

### Load unpacked (development)

1. Clone repository:
   ```bash
   git clone https://github.com/your-username/personal-ai-sidebar.git
   cd personal-ai-sidebar
   ```
2. Cài đặt dependencies:
   ```bash
   npm install
   ```
3. Build extension:
   ```bash
   npm run build
   ```
4. Mở `chrome://extensions`, bật **Developer mode**
5. Chọn **Load unpacked** → chọn thư mục `.output/chrome-mv3/`

### Chạy ở chế độ development (HMR)

```bash
npm run dev
```

Extension sẽ tự động load lại khi có thay đổi.

## Hướng dẫn sử dụng

### Chat cơ bản

1. Click icon extension trên thanh công cụ → sidebar mở ra bên phải
2. Nhập tin nhắn vào ô chat → nhấn Enter hoặc click nút gửi
3. AI phản hồi theo thời gian thực (streaming)

### Chọn text để xử lý

1. Bôi đen văn bản trên bất kỳ trang web nào
2. Toolbar nổi xuất hiện với các tùy chọn: Tóm tắt, Giải thích, Dịch
3. Chọn thao tác → kết quả hiển thị trong sidebar

### Đọc & tóm tắt trang

1. Mở sidebar → click nút **Read Page**
2. Extension tự động trích xuất nội dung chính của trang
3. Chọn: Tóm tắt trang, Hỏi đáp về nội dung, hoặc chat tự do

### Quản lý prompt

1. Vào Settings → Prompt Manager
2. Tạo prompt mới với tiêu đề và nội dung mẫu
3. Sắp xếp theo thư mục hoặc gắn nhãn
4. Dùng prompt mẫu khi chat để tiết kiệm thời gian

## Cấu hình AI Provider

1. Mở sidebar → click icon Settings (⚙️)
2. Chọn tab **AI Provider**
3. Chọn provider từ danh sách: OpenAI, OpenCode, CommandCode, LMStudio
4. Nhập API key tương ứng
5. Chọn model mong muốn (danh sách model được tải tự động)
6. (Tùy chọn) Cấu hình thêm: base URL, extra parameters

> ⚠️ API Key được lưu trữ cục bộ trong `chrome.storage.local` — không bao giờ gửi đến server nào ngoài AI provider bạn chọn.

## Phát triển

Xem [AGENTS.md](./AGENTS.md) và [docs/modules/README.md](./docs/modules/README.md) để hiểu kiến trúc và quy ước code.

## License

MIT
