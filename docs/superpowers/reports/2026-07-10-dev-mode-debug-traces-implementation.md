# Báo cáo Triển khai Chế độ Developer Mode Debug Traces

Báo cáo chi tiết về kết quả thiết kế và triển khai tính năng **Developer Mode Debug Traces** cho tiện ích mở rộng Chrome Sidebar (Personal AI Sidebar).

---

## 1. Tổng quan
Tính năng **Developer Mode** cung cấp cho nhà phát triển khả năng theo dõi luồng dữ liệu thời gian thực (real-time stream traces) của mô hình AI (bao gồm reasoning steps, token usage, durations, và TTFT) cũng như vết thực thi của các công cụ nền tảng (như trích xuất trang web, chuyển tiếp vùng chọn, mở Reader). Tính năng này hoạt động theo mô hình BYOK (Bring Your Own Key) và chạy hoàn toàn dưới local thông qua kiến trúc hướng sự kiện/cổng kết nối (port-based streaming).

---

## 2. Chi tiết các công việc đã thực hiện

### Tác vụ 1: Định nghĩa Hợp đồng Vết & Localized Copy
- Tạo file [types.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/devtools/types.ts) định nghĩa các cấu trúc dữ liệu vết: `AiDevTrace` (cho AI completion) và `ToolDevTrace` (cho các tác vụ chạy nền).
- Tạo file [copy.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/devtools/copy.ts) chứa toàn bộ chuỗi hiển thị tiếng Việt dành riêng cho Developer Mode, cô lập hoàn toàn các chuỗi ký tự hiển thị khỏi component UI.

### Tác vụ 2: Parser Luồng SSE & Trình rút gọn trạng thái (Trace Reducer)
- Phát triển module [stream.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/devtools/stream.ts) tách biệt dữ liệu content, reasoning delta, usage, và finish reasons từ luồng Server-Sent Events (SSE).
- Xây dựng trình rút gọn bất biến [trace-reducer.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/devtools/trace-reducer.ts) xử lý các transition của trạng thái trace khi luồng đang tải.
- Đã được bao phủ bởi các bài test độc lập (`stream.test.ts` & `trace-reducer.test.ts`).

### Tác vụ 3: Nâng cấp Schema bộ nhớ lên v5
- Nâng cấp phiên bản bộ nhớ local lên `schemaVersion = 5` trong [migrations.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/storage/migrations.ts).
- Đảm bảo giữ nguyên các cấu hình cũ (như `thinkingMode`) hợp lệ và di chuyển khóa cấu hình mới `devMode: false` một cách an toàn.

### Tác vụ 4: Nút Bật/Tắt chế độ Dev Mode tại Cài đặt
- Thêm checkbox điều khiển Dev Mode vào [SettingsPanel.tsx](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/entrypoints/sidepanel/components/SettingsPanel.tsx).
- Tách nhãn khỏi phần mô tả trợ giúp để bộ chọn nhãn (`screen.getByLabelText`) trong kiểm thử khớp chính xác với bản dịch tiếng Việt.

### Tác vụ 5: Khởi tạo Runtime Params & Cấu hình OpenAI Stream
- Tích hợp cấu hình `devMode` vào hàm giải quyết tham số runtime trong [runtime.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/ai/runtime.ts).
- Thiết lập tự động truyền tham số `{ stream_options: { include_usage: true } }` chỉ dành riêng cho OpenAI khi Dev Mode được kích hoạt.

### Tác vụ 6: Thêm các Callbacks phụ trợ vào Client Completion
- Nâng cấp hàm `streamChatCompletion` trong [client.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/ai/client.ts) nhận thêm các callback quan sát: `onReasoningDelta`, `onUsage`, và `onFinishReason`.
- Thiết lập cơ chế xóa bộ hẹn giờ watchdog (Watchdog Timer) ngay khi nhận được token nội dung hoặc reasoning đầu tiên.

### Tác vụ 7: Định nghĩa Port Message Contracts cho vết Debug
- Mở rộng các cổng `AiPortRequest` và `AiPortResponse` trong [types.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/messaging/types.ts) để truyền phát các gói tin debug: `AI_STREAM_DEBUG_START`, `AI_STREAM_REASONING`, và `AI_STREAM_DEBUG_UPDATE`.

### Tác vụ 8: Phát vết AI từ Background Service Worker
- Thiết lập hàm quản lý và phát vết `createAiPortTraceEmitter` trong [background-trace.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/devtools/background-trace.ts).
- Tích hợp bộ phát này vào trình lắng nghe kết nối cổng AI Stream trong [background.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/entrypoints/background.ts).

### Tác vụ 9: Ghi nhận vết Tool & Dọn dẹp Handoff ở Background
- Tích hợp thu thập vết thực thi cho tác vụ đọc trang (`EXTRACT_ACTIVE_PAGE`) và chuyển tiếp vùng chọn (`SELECTION_ACTION`).
- Triển khai bộ kiểm soát handoff Reader với thời gian chờ 10 giây (`READER_HANDOFF_TIMEOUT_MS`). Bảo đảm loại bỏ trình lắng nghe sự kiện `readerReady` ở mọi kịch bản (khi thành công, thất bại, hoặc quá thời gian chờ).

### Tác vụ 10: Xây dựng các Component Debug tái sử dụng
- **`DebugDetails`** ([DebugDetails.tsx](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/devtools/components/DebugDetails.tsx)): Hiển thị chi tiết vết AI (tham số yêu cầu, nội dung suy nghĩ suy luận có nút sao chép nhanh, thông số token đã tiêu thụ).
- **`ToolTraceCard`** ([ToolTraceCard.tsx](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/devtools/components/ToolTraceCard.tsx)): Hiển thị các tham số metadata dạng phẳng của tác vụ nền.

### Tác vụ 11: Tích hợp vết Debug vào Timeline Chat của Sidepanel
- Thay đổi cấu trúc danh sách tin nhắn của Sidepanel từ danh sách phẳng sang luồng Timeline kết hợp nhiều kiểu đối tượng (`ChatTimelineItem`), phân tách giữa tin nhắn thường (`ChatMessageItem`) và vết hoạt động nền (`ToolTraceCard`).
- Nâng cấp `useChatController.ts` để xử lý các gói tin sự kiện debug phát ra từ cổng stream và cập nhật vết AI tương ứng.
- Thiết lập hành vi cho nút đọc trang (`readPage`) hiển thị trạng thái đang xử lý (`pending` trace) và chuyển đổi thành trace thành công/thất bại khi trích xuất kết thúc.

### Tác vụ 12: Hiển thị Vết định tuyến vùng chọn tại Cửa sổ Nổi
- Truyền vết định tuyến `toolTrace` từ content script chuyển tiếp đến [FloatingWindow.tsx](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/floating-window/FloatingWindow.tsx).
- Cấu hình cho cổng kết nối của `FloatingWindow` lắng nghe các gói tin debug (`AI_STREAM_DEBUG_START`, `AI_STREAM_REASONING`, `AI_STREAM_DEBUG_UPDATE`, `AI_STREAM_DONE`) và cập nhật trạng thái `aiTrace` cục bộ khi Dev Mode được kích hoạt.
- Mount component `DebugDetails` ở phía cuối phần thân cửa sổ nổi để hiển thị đầy đủ thông số stream AI (suy nghĩ reasoning, token, TTFT).
- Inject tập hợp các lớp CSS Tailwind mở rộng bổ sung phục vụ cho component `DebugDetails` vào Shadow DOM trong [mount.ts](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/src/lib/floating-window/mount.ts) để hiển thị đồng bộ giao diện thiết kế mà không phá vỡ sự cô lập CSS của trang chủ.


### Tác vụ 13: Hiển thị Vết tại Reading Companion
- Nâng cấp [App.tsx](file:///Users/duynguyen/MyProject/extentions/my_sider_extention/entrypoints/reader/App.tsx) của trang đọc sách để bắt thông điệp lỗi tải `LOAD_READER_ERROR`.
- Hiển thị thông số vết trích xuất trang web ở ngay đầu của trang nội dung đọc hoặc phía dưới màn hình lỗi handoff.

### Tác vụ 14: Đánh giá & Kiểm thử thành phẩm
- Biên dịch không có lỗi cú pháp hoặc kiểu dữ liệu (`npm run compile`).
- Hoàn thành viết các bộ kiểm thử tự động, tích hợp thành công nâng tổng số ca kiểm thử lên **142 tests** và tất cả đều vượt qua (100% Green).

---

## 3. Kết quả Kiểm thử & Đóng gói sản phẩm

### Kết quả chạy kiểm thử tự động (Vitest)
```sh
npm run compile
# > tsc --noEmit
# SUCCESS (0 errors)

npx vitest run
# Test Files  28 passed (28)
# Tests       142 passed (142)
# Duration    3.68s
# SUCCESS (100% Passed)
```

### Kết quả Đóng gói Tiện ích mở rộng (WXT Build)
- **Chrome MV3 Build**: Đóng gói thành công tại thư mục `.output/chrome-mv3/` trong **579 ms**.
- **Firefox MV2 Build**: Đóng gói thành công tại thư mục `.output/firefox-mv2/` trong **525 ms**.

---

## 4. Phân tích Rủi ro & Hướng xử lý (Risk & Mitigation)

Trong quá trình thiết kế, các kịch bản rủi ro về kết nối và bộ nhớ đã được phân tích và xử lý triệt để:

| Kịch bản Rủi ro | Tác động | Hướng xử lý & Giải pháp ngăn ngừa |
| :--- | :--- | :--- |
| **Mất kết nối mạng đột ngột / Port bị đứt** | Rò rỉ cổng kết nối, trạng thái UI bị treo ở chế độ loading. | Hệ thống sử dụng bộ lắng nghe `port.onDisconnect` trên cả background và sidepanel để ngay lập tức dọn dẹp các tài nguyên liên quan, giải phóng cổng kết nối và chuyển UI về trạng thái an toàn kèm thông báo lỗi thân thiện. |
| ** watchdogs timeout không đồng bộ** | Trạng thái watchdog timer của luồng stream chạy vô hạn trong khi request thực tế đã bị hủy. | Cơ chế Watchdog Timer được kích hoạt với giới hạn 30s. Việc nhận được reasoning delta đầu tiên hoặc content delta đầu tiên sẽ lập tức giải phóng timer này thông qua hàm `markFirstActivity()`. |
| **Trùng lặp listener handoff Reader** | Background service worker tạo ra nhiều listener lắng nghe cổng Reader gây tràn bộ nhớ. | Trình lắng nghe `READER_CONTENT_READY` được dọn dẹp chủ động bằng hàm `cleanupHandoff()` trong tất cả các nhánh rẽ: Hoàn thành thành công, Xảy ra lỗi trích xuất, hoặc Quá thời gian chờ (10s). |
| **Tần suất re-render UI quá cao** | Stream reasoning delta đổ về liên tục làm đơ/lác giao diện Sidepanel. | Áp dụng kỹ thuật **Throttling/Batching** (100ms) trong `useChatController` để gộp các update delta và cập nhật state React một cách định kỳ, giảm số lượng render không cần thiết mà vẫn giữ giao diện mượt mà. |

---

## 5. Kết luận
Chế độ **Developer Mode** đã được tích hợp toàn diện trên mọi bề mặt giao diện chính của tiện ích mở rộng (Sidepanel Chat, Floating Selection Window, và Reader Companion) với cấu trúc dữ liệu vết an toàn, quản lý kết nối tin cậy và hiệu năng đóng gói tối ưu.
