import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import App from "../entrypoints/sidepanel/App";
import { portEntries } from "./setup";

beforeEach(() => {
  vi.clearAllMocks();
  portEntries.splice(0, portEntries.length);
  (chrome.runtime as any).lastError = undefined;
  Element.prototype.scrollIntoView = vi.fn();
});

test("renders the sidebar after settings load", async () => {
  render(<App />);

  expect(await screen.findByText(/Thêm khóa API cho OpenAI/)).toBeInTheDocument();
});

test("does not request a pending selection prompt on startup", async () => {
  render(<App />);

  await screen.findByText(/Thêm khóa API cho OpenAI/);

  expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "GET_PENDING_SELECTION_PROMPT" }));
});


test("chat mới clears messages and cancels an active stream", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText(/Thêm khóa API cho OpenAI/);

  await user.click(screen.getByTitle("Cài đặt"));
  await user.type(screen.getByLabelText("Khóa API"), "sk-test");
  await user.click(screen.getByText("AI Cá Nhân"));
  await user.type(screen.getByPlaceholderText("Hỏi về công việc của bạn..."), "Xin chào");
  await user.click(screen.getByTitle("Gửi"));

  const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
  expect(await screen.findByText("Xin chào")).toBeInTheDocument();

  await user.click(screen.getByTitle("Chat mới"));

  expect(port.disconnect).toHaveBeenCalled();
  expect(screen.queryByText("Xin chào")).not.toBeInTheDocument();
});



