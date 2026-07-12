import type { PromptTemplate } from "./types";

export function createSeedPromptTemplates(now: string): PromptTemplate[] {
  return [
    {
      id: "seed-ceo-rewrite",
      name: "Viết lại phong cách CEO",
      instruction: "Viết lại theo phong cách CEO: rõ ràng, dứt khoát, không cường điệu.",
      category: "ceo",
      sortOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-problem-cause-solution",
      name: "Vấn đề - Nguyên nhân - Giải pháp",
      instruction: "Tóm tắt thành bảng: Vấn đề - Nguyên nhân - Giải pháp.",
      category: "general",
      sortOrder: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-operations-analysis",
      name: "Phân tích vận hành",
      instruction: "Phân tích từ góc nhìn vận hành doanh nghiệp.",
      category: "ceo",
      sortOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-action-plan",
      name: "Kế hoạch hành động",
      instruction: "Biến nội dung này thành kế hoạch hành động.",
      category: "general",
      sortOrder: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-senior-dev-review",
      name: "Senior dev đánh giá code",
      instruction: "Đánh giá lỗi kỹ thuật dưới góc nhìn senior developer, đưa ra giải pháp cụ thể.",
      category: "dev",
      sortOrder: 4,
      createdAt: now,
      updatedAt: now
    }
  ];
}
