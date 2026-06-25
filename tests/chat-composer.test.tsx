import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatComposer } from "../entrypoints/sidepanel/components/ChatComposer";
import { expect, test, vi } from "vitest";

test("renders textarea and send button", () => {
  render(<ChatComposer disabled={false} onSend={() => {}} />);
  expect(screen.getByPlaceholderText("Hỏi về công việc của bạn...")).toBeInTheDocument();
});

test("send button disabled when disabled prop is true", () => {
  render(<ChatComposer disabled={true} onSend={() => {}} />);
  expect(screen.getByTitle("Gửi")).toBeDisabled();
});

test("calls onSend with textarea content on submit", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  render(<ChatComposer disabled={false} onSend={onSend} />);

  const textarea = screen.getByPlaceholderText("Hỏi về công việc của bạn...");
  await user.type(textarea, "Hello");

  const button = screen.getByTitle("Gửi");
  await user.click(button);

  expect(onSend).toHaveBeenCalledWith("Hello");
});

test("missing key banner visible when showMissingKeyBanner is true", () => {
  render(<ChatComposer disabled={true} onSend={() => {}} showMissingKeyBanner={true} />);
  expect(screen.getByText(/Thêm khóa API/)).toBeInTheDocument();
});
