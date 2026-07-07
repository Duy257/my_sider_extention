document.getElementById("readWithAi")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_READING_COMPANION", requestId: crypto.randomUUID() });
  window.close();
});
