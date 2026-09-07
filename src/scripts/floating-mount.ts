import React from "react";
import ReactDOM from "react-dom/client";
import { FloatingWindow } from "../components/floating-window/FloatingWindow";

let currentRoot: ReactDOM.Root | null = null;
let currentContainer: HTMLElement | null = null;

import type { ToolDevTrace } from "../core/devtools/types";
import type { AiMessage } from "../core/ai/types";

export interface MountOptions {
  position: { top: number; left: number };
  messages: AiMessage[];
  requestId: string;
  title: string;
  sessionId?: string;
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

  // Inject custom keyframes and utility classes for Rich Content & DevTools inside Shadow DOM
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

    /* Layout & Box Utilities */
    .flex { display: flex; }
    .inline-flex { display: inline-flex; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .gap-1 { gap: 4px; }
    .gap-1\\.5 { gap: 6px; }
    .gap-2 { gap: 8px; }
    .w-full { width: 100%; }
    .w-\\[22px\\] { width: 22px; }
    .h-\\[22px\\] { height: 22px; }
    .h-1\\.5 { height: 6px; }

    /* Borders & Radius */
    .border { border-style: solid; border-width: 1px; }
    .border-0 { border-width: 0; }
    .border-t { border-top-style: solid; border-top-width: 1px; }
    .border-b { border-bottom-style: solid; border-bottom-width: 1px; }
    .border-l-2 { border-left-style: solid; border-left-width: 2px; }
    .border-l-4 { border-left-style: solid; border-left-width: 4px; }
    .rounded { border-radius: 4px; }
    .rounded-md { border-radius: 6px; }
    .rounded-lg { border-radius: 8px; }
    .rounded-xl { border-radius: 12px; }

    /* Border Colors */
    .border-stone-600 { border-color: #57534e; }
    .border-stone-800 { border-color: #292524; }
    .border-stone-800\\/60 { border-color: rgba(41, 37, 36, 0.6); }
    .border-stone-800\\/50 { border-color: rgba(41, 37, 36, 0.5); }
    .border-stone-800\\/30 { border-color: rgba(41, 37, 36, 0.3); }
    .border-stone-850 { border-color: #262626; }
    .border-stone-900 { border-color: #1c1917; }
    .border-red-900\\/20 { border-color: rgba(127, 29, 29, 0.2); }
    .border-amber-500\\/60 { border-color: rgba(245, 158, 11, 0.6); }
    .border-red-500\\/60 { border-color: rgba(239, 68, 68, 0.6); }
    .border-blue-500\\/60 { border-color: rgba(59, 130, 246, 0.6); }
    .border-sky-500\\/60 { border-color: rgba(14, 165, 233, 0.6); }
    .border-violet-500\\/60 { border-color: rgba(139, 92, 246, 0.6); }
    .border-emerald-500\\/60 { border-color: rgba(16, 185, 129, 0.6); }

    /* Backgrounds */
    .bg-transparent { background-color: transparent; }
    .bg-stone-900 { background-color: #1c1917; }
    .bg-stone-900\\/60 { background-color: rgba(28, 25, 23, 0.6); }
    .bg-stone-900\\/80 { background-color: rgba(28, 25, 23, 0.8); }
    .bg-stone-950 { background-color: #0c0a09; }
    .bg-stone-950\\/40 { background-color: rgba(12, 10, 9, 0.4); }
    .bg-stone-950\\/90 { background-color: rgba(12, 10, 9, 0.9); }
    .bg-red-950\\/20 { background-color: rgba(69, 10, 10, 0.2); }
    .bg-amber-950\\/25 { background-color: rgba(120, 53, 15, 0.25); }
    .bg-red-950\\/25 { background-color: rgba(127, 29, 29, 0.25); }
    .bg-blue-950\\/25 { background-color: rgba(30, 58, 138, 0.25); }
    .bg-sky-950\\/25 { background-color: rgba(12, 74, 110, 0.25); }
    .bg-violet-950\\/25 { background-color: rgba(76, 29, 149, 0.25); }
    .bg-emerald-950\\/25 { background-color: rgba(6, 78, 59, 0.25); }
    .hover\\:bg-stone-800\\/30:hover { background-color: rgba(41, 37, 36, 0.3); }
    .hover\\:bg-stone-700\\/60:hover { background-color: rgba(68, 64, 60, 0.6); }

    /* Typography & Colors */
    .font-mono { font-family: Consolas, Monaco, monospace; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .font-medium { font-weight: 500; }
    .italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    .tracking-wide { letter-spacing: 0.025em; }
    .tracking-wider { letter-spacing: 0.05em; }
    .leading-none { line-height: 1; }
    .leading-relaxed { line-height: 1.625; }

    .text-base { font-size: 16px; }
    .text-sm { font-size: 14px; }
    .text-xs { font-size: 12px; }
    .text-\\[13px\\] { font-size: 13px; }
    .text-\\[12\\.5px\\] { font-size: 12.5px; }
    .text-\\[12px\\] { font-size: 12px; }
    .text-\\[11px\\] { font-size: 11px; }
    .text-\\[10px\\] { font-size: 10px; }
    .text-\\[9px\\] { font-size: 9px; }

    .text-stone-50 { color: #fafaf9; }
    .text-stone-100 { color: #f5f5f4; }
    .text-stone-200 { color: #e7e5e4; }
    .text-stone-300 { color: #d6d3d1; }
    .text-stone-400 { color: #a8a29e; }
    .text-stone-500 { color: #78716c; }
    .text-primary-light { color: #a78bfa; }
    .text-pink-400 { color: #f472b6; }
    .text-purple-300 { color: #d8b4fe; }
    .text-emerald-400 { color: #34d399; }
    .text-emerald-300\\/90 { color: rgba(110, 231, 183, 0.9); }
    .text-amber-400 { color: #fbbf24; }
    .text-amber-200 { color: #fde68a; }
    .text-red-400 { color: #f87171; }
    .text-red-200 { color: #fecaca; }
    .text-blue-200 { color: #bfdbfe; }
    .text-sky-200 { color: #bae6fd; }
    .text-violet-200 { color: #ddd6fe; }

    .hover\\:text-primary-light:hover { color: #a78bfa; }
    .hover\\:text-stone-100:hover { color: #f5f5f4; }
    .hover\\:text-violet-300:hover { color: #c084fc; }
    .hover\\:text-violet-400:hover { color: #a78bfa; }
    .hover\\:underline:hover { text-decoration: underline; }
    .underline-offset-2 { text-underline-offset: 2px; }

    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }

    /* Tables */
    .border-collapse { border-collapse: collapse; }

    /* Lists */
    .list-decimal { list-style-type: decimal; }
    .list-disc { list-style-type: disc; }
    .ml-5 { margin-left: 20px; }

    /* Spacing */
    .p-0 { padding: 0; }
    .p-2 { padding: 8px; }
    .p-3 { padding: 12px; }
    .p-3\\.5 { padding: 14px; }
    .pt-3 { padding-top: 12px; }
    .pl-2 { padding-left: 8px; }
    .pl-3\\.5 { padding-left: 14px; }
    .p-1\\.5 { padding: 6px; }
    .px-3 { padding-left: 12px; padding-right: 12px; }
    .py-2 { padding-top: 8px; padding-bottom: 8px; }
    .py-1\\.5 { padding-top: 6px; padding-bottom: 6px; }
    .py-4 { padding-top: 16px; padding-bottom: 16px; }
    .px-1\\.5 { padding-left: 6px; padding-right: 6px; }
    .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
    .pb-1 { padding-bottom: 4px; }
    .pb-0\\.5 { padding-bottom: 2px; }

    .mt-4 { margin-top: 16px; }
    .mt-3\\.5 { margin-top: 14px; }
    .mt-3 { margin-top: 12px; }
    .mt-2 { margin-top: 8px; }
    .mt-1 { margin-top: 4px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-1\\.5 { margin-bottom: 6px; }
    .mb-1 { margin-bottom: 4px; }
    .mb-0\\.5 { margin-bottom: 2px; }
    .my-3 { margin-top: 12px; margin-bottom: 12px; }
    .my-2\\.5 { margin-top: 10px; margin-bottom: 10px; }
    .my-1\\.5 { margin-top: 6px; margin-bottom: 6px; }
    .my-0\\.5 { margin-top: 2px; margin-bottom: 2px; }

    .space-y-3\\.5 > * + * { margin-top: 14px; }
    .space-y-2\\.5 > * + * { margin-top: 10px; }
    .space-y-1 > * + * { margin-top: 4px; }
    .space-y-0\\.5 > * + * { margin-top: 2px; }

    /* Sizing & Overflow */
    .max-h-96 { max-height: 384px; }
    .max-h-80 { max-height: 320px; }
    .max-h-60 { max-height: 240px; }
    .overflow-auto { overflow: auto; }
    .overflow-y-auto { overflow-y: auto; }
    .overflow-x-auto { overflow-x: auto; }
    .overflow-hidden { overflow: hidden; }
    .whitespace-pre { white-space: pre; }
    .whitespace-pre-wrap { white-space: pre-wrap; }
    .break-all { word-break: break-all; }

    /* Interaction & Accessibility */
    .cursor-pointer { cursor: pointer; }
    .select-none { user-select: none; }
    .opacity-90 { opacity: 0.9; }
    .opacity-80 { opacity: 0.8; }
    .outline-none { outline: 2px solid transparent; outline-offset: 2px; }
    .focus\\:outline-none:focus { outline: none; }
    .focus-visible\\:ring-2:focus-visible { box-shadow: 0 0 0 2px #a78bfa; }
    .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .duration-150 { transition-duration: 150ms; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
    .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  `;
  shadow.appendChild(style);

  const host = document.createElement("div");
  shadow.appendChild(host);

  const root = ReactDOM.createRoot(host);
  root.render(
    React.createElement(FloatingWindow, {
      initialPosition: options.position,
      messages: options.messages,
      requestId: options.requestId,
      sessionId: options.sessionId,
      onClose: destroyFloatingWindow,
      toolTrace: options.toolTrace,
    }),
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
