import { useEffect, useMemo, useState } from "react";
import { buildUserChatMessages } from "../../src/lib/prompts/builders";
import { getPromptTemplates, getSavedResults, getSettings, savePromptTemplates, saveSavedResults, saveSettings } from "../../src/lib/storage";
import type { PromptTemplate } from "../../src/lib/prompts/types";
import type { SavedResult, Settings } from "../../src/lib/storage/types";
import { AI_STREAM_PORT } from "../../src/lib/messaging/ports";
import type { AiPortResponse } from "../../src/lib/messaging/types";
import { ChatComposer } from "./components/ChatComposer";
import { ChatMessage } from "./components/ChatMessage";
import { HeaderBar, type HeaderView } from "./components/HeaderBar";
import { PromptManager } from "./components/PromptManager";
import { SavedResults } from "./components/SavedResults";
import { SettingsPanel } from "./components/SettingsPanel";

type ChatItem = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export default function App() {
  const [view, setView] = useState<HeaderView>("chat");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [savedResults, setSavedResultsState] = useState<SavedResult[]>([]);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  const missingApiKey = useMemo(() => !settings?.openaiApiKey?.trim(), [settings]);

  useEffect(() => {
    Promise.all([getSettings(), getPromptTemplates(), getSavedResults()]).then(([loadedSettings, loadedPrompts, loadedSaved]) => {
      setSettings(loadedSettings);
      setPrompts(loadedPrompts);
      setSavedResultsState(loadedSaved);
    });
  }, []);

  async function updateSettings(next: Settings) {
    setSettings(next);
    await saveSettings(next);
  }

  async function updatePrompts(next: PromptTemplate[]) {
    setPrompts(next);
    await savePromptTemplates(next);
  }

  async function updateSavedResults(next: SavedResult[]) {
    setSavedResultsState(next);
    await saveSavedResults(next);
  }

  function sendPrompt(text: string) {
    if (!settings) return;
    setError("");
    setStreaming(true);

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" }
    ]);

    const port = chrome.runtime.connect({ name: AI_STREAM_PORT });
    port.onMessage.addListener((message: AiPortResponse) => {
      if (message.requestId !== requestId) return;

      if (message.type === "AI_STREAM_CHUNK") {
        setMessages((current) =>
          current.map((item) => (item.id === assistantId ? { ...item, content: item.content + message.delta } : item))
        );
      }

      if (message.type === "AI_STREAM_DONE") {
        setStreaming(false);
        port.disconnect();
      }

      if (message.type === "AI_STREAM_ERROR") {
        setStreaming(false);
        setError(message.message);
        port.disconnect();
      }
    });

    port.postMessage({
      type: "AI_CHAT_REQUEST",
      requestId,
      messages: buildUserChatMessages(text),
      model: settings.modelPreset || "gpt-5.4-mini"
    });
  }

  async function saveMessage(item: ChatItem) {
    const next = [
      {
        id: crypto.randomUUID(),
        title: item.content.slice(0, 60) || "Saved response",
        sourceType: "chat" as const,
        outputMarkdown: item.content,
        createdAt: new Date().toISOString()
      },
      ...savedResults
    ];
    await updateSavedResults(next);
  }

  async function readPage() {
    setError("");
    setView("chat");
    const response = await chrome.runtime.sendMessage({
      type: "EXTRACT_ACTIVE_PAGE",
      requestId: crypto.randomUUID()
    });

    if (response?.error) {
      setError(response.error);
      return;
    }

    if (!response?.text) {
      setError("This page did not return readable content.");
      return;
    }

    sendPrompt(
      [
        "Read this page and summarize it from a CEO perspective.",
        "",
        `Title: ${response.title}`,
        `URL: ${response.url}`,
        response.warnings?.length ? `Warnings: ${response.warnings.join(" ")}` : "",
        "",
        response.text
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "GET_PENDING_SELECTION_PROMPT", requestId: crypto.randomUUID() })
      .then((pending) => {
        if (pending?.prompt) {
          setView("chat");
          sendPrompt(pending.prompt);
        }
      })
      .catch(() => undefined);
  }, [settings?.openaiApiKey]);

  if (!settings) {
    return <main className="min-h-screen bg-zinc-950 p-4 text-sm text-zinc-300">Loading...</main>;
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <HeaderBar view={view} onViewChange={setView} onReadPage={readPage} />
      {error ? <div className="border-b border-red-900 bg-red-950 p-2 text-xs text-red-100">{error}</div> : null}
      {view === "settings" ? <SettingsPanel settings={settings} onChange={updateSettings} /> : null}
      {view === "prompts" ? <PromptManager prompts={prompts} onChange={updatePrompts} /> : null}
      {view === "saved" ? <SavedResults results={savedResults} onDelete={(id) => updateSavedResults(savedResults.filter((item) => item.id !== id))} /> : null}
      {view === "chat" ? (
        <>
          {missingApiKey ? (
            <section className="p-3 text-sm text-amber-100">Add your OpenAI API key in Settings before sending requests.</section>
          ) : null}
          <section className="flex-1 space-y-3 overflow-auto p-3">
            {messages.length === 0 ? <p className="text-sm text-zinc-400">Ask about the page, selected text, or your work.</p> : null}
            {messages.map((item) => (
              <ChatMessage key={item.id} role={item.role} content={item.content} onSave={item.role === "assistant" ? () => saveMessage(item) : undefined} />
            ))}
          </section>
          <ChatComposer disabled={streaming || missingApiKey} onSend={sendPrompt} />
        </>
      ) : null}
    </main>
  );
}
