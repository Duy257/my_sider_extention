export type PromptCategory =
  | "general"
  | "ceo"
  | "dev"
  | "legal"
  | "sales"
  | "marketing"
  | "custom";

export type PromptTemplate = {
  id: string;
  name: string;
  instruction: string;
  category: PromptCategory;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
