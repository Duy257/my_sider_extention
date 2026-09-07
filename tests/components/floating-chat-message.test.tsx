import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FloatingChatMessage } from "../../src/components/floating-window/FloatingChatMessage";

describe("FloatingChatMessage Component ([FC1], [FC2], [FC3])", () => {
  it("renders bold, italic, and code inline using message parser", () => {
    const { container } = render(
      <FloatingChatMessage content="**B** *I* `C`" streamState="done" />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("B");
    expect(container.querySelector("em")?.textContent).toBe("I");
    expect(container.querySelector("code")?.textContent).toBe("C");
  });

  it("appends cursor when streaming and content is not empty ([FC3])", () => {
    const { container } = render(
      <FloatingChatMessage content="hi" streamState="streaming" />,
    );
    const cursor = container.querySelectorAll("span[style*='floating-blink']");
    expect(cursor.length).toBeGreaterThan(0);
  });

  it("does not render cursor when streamState is done", () => {
    const { container } = render(
      <FloatingChatMessage content="hi" streamState="done" />,
    );
    const cursor = container.querySelectorAll("span[style*='floating-blink']");
    expect(cursor.length).toBe(0);
  });

  it("renders proper headings h1 through h6 tags", () => {
    const input = [
      "# H1",
      "## H2",
      "### H3",
      "#### H4",
      "##### H5",
      "###### H6",
    ].join("\n");

    const { container } = render(
      <FloatingChatMessage content={input} streamState="done" />,
    );

    expect(container.querySelector("h1")?.textContent).toBe("H1");
    expect(container.querySelector("h2")?.textContent).toBe("H2");
    expect(container.querySelector("h3")?.textContent).toBe("H3");
    expect(container.querySelector("h4")?.textContent).toBe("H4");
    expect(container.querySelector("h5")?.textContent).toBe("H5");
    expect(container.querySelector("h6")?.textContent).toBe("H6");
  });

  it("handles empty content gracefully when streamState is done", () => {
    const { container } = render(
      <FloatingChatMessage content="" streamState="done" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("handles empty content gracefully when streamState is streaming", () => {
    const { container } = render(
      <FloatingChatMessage content="" streamState="streaming" />,
    );
    expect(container.firstChild).not.toBeNull();
    const cursor = container.querySelectorAll("span[style*='floating-blink']");
    expect(cursor.length).toBeGreaterThan(0);
  });
});
