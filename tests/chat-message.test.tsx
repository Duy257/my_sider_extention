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

test("renders DebugDetails only when debug trace is present in assistant message", () => {
  const debugTrace = {
    requestId: "req-1",
    surface: "sidepanel" as const,
    feature: "chat" as const,
    status: "success" as const,
    providerId: "openai",
    model: "gpt-4o",
    requestedThinkingMode: "off" as const,
    effectiveRequestParams: {},
    startedAt: 1000,
    thinking: { state: "not-returned" as const, content: "" }
  };

  const { rerender } = render(<ChatMessage role="assistant" content="Response" />);
  expect(screen.queryByText(/DEV/)).not.toBeInTheDocument();

  rerender(<ChatMessage role="assistant" content="Response" debug={debugTrace} />);
  expect(screen.getByText(/DEV/)).toBeInTheDocument();
});

test("shows the thinking indicator inside an empty pending assistant message without action buttons", () => {
  render(<ChatMessage role="assistant" content="" pendingPhase="thinking" onSave={() => {}} />);

  expect(screen.getByText("đang suy nghĩ...")).toBeInTheDocument();
  expect(screen.queryByTitle("Sao chép")).not.toBeInTheDocument();
  expect(screen.queryByTitle("Lưu")).not.toBeInTheDocument();
});

test("labels each pending phase", () => {
  const { rerender } = render(<ChatMessage role="assistant" content="" pendingPhase="connecting" />);
  expect(screen.getByText("đang kết nối...")).toBeInTheDocument();

  rerender(<ChatMessage role="assistant" content="" pendingPhase="streaming" />);
  expect(screen.getByText("đang trả lời...")).toBeInTheDocument();
});

test("renders nothing for an empty assistant message that is not pending and has no trace", () => {
  const { container } = render(<ChatMessage role="assistant" content="" />);
  expect(container).toBeEmptyDOMElement();
});

test("passes the message content to onSave", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn(() => Promise.resolve());

  render(<ChatMessage role="assistant" content="Nội dung lưu" onSave={onSave} />);
  await user.click(screen.getByTitle("Lưu"));

  expect(onSave).toHaveBeenCalledWith("Nội dung lưu");
});
