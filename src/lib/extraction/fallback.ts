const BLOCKED_SELECTORS = "script, style, nav, footer, aside, noscript, svg, canvas";

export function extractDomText(root: Document): string {
  const clone = root.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(BLOCKED_SELECTORS).forEach((node) => node.remove());

  const preferred = clone.querySelector("main, article") ?? clone.body ?? clone;
  return Array.from(preferred.querySelectorAll("h1,h2,h3,h4,p,li,td,th"))
    .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean)
    .join("\n");
}
