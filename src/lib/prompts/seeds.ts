import type { PromptTemplate } from "./types";

export function createSeedPromptTemplates(now: string): PromptTemplate[] {
  return [
    {
      id: "seed-ceo-rewrite",
      name: "CEO rewrite",
      instruction: "Rewrite in CEO style: clear, firm, no exaggeration.",
      category: "ceo",
      sortOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-problem-cause-solution",
      name: "Problem Cause Solution",
      instruction: "Summarize as table: Problem - Cause - Solution.",
      category: "general",
      sortOrder: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-operations-analysis",
      name: "Operations analysis",
      instruction: "Analyze from a business operations perspective.",
      category: "ceo",
      sortOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-action-plan",
      name: "Action plan",
      instruction: "Turn this content into an action plan.",
      category: "general",
      sortOrder: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-senior-dev-review",
      name: "Senior dev review",
      instruction: "Review technical errors as a senior developer.",
      category: "dev",
      sortOrder: 4,
      createdAt: now,
      updatedAt: now
    }
  ];
}
