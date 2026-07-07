import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

test("copies message content and shows feedback", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });

  render(<ChatMessage role="assistant" content="Nội dung cần sao chép" />);

  await user.click(screen.getByTitle("Sao chép"));

  expect(writeText).toHaveBeenCalledWith("Nội dung cần sao chép");
  expect(await screen.findByText("Đã sao chép")).toBeInTheDocument();
});

test("shows saved feedback only after save resolves", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn(() => Promise.resolve());

  render(<ChatMessage role="assistant" content="Response" onSave={onSave} />);

  await user.click(screen.getByTitle("Lưu"));

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("Đã lưu")).toBeInTheDocument();
});
