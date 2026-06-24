import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

type Listener = (...args: any[]) => void;

function createListenerContainer() {
  const listeners: Listener[] = [];
  return {
    listeners,
    addListener(fn: Listener) {
      listeners.push(fn);
    },
    removeListener(fn: Listener) {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    trigger(...args: any[]) {
      listeners.forEach((fn) => fn(...args));
    }
  };
}

const portEntries: {
  onMessage: ReturnType<typeof createListenerContainer>;
  onDisconnect: ReturnType<typeof createListenerContainer>;
}[] = [];

globalThis.chrome = {
  runtime: {
    connect: vi.fn(() => {
      const onMessage = createListenerContainer();
      const onDisconnect = createListenerContainer();
      const port = {
        onMessage,
        onDisconnect,
        postMessage: vi.fn(),
        disconnect: vi.fn(),
        name: ""
      };
      portEntries.push({ onMessage, onDisconnect });
      return port;
    }),
    sendMessage: vi.fn(() => Promise.resolve(null)),
    lastError: undefined,
    onMessage: createListenerContainer() as any,
    onConnect: createListenerContainer() as any,
    onInstalled: createListenerContainer() as any
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve())
    }
  },
  sidePanel: {
    setPanelBehavior: vi.fn(() => Promise.resolve()),
    open: vi.fn(() => Promise.resolve())
  },
  action: {
    onClicked: createListenerContainer() as any
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([{ id: 1 }])),
    sendMessage: vi.fn(() => Promise.resolve(null))
  },
  scripting: {
    executeScript: vi.fn(() => Promise.resolve([]))
  }
} as unknown as typeof chrome;

export { createListenerContainer, portEntries };
