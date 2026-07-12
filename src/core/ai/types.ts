// === KIỂU DỮ LIỆU CHUNG CHO AI MODULE ===

// Vai trò của tin nhắn trong hội thoại: hệ thống, người dùng, hoặc trợ lý
export type AiRole = "system" | "user" | "assistant";

// Cấu trúc một tin nhắn trong hội thoại AI
export type AiMessage = {
  role: AiRole;      // vai trò của người gửi tin nhắn
  content: string;   // nội dung tin nhắn dạng văn bản
};

// Các loại chunk dữ liệu khi nhận stream từ AI provider
export type AiStreamChunk =
  | { type: "chunk"; delta: string }   // một phần nội dung text được stream về
  | { type: "done" }                    // stream đã kết thúc thành công
  | { type: "error"; message: string }; // có lỗi xảy ra trong quá trình stream
