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

const SELECTION_SYSTEM_MESSAGE = `Bạn là trợ lý AI cá nhân trong trình duyệt.

Nguyên tắc chung:
- Bám sát đoạn văn bản người dùng cung cấp.
- Trả lời bằng tiếng Việt.
- Rõ ràng, thực tế, dễ dùng ngay.
- Không bịa thêm dữ kiện, số liệu, nguồn hoặc kết luận không có trong văn bản.
- Nếu đoạn văn thiếu ngữ cảnh, hãy nêu rõ điểm chưa chắc chắn.`;

const SELECTION_INSTRUCTIONS: Record<SelectionAction, string> = {
  explain: `
Hãy giải thích đoạn văn bản này một cách rõ ràng, dễ hiểu và thực tế.

Trả lời theo cấu trúc:
1. Nghĩa đơn giản
2. Ý chính
3. Vì sao quan trọng
4. Điểm cần chú ý

Không thêm thông tin ngoài đoạn văn.
`.trim(),

  translate_vi: `
Hãy dịch đoạn văn bản này sang tiếng Việt tự nhiên, đúng ngữ cảnh.

Yêu cầu:
- Giữ nguyên ý nghĩa và giọng văn.
- Không dịch máy móc từng chữ.
- Giữ nguyên tên riêng, thương hiệu, số liệu, mã kỹ thuật nếu có.
- Chỉ trả về bản dịch, không giải thích thêm.
`.trim(),

  rewrite_professional: `
Hãy viết lại đoạn văn bản này chuyên nghiệp, rõ ràng và súc tích hơn.

Yêu cầu:
- Giữ nguyên ý chính.
- Không thêm thông tin hoặc cam kết mới.
- Câu văn mạch lạc, phù hợp môi trường công việc/kinh doanh.

Trả lời theo cấu trúc:
1. Bản viết lại
2. Ghi chú chỉnh sửa ngắn gọn
`.trim(),

  summarize: `
Hãy tóm tắt đoạn văn bản này thành những điểm quan trọng nhất.

Trả lời theo cấu trúc:
1. Tóm tắt nhanh
2. Ý chính
3. Điều cần lưu ý

Không thêm ý ngoài văn bản gốc.
`.trim(),

  action_list: `
Hãy chuyển đoạn văn bản này thành danh sách hành động rõ ràng.

Trả lời theo cấu trúc:
1. Mục tiêu
2. Danh sách việc cần làm
3. Ưu tiên
4. Kết quả đầu ra mong muốn

Mỗi việc cần bắt đầu bằng động từ hành động.
`.trim(),
};

export function buildUserChatMessages(input: string): AiMessage[] {
  return [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: input },
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
    input.text,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSelectionPrompt(
  action: SelectionAction,
  text: string,
): string {
  const safeText = text?.trim();

  return `
${SELECTION_SYSTEM_MESSAGE}

Nhiệm vụ:
${SELECTION_INSTRUCTIONS[action]}

Đoạn văn bản:
"""
${safeText || "Không có nội dung được cung cấp."}
"""
`.trim();
}
