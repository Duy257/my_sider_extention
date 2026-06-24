import "@testing-library/jest-dom/vitest";

globalThis.chrome = {
  runtime: {
    connect: () => ({
      onMessage: { addListener: () => undefined },
      onDisconnect: { addListener: () => undefined },
      postMessage: () => undefined,
      disconnect: () => undefined
    }),
    sendMessage: () => Promise.resolve(null),
    onMessage: { addListener: () => undefined },
    onConnect: { addListener: () => undefined },
    onInstalled: { addListener: () => undefined }
  },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve()
    }
  },
  sidePanel: {
    setPanelBehavior: () => Promise.resolve(),
    open: () => Promise.resolve()
  },
  action: {
    onClicked: { addListener: () => undefined }
  },
  tabs: {
    query: () => Promise.resolve([{ id: 1 }]),
    sendMessage: () => Promise.resolve(null)
  },
  scripting: {
    executeScript: () => Promise.resolve([])
  }
} as unknown as typeof chrome;
