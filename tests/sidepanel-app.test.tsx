import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import App from "../entrypoints/sidepanel/App";
import { portEntries } from "./setup";

beforeEach(() => {
  vi.clearAllMocks();
  portEntries.splice(0, portEntries.length);
  chrome.runtime.lastError = undefined;
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

test("read page uses the shared page prompt path", async () => {
  const user = userEvent.setup();
  vi.mocked(chrome.runtime.sendMessage).mockImplementation((message) => {
    if (message?.type === "EXTRACT_ACTIVE_PAGE") {
      return Promise.resolve({
        title: "Báo cáo",
        url: "https://example.com/report",
        text: "Nội dung quan trọng",
        warnings: ["Nội dung trang bị cắt bớt còn 40,000 ký tự."]
      });
    }
    return Promise.resolve(null);
  });

  render(<App />);
  await screen.findByText(/Thêm khóa API cho OpenAI/);

  await user.click(screen.getByTitle("Cài đặt"));
  await user.type(screen.getByLabelText("Khóa API"), "sk-test");
  await user.click(screen.getByTitle("Đọc trang"));

  await waitFor(() => expect(chrome.runtime.connect).toHaveBeenCalled());
  const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
  const payload = port.postMessage.mock.calls[0][0];

  expect(payload.messages.at(-1).content).toContain("Đọc trang này và tóm tắt từ góc nhìn CEO.");
  expect(payload.messages.at(-1).content).toContain("Tiêu đề: Báo cáo");
  expect(payload.messages.at(-1).content).toContain("URL: https://example.com/report");
  expect(payload.messages.at(-1).content).toContain("Nội dung trang:");
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
