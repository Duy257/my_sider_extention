import { render, screen } from "@testing-library/react";
import { SavedResults } from "../entrypoints/sidepanel/components/SavedResults";
import type { SavedResult } from "../src/lib/storage/types";
import { expect, test, vi } from "vitest";

const mockResults: SavedResult[] = [
  { id: "1", title: "Saved Analysis", sourceType: "chat", outputMarkdown: "This is a saved analysis", createdAt: "2026-01-01T00:00:00Z" }
];

test("renders saved results cards", () => {
  render(<SavedResults results={mockResults} onDelete={() => {}} />);
  expect(screen.getByText("Saved Analysis")).toBeInTheDocument();
});

test("shows empty state when no results", () => {
  render(<SavedResults results={[]} onDelete={() => {}} />);
  expect(screen.getByText("Chưa có kết quả nào.")).toBeInTheDocument();
});
