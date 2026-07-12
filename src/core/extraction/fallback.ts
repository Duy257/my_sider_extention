const BLOCKED_SELECTORS = "script, style, nav, footer, aside, noscript, svg, canvas, header, [hidden], [aria-hidden=\"true\"]";

const EXTRACTION_SELECTORS = "h1,h2,h3,h4,p,li,td,th,blockquote,pre,code,dt,dd,figcaption";

export function extractDomText(root: Document): string {
  const clone = root.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(BLOCKED_SELECTORS).forEach((node) => node.remove());

  const preferred = clone.querySelector("main, article") ?? clone.querySelector("body") ?? clone;
  return Array.from(preferred.querySelectorAll(EXTRACTION_SELECTORS))
    .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean)
    .join("\n");
}
