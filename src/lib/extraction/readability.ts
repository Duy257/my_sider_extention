import { Readability } from "@mozilla/readability";

export function extractReadableText(documentInput: Document): string {
  const clone = documentInput.cloneNode(true) as Document;
  const article = new Readability(clone).parse();

  if (!article?.textContent?.trim()) {
    return "";
  }

  return article.textContent.replace(/\n{3,}/g, "\n\n").trim();
}
