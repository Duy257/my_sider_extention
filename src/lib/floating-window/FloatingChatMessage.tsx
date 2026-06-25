import React from "react";
import type { StreamState } from "./types";

const styles = {
  container: {
    animation: "floating-fade-in-up 0.3s ease-out",
  },
  text: {
    color: "#FAFAF9",
    lineHeight: "1.7",
  },
  cursor: {
    display: "inline-block",
    width: "6px",
    height: "14px",
    background: "#A78BFA",
    animation: "floating-blink 0.8s step-end infinite",
    marginLeft: "1px",
    verticalAlign: "text-bottom",
  },
};

export function FloatingChatMessage(props: {
  content: string;
  streamState: StreamState;
}) {
  return (
    <div style={styles.container}>
      <div style={styles.text}>
        {props.content}
        {props.streamState === "streaming" && <span style={styles.cursor} />}
      </div>
    </div>
  );
}
