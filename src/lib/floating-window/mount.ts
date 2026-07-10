import React from "react";
import ReactDOM from "react-dom/client";
import { FloatingWindow } from "./FloatingWindow";

let currentRoot: ReactDOM.Root | null = null;
let currentContainer: HTMLElement | null = null;

import type { ToolDevTrace } from "../devtools/types";

export interface MountOptions {
  position: { top: number; left: number };
  prompt: string;
  requestId: string;
  title: string;
  toolTrace?: ToolDevTrace;
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
    /* Scrollbar Styling for Shadow DOM */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(28, 25, 23, 0.5);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(120, 113, 108, 0.4);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(168, 162, 158, 0.6);
    }
    /* Mini-Tailwind for DevTools components in Shadow DOM */
    .rounded-xl { border-radius: 12px; }
    .border { border-style: solid; border-width: 1px; }
    .border-stone-850 { border-color: #262626; }
    .border-stone-900 { border-color: #1c1917; }
    .border-red-900\\/20 { border-color: rgba(127, 29, 29, 0.2); }
    .bg-stone-950 { background-color: #0c0a09; }
    .bg-red-950\\/20 { background-color: rgba(69, 10, 10, 0.2); }
    .font-mono { font-family: monospace; }
    .text-\\[11px\\] { font-size: 11px; }
    .text-\\[10px\\] { font-size: 10px; }
    .text-\\[9px\\] { font-size: 9px; }
    .text-stone-300 { color: #d6d3d1; }
    .text-stone-400 { color: #a8a29e; }
    .text-stone-500 { color: #78716c; }
    .text-emerald-400 { color: #34d399; }
    .text-amber-400 { color: #fbbf24; }
    .text-red-400 { color: #f87171; }
    .p-2 { padding: 8px; }
    .p-3 { padding: 12px; }
    .pt-3 { padding-top: 12px; }
    .pl-2 { padding-left: 8px; }
    .p-1\\.5 { padding: 6px; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-2 { gap: 8px; }
    .w-full { width: 100%; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .tracking-wide { letter-spacing: 0.025em; }
    .tracking-wider { letter-spacing: 0.05em; }
    .outline-none { outline: 2px solid transparent; outline-offset: 2px; }
    .hover\\:text-violet-400:hover { color: #a78bfa; }
    .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .cursor-pointer { cursor: pointer; }
    .uppercase { text-transform: uppercase; }
    .mt-3.5 { margin-top: 14px; }
    .mt-2 { margin-top: 8px; }
    .mt-1 { margin-top: 4px; }
    .mb-1.5 { margin-bottom: 6px; }
    .space-y-3.5 > * + * { margin-top: 14px; }
    .space-y-2.5 > * + * { margin-top: 10px; }
    .space-y-0.5 > * + * { margin-top: 2px; }
    .border-t { border-top-style: solid; border-top-width: 1px; }
    .max-h-60 { max-height: 240px; }
    .overflow-y-auto { overflow-y: auto; }
    .whitespace-pre-wrap { white-space: pre-wrap; }
    .rounded { border-radius: 4px; }
    .bg-stone-900\\/60 { background-color: rgba(28, 25, 23, 0.6); }
    .leading-relaxed { line-height: 1.625; }
    .hover\\:text-violet-300:hover { color: #c084fc; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
    .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    .break-all { word-break: break-all; }
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
      toolTrace: options.toolTrace,
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
