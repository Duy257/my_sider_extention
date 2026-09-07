// === HẰNG SỐ DÙNG CHUNG TOÀN ỨNG DỤNG ===
// Tập trung các magic numbers / chuỗi khóa để tránh lặp và sai sót khi sửa.

// Khóa lưu trữ trên chrome.storage.local
export const STORAGE_KEYS = {
  SETTINGS: "settings",
  PROMPTS: "promptTemplates",
  SAVED_RESULTS: "savedResults",
} as const;

// Giới hạn khi chọn văn bản trên trang
export const SELECTION_LIMITS = {
  MIN_CHARS: 3,
  MAX_CHARS: 20_000,
} as const;

// Giới hạn khi trích xuất nội dung trang
export const EXTRACTION_LIMITS = {
  MAX_CONTEXT_CHARS: 40_000,
} as const;

// Các khoảng thời gian timeout (ms)
export const TIMEOUTS = {
  SETTINGS_CACHE_TTL: 5_000,
  READER_HANDOFF: 10_000,
  AI_REQUEST: 20_000,
  AI_FIRST_TOKEN: 30_000,
} as const;

// Cấu hình chat / stream
export const CHAT_SETTINGS = {
  MAX_HISTORY_MESSAGES: 12,
  STREAM_FLUSH_MS: 100,
  ERROR_DISMISS_MS: 8_000,
} as const;

// Tên custom DOM event dùng nội bộ
export const EVENTS = {
  READER_ASK_MORE: "reader-ask-more",
} as const;

// Thông báo lỗi kết nối dùng chung cho các luồng stream AI
export const AI_CONNECT_ERROR = "Không thể kết nối dịch vụ AI.";
