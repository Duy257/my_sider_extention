import { describe, expect, it } from "vitest";
import { extractPageContent } from "../../src/lib/extraction";

describe("page extraction", () => {
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
});
