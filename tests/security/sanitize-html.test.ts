import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../../src/core/security/sanitize-html";

describe("sanitizeHtml", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("keeps safe formatting content intact", () => {
    const html =
      "<h1>Title</h1><p>Hello <strong>world</strong></p><ul><li>a</li></ul>" +
      '<table><tbody><tr><td colspan="2">cell</td></tr></tbody></table>';
    const out = sanitizeHtml(html);

    expect(out).toContain("<h1>Title</h1>");
    expect(out).toContain("<strong>world</strong>");
    expect(out).toContain('colspan="2"');
  });

  it("removes script and style together with their content", () => {
    const out = sanitizeHtml("<p>ok</p><script>alert(1)</script><style>.x{color:red}</style>");

    expect(out).not.toContain("script");
    expect(out).not.toContain("alert(1)");
    expect(out).not.toContain(".x{color:red}");
    expect(out).toContain("<p>ok</p>");
  });

  it("removes event handler attributes", () => {
    const out = sanitizeHtml('<p onclick="alert(1)" onmouseover="x()">text</p>');

    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onmouseover");
    expect(out).toContain(">text</p>");
  });

  it("removes event handlers on the body element itself", () => {
    const out = sanitizeHtml('<body onload="alert(1)"><p>content</p></body>');

    expect(out).not.toContain("onload");
    expect(out).toContain("<p>content</p>");
  });

  it("removes javascript:, vbscript: and data: URLs", () => {
    const out = sanitizeHtml(
      '<a href="javascript:alert(1)">x</a><img src="javascript:alert(2)" alt="i">' +
      '<a href="vbscript:msgbox(1)">v</a><a href="data:text/html,<script>alert(3)</script>">d</a>'
    );

    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("vbscript:");
    expect(out).not.toContain("data:");
  });

  it("blocks javascript: URLs obfuscated with tab/newline characters", () => {
    const out = sanitizeHtml('<a href="java\tscript:alert(1)">x</a>');

    expect(out).not.toContain("javascript");
  });

  it("keeps http(s), mailto and relative URLs", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com/a">site</a><a href="/relative">rel</a>' +
      '<a href="#anchor">anchor</a><a href="mailto:a@b.test">mail</a>'
    );

    expect(out).toContain('href="https://example.com/a"');
    expect(out).toContain('href="/relative"');
    expect(out).toContain('href="#anchor"');
    expect(out).toContain('href="mailto:a@b.test"');
  });

  it("drops meta refresh and other head-only tags injected at the start", () => {
    const out = sanitizeHtml(
      '<meta http-equiv="refresh" content="0;url=https://evil.test"><p>keep</p>'
    );

    expect(out).not.toContain("meta");
    expect(out).not.toContain("evil.test");
    expect(out).toContain("<p>keep</p>");
  });

  it("drops iframe, object, embed, svg, form and form controls with content", () => {
    const out = sanitizeHtml(
      '<iframe src="https://evil.test"></iframe><object data="x"></object>' +
      "<embed src=\"x\"><svg><script>1</script></svg>" +
      '<form action="x"><input type="text"><button>go</button></form><p>keep</p>'
    );

    expect(out).not.toContain("iframe");
    expect(out).not.toContain("object");
    expect(out).not.toContain("embed");
    expect(out).not.toContain("svg");
    expect(out).not.toContain("form");
    expect(out).not.toContain("button");
    expect(out).toContain("<p>keep</p>");
  });

  it("unwraps unknown tags but keeps their text content", () => {
    const out = sanitizeHtml("<section><p>hello</p><custom-tag>inner text</custom-tag></section>");

    expect(out).toContain("hello");
    expect(out).toContain("inner text");
    expect(out).not.toContain("<custom-tag");
    expect(out).not.toContain("<section");
  });

  it("drops non-allowlisted attributes such as srcset and style", () => {
    const out = sanitizeHtml(
      '<img src="https://example.com/a.png" alt="a" srcset="javascript:alert(1) 1x" style="expression(alert(1))">'
    );

    expect(out).not.toContain("srcset");
    expect(out).not.toContain("expression");
    expect(out).not.toContain("style=");
    expect(out).toContain("https://example.com/a.png");
  });
});
