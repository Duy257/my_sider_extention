import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractPageContent } from "../../src/lib/extraction";

const mockReadability = vi.hoisted(() => vi.fn());

vi.mock("../../src/lib/extraction/readability", () => ({
  extractReadableText: mockReadability,
}));

describe("page extraction", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.title = "";
    mockReadability.mockReset();
    mockReadability.mockReturnValue("");
  });

  it("extracts article text and metadata", () => {
    document.body.innerHTML = `
      <nav>Navigation should disappear</nav>
      <article>
        <h1>Operations Review</h1>
        <p>Revenue rose because fulfillment improved.</p>
        <ul><li>Ship faster</li></ul>
      </article>
    `;
    document.title = "Ops Page";

    const result = extractPageContent("https://example.com/ops");

    expect(result.title).toBe("Ops Page");
    expect(result.url).toBe("https://example.com/ops");
    expect(result.text).toContain("Operations Review");
    expect(result.text).toContain("Revenue rose");
    expect(result.text).not.toContain("Navigation should disappear");
  });

  it("truncates large page content and records a warning", () => {
    document.body.innerHTML = `<main><p>${"a".repeat(41000)}</p></main>`;

    const result = extractPageContent("https://example.com/long");

    expect(result.text.length).toBeLessThanOrEqual(40000);
    expect(result.warnings).toContain("Page content was truncated to 40,000 characters.");
  });

  it("falls back to dom-fallback when Readability returns empty", () => {
    document.body.innerHTML = `<p>Some plain content</p>`;

    const result = extractPageContent("https://example.com/plain");

    expect(result.text).toContain("Some plain content");
    expect(result.method).toBe("dom-fallback");
  });

  it("reports method property as readability when Readability succeeds", () => {
    mockReadability.mockReturnValue("Readable article content");
    document.body.innerHTML = `
      <article>
        <h1>Title</h1>
        <p>Body text.</p>
      </article>
    `;
    document.title = "Test";

    const result = extractPageContent("https://example.com/method");

    expect(result.method).toBe("readability");
  });

  it("uses 'Untitled page' when title is empty", () => {
    document.body.innerHTML = `<main><p>No title here</p></main>`;
    document.title = "";

    const result = extractPageContent("https://example.com/notitle");

    expect(result.title).toBe("Untitled page");
  });

  it("records no warnings for short content", () => {
    document.body.innerHTML = `<main><p>Short content.</p></main>`;

    const result = extractPageContent("https://example.com/short");

    expect(result.warnings).toEqual([]);
  });
});
