import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  parseMessageBlocks,
  tokenizeInline,
  detectAlert,
  detectHeading,
  detectTable,
  detectCodeBlock,
  detectQuote,
  MessageBlocksRenderer,
} from "../src/core/message-parser";
import { MessageContent } from "../src/components/chat/MessageContent";

describe("Message Parser & Rich Content Renderer", () => {
  describe("Inline Tokenizer & Formatting ([C2], [C3])", () => {
    it("parses bold, italic, inline code, and links correctly", () => {
      const tokens = tokenizeInline("Đây là **đậm**, *nghiêng*, `code` và [Liên kết](https://example.com)");
      expect(tokens).toEqual([
        { type: "text", text: "Đây là " },
        { type: "bold", text: "đậm" },
        { type: "text", text: ", " },
        { type: "italic", text: "nghiêng" },
        { type: "text", text: ", " },
        { type: "code", text: "code" },
        { type: "text", text: " và " },
        { type: "link", text: "Liên kết", url: "https://example.com" },
      ]);
    });

    it("parses combined bold-italic (***text***) without leaving orphan asterisks ([C2])", () => {
      const tokens = tokenizeInline("Đây là **bold** và *italic*, còn ***cả hai*** thì sao?");
      expect(tokens).toEqual([
        { type: "text", text: "Đây là " },
        { type: "bold", text: "bold" },
        { type: "text", text: " và " },
        { type: "italic", text: "italic" },
        { type: "text", text: ", còn " },
        { type: "bold-italic", text: "cả hai" },
        { type: "text", text: " thì sao?" },
      ]);
    });

    it("respects escaped asterisks and backticks without formatting ([C3])", () => {
      const tokens = tokenizeInline("Văn bản \\*không nghiêng\\* và \\`không code\\`");
      expect(tokens).toEqual([
        { type: "text", text: "Văn bản *không nghiêng* và `không code`" },
      ]);
    });

    it("does not treat math expressions like 2 * 3 * 4 as italics", () => {
      const tokens = tokenizeInline("Tính: 2 * 3 * 4 = 24");
      expect(tokens).toEqual([
        { type: "text", text: "Tính: 2 * 3 * 4 = 24" },
      ]);
    });

    it("renders inline tokens to proper HTML elements", () => {
      const { container } = render(<MessageContent content="**Bold** *Italic* `Code` [Link](https://test.com)" />);
      expect(container.querySelector("strong")?.textContent).toBe("Bold");
      expect(container.querySelector("em")?.textContent).toBe("Italic");
      expect(container.querySelector("code")?.textContent).toBe("Code");
      const link = container.querySelector("a");
      expect(link?.textContent).toBe("Link");
      expect(link?.getAttribute("href")).toBe("https://test.com");
    });
  });

  describe("Headings h1..h6 ([C1])", () => {
    it("detects and renders all heading levels h1 through h6 with semantic tags", () => {
      const input = [
        "# Tiêu đề 1",
        "## Tiêu đề 2",
        "### Tiêu đề 3",
        "#### Tiêu đề 4",
        "##### Tiêu đề 5",
        "###### Tiêu đề 6",
      ].join("\n");

      const { container } = render(<MessageContent content={input} />);

      expect(container.querySelector("h1")?.textContent).toBe("Tiêu đề 1");
      expect(container.querySelector("h2")?.textContent).toBe("Tiêu đề 2");
      expect(container.querySelector("h3")?.textContent).toBe("Tiêu đề 3");
      expect(container.querySelector("h4")?.textContent).toBe("Tiêu đề 4");
      expect(container.querySelector("h5")?.textContent).toBe("Tiêu đề 5");
      expect(container.querySelector("h6")?.textContent).toBe("Tiêu đề 6");
    });

    it("detectHeading parses level correctly", () => {
      expect(detectHeading("# Title")?.level).toBe(1);
      expect(detectHeading("#### Technical Details")?.level).toBe(4);
      expect(detectHeading("###### Fine Print")?.level).toBe(6);
      expect(detectHeading("Regular text")).toBeNull();
    });
  });

  describe("Table Detection & Sorting", () => {
    const tableMarkdown = [
      "| Tên | Điểm |",
      "| :--- | ---: |",
      "| Bob | 80 |",
      "| Alice | 95 |",
      "| Charlie | 70 |",
    ].join("\n");

    it("detects markdown table with headers and alignments", () => {
      const lines = tableMarkdown.split("\n");
      const result = detectTable(lines, 0);
      expect(result).not.toBeNull();
      expect(result!.block.headers).toEqual(["Tên", "Điểm"]);
      expect(result!.block.alignments).toEqual(["left", "right"]);
      expect(result!.block.rows).toHaveLength(3);
    });

    it("renders table and sorts columns ascending and descending", async () => {
      const user = userEvent.setup();
      render(<MessageContent content={tableMarkdown} />);

      expect(screen.getByText("Tên")).toBeInTheDocument();
      expect(screen.getByText("Điểm")).toBeInTheDocument();

      // Initial rows order: Bob, Alice, Charlie
      const rowsBefore = screen.getAllByRole("row").slice(1);
      expect(rowsBefore[0]).toHaveTextContent("Bob");
      expect(rowsBefore[1]).toHaveTextContent("Alice");
      expect(rowsBefore[2]).toHaveTextContent("Charlie");

      // Click "Tên" header to sort ascending: Alice, Bob, Charlie
      await user.click(screen.getByText("Tên"));
      const rowsAsc = screen.getAllByRole("row").slice(1);
      expect(rowsAsc[0]).toHaveTextContent("Alice");
      expect(rowsAsc[1]).toHaveTextContent("Bob");
      expect(rowsAsc[2]).toHaveTextContent("Charlie");

      // Click "Tên" header again to sort descending: Charlie, Bob, Alice
      await user.click(screen.getByText(/Tên/));
      const rowsDesc = screen.getAllByRole("row").slice(1);
      expect(rowsDesc[0]).toHaveTextContent("Charlie");
      expect(rowsDesc[1]).toHaveTextContent("Bob");
      expect(rowsDesc[2]).toHaveTextContent("Alice");
    });
  });

  describe("Code Block & Copy Feedback ([C4])", () => {
    it("renders code block with language and max-h-96 scroll containment", () => {
      const codeMarkdown = "```typescript\nconst greeting = 'Xin chào';\nconsole.log(greeting);\n```";
      const { container } = render(<MessageContent content={codeMarkdown} />);

      expect(screen.getByText("typescript")).toBeInTheDocument();
      expect(screen.getByText("Sao chép")).toBeInTheDocument();

      const pre = container.querySelector("pre");
      expect(pre).toBeInTheDocument();
      expect(pre?.className).toContain("max-h-96");
      expect(pre?.className).toContain("overflow-auto");
    });

    it("copies code to clipboard and cleans up timer on unmount", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const writeText = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
        writable: true,
      });

      const code = "console.log('test');";
      const { unmount } = render(<MessageContent content={`\`\`\`javascript\n${code}\n\`\`\``} />);

      const copyBtn = screen.getByRole("button", { name: "Sao chép" });
      await act(async () => {
        copyBtn.click();
      });

      expect(writeText).toHaveBeenCalledWith(code);
      expect(screen.getByRole("button", { name: "Đã sao chép" })).toBeInTheDocument();

      // Advance time by 2000ms to verify reset
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByRole("button", { name: "Sao chép" })).toBeInTheDocument();

      // Verify unmount does not throw
      expect(() => unmount()).not.toThrow();
      vi.useRealTimers();
    });
  });

  describe("Alert / Callout Detection & Rendering", () => {
    it("detects emoji alert prefixes (warning, error, tip, note)", () => {
      const warnResult = detectAlert(["⚠️ Cảnh báo: Hệ thống sẽ bảo trì"], 0);
      expect(warnResult).not.toBeNull();
      expect(warnResult!.block.variant).toBe("warning");
      expect(warnResult!.block.label).toBe("Cảnh báo");
      expect(warnResult!.block.content).toBe("Hệ thống sẽ bảo trì");

      const tipResult = detectAlert(["💡 Mẹo: Dùng Ctrl+K để mở nhanh"], 0);
      expect(tipResult).not.toBeNull();
      expect(tipResult!.block.variant).toBe("tip");

      const errResult = detectAlert(["❗ Lỗi: Không thể kết nối API"], 0);
      expect(errResult).not.toBeNull();
      expect(errResult!.block.variant).toBe("error");
    });

    it("detects GitHub-style callouts (> [!NOTE])", () => {
      const lines = ["> [!NOTE]", "> Đây là nội dung ghi chú quan trọng."];
      const noteResult = detectAlert(lines, 0);
      expect(noteResult).not.toBeNull();
      expect(noteResult!.block.variant).toBe("note");
      expect(noteResult!.block.content).toBe("Đây là nội dung ghi chú quan trọng.");
    });

    it("renders alert block with alert role and styled container", () => {
      render(<MessageContent content="⚠️ Cảnh báo: Dữ liệu chưa được lưu" />);
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent("Cảnh báo");
      expect(alert).toHaveTextContent("Dữ liệu chưa được lưu");
    });
  });

  describe("Quote Blocks & Lists", () => {
    it("detects and renders blockquotes", () => {
      const quoteMarkdown = "> Đây là trích dẫn từ tài liệu\n> Dòng thứ hai của trích dẫn";
      const { container } = render(<MessageContent content={quoteMarkdown} />);
      const blockquote = container.querySelector("blockquote");
      expect(blockquote).toBeInTheDocument();
      expect(blockquote?.textContent).toContain("Đây là trích dẫn từ tài liệu");
    });

    it("detects and renders ordered and unordered lists", () => {
      const listMarkdown = "- Mục 1\n- Mục 2\n- Mục 3";
      const { container } = render(<MessageContent content={listMarkdown} />);
      const ul = container.querySelector("ul");
      expect(ul).toBeInTheDocument();
      expect(ul?.querySelectorAll("li")).toHaveLength(3);

      const orderedMarkdown = "1. Bước một\n2. Bước hai";
      const { container: orderedContainer } = render(<MessageContent content={orderedMarkdown} />);
      const ol = orderedContainer.querySelector("ol");
      expect(ol).toBeInTheDocument();
      expect(ol?.querySelectorAll("li")).toHaveLength(2);
    });
  });

  describe("JSON Block", () => {
    it("detects JSON block and renders collapsible formatted JSON with copy button", async () => {
      const jsonStr = '{\n  "status": "success",\n  "count": 42\n}';
      const user = userEvent.setup();
      const writeText = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
        writable: true,
      });

      render(<MessageContent content={jsonStr} />);

      expect(screen.getByText("JSON")).toBeInTheDocument();
      expect(screen.getByText(/\"status\"/)).toBeInTheDocument();

      // Click copy button
      const copyBtn = screen.getByRole("button", { name: "Sao chép" });
      await user.click(copyBtn);
      expect(writeText).toHaveBeenCalled();
      expect(await screen.findByText("Đã sao chép")).toBeInTheDocument();

      // Collapse and expand
      await user.click(screen.getByText("JSON"));
      expect(screen.queryByText(/\"status\"/)).not.toBeInTheDocument();
      await user.click(screen.getByText("JSON"));
      expect(screen.getByText(/\"status\"/)).toBeInTheDocument();
    });
  });
});
