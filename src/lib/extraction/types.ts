export type ExtractionMethod = "readability" | "dom-fallback";

export type ExtractedPageContent = {
  title: string;
  url: string;
  text: string;
  method: ExtractionMethod;
  warnings: string[];
};
