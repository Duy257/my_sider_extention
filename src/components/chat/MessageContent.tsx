import React, { useMemo } from "react";
import { MessageBlocksRenderer, parseMessageBlocks } from "../../core/message-parser";

export interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  const blocks = useMemo(() => {
    if (!content) return [];
    return parseMessageBlocks(content);
  }, [content]);

  if (!content || blocks.length === 0) return null;

  return <MessageBlocksRenderer blocks={blocks} mode="tailwind" />;
}
