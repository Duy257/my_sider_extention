import { describe, expect, it } from "vitest";
import { APICallError, JSONParseError, TypeValidationError } from "ai";
import { classifyAiError, mapStreamError } from "../../src/core/ai/stream";

describe("mapStreamError", () => {
  it("returns empty string for AbortError", () => {
    const error = new DOMException("aborted", "AbortError");
    expect(mapStreamError(error)).toBe("");
  });

  it("returns network message for TypeError", () => {
    expect(mapStreamError(new TypeError("fetch failed"))).toBe("Network error. Check your internet connection.");
  });

  it("returns the error message for regular errors", () => {
    expect(mapStreamError(new Error("Invalid API key"))).toBe("Invalid API key");
  });
});

describe("classifyAiError", () => {
  const apiCallError = (statusCode: number | undefined, responseBody?: string, cause?: unknown) =>
    new APICallError({
      message: "failed",
      url: "https://api.test/v1/chat/completions",
      requestBodyValues: {},
      statusCode,
      responseBody,
      cause
    });

  it("reads the provider message from HTTP errors", () => {
    expect(classifyAiError(apiCallError(401, '{"error":{"message":"Bad key"}}'))).toEqual({
      kind: "http",
      status: 401,
      providerMessage: "Bad key",
      responseBody: '{"error":{"message":"Bad key"}}'
    });
  });

  it("keeps the raw body when the HTTP error is not JSON", () => {
    expect(classifyAiError(apiCallError(502, "Bad Gateway"))).toEqual({
      kind: "http",
      status: 502,
      providerMessage: undefined,
      responseBody: "Bad Gateway"
    });
  });

  it("treats API call errors without a status as network errors", () => {
    expect(classifyAiError(apiCallError(undefined))).toEqual({ kind: "network" });
    expect(classifyAiError(new TypeError("Failed to fetch"))).toEqual({ kind: "network" });
  });

  it("detects invalid success responses", () => {
    const jsonError = new JSONParseError({ text: "<html>", cause: new SyntaxError("bad") });
    const validationError = new TypeValidationError({ value: {}, cause: new Error("bad shape") });

    expect(classifyAiError(apiCallError(200, "<html>", jsonError))).toEqual({ kind: "invalid-json" });
    expect(classifyAiError(apiCallError(200, "{}", validationError))).toEqual({ kind: "invalid-format" });
    expect(classifyAiError(jsonError)).toEqual({ kind: "invalid-json" });
    expect(classifyAiError(validationError)).toEqual({ kind: "invalid-format" });
  });

  it("falls back to other for aborts and unknown errors", () => {
    expect(classifyAiError(new DOMException("aborted", "AbortError"))).toEqual({ kind: "other" });
    expect(classifyAiError("boom")).toEqual({ kind: "other" });
  });
});
