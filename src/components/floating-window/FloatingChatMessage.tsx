import React, { useMemo } from "react";
import type { StreamState } from "./types";
import { MessageBlocksRenderer, parseMessageBlocks } from "../../core/message-parser";

const styles = {
  container: {
    animation: "floating-fade-in-up 0.3s ease-out",
    padding: "2px",
  },
  text: {
    color: "#E7E5E4",
    fontSize: "13.5px",
    lineHeight: "1.7",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  cursor: {
    display: "inline-block",
    width: "6px",
    height: "14px",
    background: "#A78BFA",
    animation: "floating-blink 0.8s step-end infinite",
    marginLeft: "3px",
    verticalAlign: "text-bottom",
  },
};

export interface FloatingChatMessageProps {
  content: string;
  streamState: StreamState;
}

export function FloatingChatMessage({
  content,
  streamState,
}: FloatingChatMessageProps) {
  const isStreaming = streamState === "streaming";

  const blocks = useMemo(() => {
    if (!content) return [];
    return parseMessageBlocks(content);
  }, [content]);

  // Gracefully handle empty content when not streaming
  if (!content && !isStreaming) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.text}>
        {blocks.length > 0 && (
          <MessageBlocksRenderer blocks={blocks} mode="inline" />
        )}
        {isStreaming && <span style={styles.cursor} />}
      </div>
    </div>
  );
}
