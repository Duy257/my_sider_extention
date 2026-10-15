import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import App from "../entrypoints/sidepanel/App";
import { portEntries } from "./setup";

// Đếm số lần MessageContent render theo nội dung, thay cho việc parse markdown thật
const renderCounts = new Map<string, number>();

vi.mock("../src/components/chat/MessageContent.tsx", () => ({
  MessageContent: ({ content }: { content: string }) => {
    renderCounts.set(content, (renderCounts.get(content) ?? 0) + 1);
    return <span>{content}</span>;
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
  portEntries.splice(0, portEntries.length);
  renderCounts.clear();
  (chrome.runtime as any).lastError = undefined;
  Element.prototype.scrollIntoView = vi.fn();
});

async function sendPrompt(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByPlaceholderText("Hỏi về công việc của bạn..."), text);
  await user.click(screen.getByTitle("Gửi"));
  const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value;
  const requestId: string = port.postMessage.mock.calls[0][0].requestId;
  const entry = portEntries[portEntries.length - 1];
  return (message: Record<string, unknown>) => act(() => entry.onMessage.trigger({ requestId, ...message }));
}

test("a finished assistant message is not re-rendered while the next one streams", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText(/Thêm khóa API cho OpenAI/);
  await user.click(screen.getByTitle("Cài đặt"));
  await user.type(screen.getByLabelText("Khóa API"), "sk-test");
  await user.click(screen.getByText("AI Cá Nhân"));

  const emitFirst = await sendPrompt(user, "Câu một");
  emitFirst({ type: "AI_STREAM_CHUNK", delta: "Trả lời một" });
  emitFirst({ type: "AI_STREAM_DONE" });
  const rendersAfterFirst = renderCounts.get("Trả lời một");
  expect(rendersAfterFirst).toBeGreaterThan(0);

  const emitSecond = await sendPrompt(user, "Câu hai");
  emitSecond({ type: "AI_STREAM_FIRST_TOKEN", kind: "text" });
  for (let i = 0; i < 20; i++) {
    emitSecond({ type: "AI_STREAM_CHUNK", delta: `phần ${i} ` });
    emitSecond({ type: "AI_STREAM_DEBUG_UPDATE", finishReason: "stop" });
  }
  emitSecond({ type: "AI_STREAM_DONE" });

  expect(screen.getByText(/phần 19/)).toBeInTheDocument();
  expect(renderCounts.get("Trả lời một")).toBe(rendersAfterFirst);
});
