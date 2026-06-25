export function mapStreamError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  if (error instanceof TypeError) return "Network error. Check your internet connection.";
  if (error instanceof SyntaxError) return "Received malformed data from the AI provider.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return "AI request failed. Check your API key, model, network, and quota.";
}
