export {};

declare global {
  interface Window {
    __personalAiSidebarAgentInstalled?: boolean;
  }

  // Typed custom events (tránh `as any` khi addEventListener/dispatchEvent)
  interface WindowEventMap {
    "reader-ask-more": CustomEvent<string>;
  }
}
