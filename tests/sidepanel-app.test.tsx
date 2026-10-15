import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "../entrypoints/sidepanel/App";
import { portEntries } from "./setup";

beforeEach(() => {
  vi.clearAllMocks();
  portEntries.splice(0, portEntries.length);
  (chrome.runtime as any).lastError = undefined;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  // Gỡ các thuộc tính cuộn giả lập trên document
  for (const key of ["scrollHeight", "clientHeight", "scrollTop"]) {
    delete (document.documentElement as unknown as Record<string, unknown>)[key];
  }
});

// Nhập API key rồi gửi một prompt; trả về port và requestId của stream
async function sendFirstPrompt(user: ReturnType<typeof userEvent.setup>, text: string) {
  await screen.findByText(/Thêm khóa API cho OpenAI/);
  await user.click(screen.getByTitle("Cài đặt"));
  await user.type(screen.getByLabelText("Khóa API"), "sk-test");
  await user.click(screen.getByText("AI Cá Nhân"));
  return sendPrompt(user, text);
}

async function sendPrompt(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByPlaceholderText("Hỏi về công việc của bạn..."), text);
  await user.click(screen.getByTitle("Gửi"));
  const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value;
  const requestId: string = port.postMessage.mock.calls[0][0].requestId;
  const entry = portEntries[portEntries.length - 1];
  const emit = (message: Record<string, unknown>) =>
    act(() => entry.onMessage.trigger({ requestId, ...message }));
  return { port, requestId, emit };
}

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




test("keeps a stop button after the first token and cancels the stream with it", async () => {
  const user = userEvent.setup();
  render(<App />);
  const { port, emit } = await sendFirstPrompt(user, "Giải thích");

  expect(screen.getByText("đang kết nối...")).toBeInTheDocument();
  emit({ type: "AI_STREAM_FIRST_TOKEN", kind: "reasoning" });
  expect(screen.getByText("đang suy nghĩ...")).toBeInTheDocument();
  expect(screen.getByTitle("Dừng")).toBeInTheDocument();

  emit({ type: "AI_STREAM_CHUNK", delta: "Một phần" });
  await user.click(screen.getByTitle("Dừng"));

  expect(port.disconnect).toHaveBeenCalled();
  expect(screen.getByText("Một phần")).toBeInTheDocument();
  expect(screen.getByTitle("Gửi")).toBeInTheDocument();
});

test("only auto-scrolls while the user stays near the bottom", async () => {
  const user = userEvent.setup();
  render(<App />);
  const first = await sendFirstPrompt(user, "Câu một");
  const scrollIntoView = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

  // Người dùng cuộn lên đọc tin cũ
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 3000 });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 600 });
  Object.defineProperty(document.documentElement, "scrollTop", { configurable: true, writable: true, value: 100 });
  fireEvent.scroll(window);
  scrollIntoView.mockClear();

  first.emit({ type: "AI_STREAM_CHUNK", delta: "Đoạn mới" });
  first.emit({ type: "AI_STREAM_DONE" });
  expect(scrollIntoView).not.toHaveBeenCalled();

  // Gửi tin mới thì luôn kéo về đáy
  await sendPrompt(user, "Câu hai");
  expect(scrollIntoView).toHaveBeenCalled();
});
