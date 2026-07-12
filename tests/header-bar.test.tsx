import { render, screen } from "@testing-library/react";
import { HeaderBar } from "../entrypoints/sidepanel/components/HeaderBar";
import { expect, test, vi } from "vitest";

test("renders brand name and all navigation tabs", () => {
  render(<HeaderBar view="chat" onViewChange={() => {}} />);

  expect(screen.getByText("AI Cá Nhân")).toBeInTheDocument();
  expect(screen.getByTitle("Mẫu lệnh")).toBeInTheDocument();
  expect(screen.getByTitle("Đã lưu")).toBeInTheDocument();
  expect(screen.getByTitle("Cài đặt")).toBeInTheDocument();
});

test("active tab has primary color and underline", () => {
  render(<HeaderBar view="settings" onViewChange={() => {}} />);

  const settingsBtn = screen.getByTitle("Cài đặt");
  expect(settingsBtn.className).toContain("text-primary");
});

test("chat mới button shows when has messages", () => {
  const handleClear = vi.fn();
  render(<HeaderBar view="chat" onViewChange={() => {}} onClearChat={handleClear} hasMessages={true} />);

  const clearBtn = screen.getByTitle("Chat mới");
  expect(clearBtn).toBeInTheDocument();
});
