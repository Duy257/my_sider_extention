import { extractDomText } from "./fallback";
import { extractReadableText } from "./readability";
import type { ExtractedPageContent, ExtractionMethod } from "./types";

const MAX_PAGE_CONTEXT_CHARS = 40000;

export function extractPageContent(url = window.location.href): ExtractedPageContent {
  const warnings: string[] = [];
  let method: ExtractionMethod = "readability";
  let text = extractReadableText(document);

  if (!text) {
    method = "dom-fallback";
    text = extractDomText(document);
  }

  if (text.length > MAX_PAGE_CONTEXT_CHARS) {
    text = text.slice(0, MAX_PAGE_CONTEXT_CHARS);
    warnings.push("Page content was truncated to 40,000 characters.");
  }

  return {
    title: document.title || "Untitled page",
    url,
    text,
    method,
    warnings
  };
}

export type { ExtractedPageContent, ExtractionMethod } from "./types";
