import React from "react";
import ReactDOM from "react-dom/client";
import { FloatingWindow } from "./FloatingWindow";

let currentRoot: ReactDOM.Root | null = null;
let currentContainer: HTMLElement | null = null;

export interface MountOptions {
  position: { top: number; left: number };
  prompt: string;
  requestId: string;
  title: string;
}

export function mountFloatingWindow(options: MountOptions) {
  destroyFloatingWindow();

  const container = document.createElement("div");
  container.id = "personal-ai-floating-window";
  container.style.position = "fixed";
  container.style.zIndex = "2147483646";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "0";
  container.style.height = "0";
  document.body.appendChild(container);

  // Create shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: "closed" });
  
  // Inject custom keyframes for loading dots and fade animations
  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    @keyframes floating-dot-bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    @keyframes floating-fade-in-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes floating-blink {
      50% { opacity: 0; }
    }
  `;
  shadow.appendChild(style);

  const host = document.createElement("div");
  shadow.appendChild(host);

  const root = ReactDOM.createRoot(host);
  root.render(
    React.createElement(FloatingWindow, {
      initialPosition: options.position,
      prompt: options.prompt,
      requestId: options.requestId,
      onClose: destroyFloatingWindow,
    })
  );

  currentRoot = root;
  currentContainer = container;
}

export function destroyFloatingWindow() {
  if (currentRoot) {
    try {
      currentRoot.unmount();
    } catch (e) {
      console.warn("Error unmounting floating window root:", e);
    }
    currentRoot = null;
  }
  if (currentContainer) {
    try {
      currentContainer.remove();
    } catch (e) {
      console.warn("Error removing floating window container:", e);
    }
    currentContainer = null;
  }
}
