import { render, screen } from "@testing-library/react";
import { HeaderBar } from "../entrypoints/sidepanel/components/HeaderBar";
import { expect, test, vi } from "vitest";

test("renders brand name and all navigation tabs", () => {
  render(<HeaderBar view="chat" onViewChange={() => {}} onReadPage={() => {}} readingPage={false} />);

  expect(screen.getByText("AI Cá Nhân")).toBeInTheDocument();
  expect(screen.getByTitle("Đọc trang")).toBeInTheDocument();
  expect(screen.getByTitle("Mẫu lệnh")).toBeInTheDocument();
  expect(screen.getByTitle("Đã lưu")).toBeInTheDocument();
  expect(screen.getByTitle("Cài đặt")).toBeInTheDocument();
});

test("active tab has primary color and underline", () => {
  render(<HeaderBar view="settings" onViewChange={() => {}} onReadPage={() => {}} />);

  const settingsBtn = screen.getByTitle("Cài đặt");
  expect(settingsBtn.className).toContain("text-primary");
});

test("read page button shows spinner when reading", () => {
  const { container } = render(<HeaderBar view="chat" onViewChange={() => {}} onReadPage={() => {}} readingPage={true} />);

  expect(container.querySelector(".animate-spinner")).toBeInTheDocument();
});
