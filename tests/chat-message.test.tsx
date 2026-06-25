import { render, screen } from "@testing-library/react";
import { ChatMessage } from "../entrypoints/sidepanel/components/ChatMessage";
import { expect, test, vi } from "vitest";

test("renders user message right-aligned with primary bg", () => {
  const { container } = render(<ChatMessage role="user" content="Hello" />);
  const msg = container.querySelector(".rounded-2xl");
  expect(msg).toBeInTheDocument();
  expect(msg!.className).toContain("bg-primary");
});

test("renders AI message left-aligned with avatar", () => {
  render(<ChatMessage role="assistant" content="Hi there" />);
  expect(screen.getByText("Hi there")).toBeInTheDocument();
});

test("shows save button for assistant messages", () => {
  render(<ChatMessage role="assistant" content="Response" onSave={() => {}} />);
  expect(screen.getByTitle("Lưu")).toBeInTheDocument();
});

test("hides save button for user messages", () => {
  render(<ChatMessage role="user" content="Hello" onSave={() => {}} />);
  expect(screen.queryByTitle("Lưu")).not.toBeInTheDocument();
});
