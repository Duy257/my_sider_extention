// === XỬ LÝ LỖI STREAM AI ===

// Ánh xạ các lỗi phát sinh trong quá trình stream sang thông báo thân thiện với người dùng
// Trả về chuỗi rỗng nếu lỗi do người dùng hủy (AbortError)
export function mapStreamError(error: unknown): string {
  // Người dùng chủ động hủy request — không cần thông báo lỗi
  if (error instanceof DOMException && error.name === "AbortError") return "";
  // Request timeout — provider quá chậm hoặc không khả dụng
  if (error instanceof DOMException && error.name === "TimeoutError") return "Request timed out. The provider is too slow or unreachable.";
  // Lỗi mạng — kiểm tra kết nối internet
  if (error instanceof TypeError) return "Network error. Check your internet connection.";
  // Dữ liệu trả về không đúng định dạng
  if (error instanceof SyntaxError) return "Received malformed data from the AI provider.";
  // Các lỗi Error thông thường — lấy message gốc
  if (error instanceof Error && error.message.trim()) return error.message;
  // Lỗi không xác định — hướng dẫn chung
  return "AI request failed. Check your API key, model, network, and quota.";
}
