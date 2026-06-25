import type { AiMessage } from "../ai/types";
import type { SelectionAction } from "../selection/types";

export type PagePromptInput = {
  title: string;
  url: string;
  text: string;
  warnings: string[];
};

const SYSTEM_MESSAGE =
  "Bạn là trợ lý AI cá nhân, chuyên giúp đọc hiểu, viết lại, phân tích và biến nội dung trình duyệt thành hành động. Ưu tiên cấu trúc thực tế và các bước rõ ràng.";

export function buildUserChatMessages(input: string): AiMessage[] {
  return [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: input }
  ];
}

export function buildPagePrompt(input: PagePromptInput): string {
  const warningText = input.warnings.length
    ? `\nCảnh báo: ${input.warnings.join(" ")} Chỉ dùng một phần nội dung trang khi cần.\n`
    : "";

  return [
    "Đọc trang này và tóm tắt từ góc nhìn CEO.",
    "",
    `Tiêu đề: ${input.title}`,
    `URL: ${input.url}`,
    warningText.trim(),
    "Trả về:",
    "1. Điểm chính",
    "2. Cơ hội áp dụng",
    "3. Rủi ro triển khai",
    "4. Hành động ngay",
    "",
    "Nội dung trang:",
    input.text
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSelectionPrompt(action: SelectionAction, text: string): string {
  const instructions: Record<SelectionAction, string> = {
    explain: "Giải thích đoạn văn bản này một cách rõ ràng và thực tế.",
    translate_vi: "Dịch đoạn văn bản này sang tiếng Việt, giữ nguyên ý nghĩa và giọng văn.",
    rewrite_professional: "Viết lại đoạn văn bản này chuyên nghiệp hơn. Giữ súc tích và dễ đọc.",
    summarize: "Tóm tắt đoạn văn bản này thành những điểm quan trọng nhất.",
    action_list: "Chuyển đoạn văn bản này thành danh sách bullet/action list với các bước rõ ràng."
  };

  return `${instructions[action]}\n\nĐoạn văn bản:\n${text}`;
}
