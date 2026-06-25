import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptManager } from "../entrypoints/sidepanel/components/PromptManager";
import type { PromptTemplate } from "../src/lib/prompts/types";
import { expect, test, vi } from "vitest";

const mockPrompts: PromptTemplate[] = [
  { id: "1", name: "Test Prompt", instruction: "Analyze this", category: "custom", sortOrder: 0, createdAt: "", updatedAt: "" }
];

test("renders prompt cards and add button", () => {
  render(<PromptManager prompts={mockPrompts} onChange={() => {}} />);
  expect(screen.getByText("Test Prompt")).toBeInTheDocument();
  expect(screen.getByText("Thêm mẫu lệnh")).toBeInTheDocument();
});

test("adds a new prompt on button click", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<PromptManager prompts={[]} onChange={onChange} />);

  await user.click(screen.getByText("Thêm mẫu lệnh"));
  expect(onChange).toHaveBeenCalledOnce();
});
