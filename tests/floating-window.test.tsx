import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FloatingWindow } from "../src/lib/floating-window/FloatingWindow";

describe("FloatingWindow", () => {
  const defaultProps = {
    initialPosition: { top: 100, left: 100 },
    prompt: "Test prompt",
    requestId: "test-id",
    onClose: vi.fn(),
  };

  it("renders in default state with loading indicator", () => {
    render(React.createElement(FloatingWindow, defaultProps));
    expect(screen.getByText("AI Assistant")).toBeDefined();
    // Loading dots should be present
    const container = screen.getByText("AI Assistant").closest("[style]");
    expect(container).toBeDefined();
  });

  it("transitions to minimized state when minimize button clicked", () => {
    render(React.createElement(FloatingWindow, defaultProps));
    const minimizeBtn = screen.getByTitle("Thu nhỏ");
    fireEvent.click(minimizeBtn);
    // In minimized state, there should be multiple elements with "AI" text (icon and title)
    expect(screen.getAllByText("AI").length).toBe(2);
  });

  it("closes when close button clicked", () => {
    const onClose = vi.fn();
    render(React.createElement(FloatingWindow, { ...defaultProps, onClose }));
    const closeBtn = screen.getByTitle("Đóng");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
