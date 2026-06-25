import { useEffect, useMemo, useRef, useState } from "react";
import { getProvider } from "../../src/lib/ai/providers";
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
  const [readingPage, setReadingPage] = useState(false);

  const provider = settings ? getProvider(settings.providerId) : undefined;
  const selectedModel = settings && provider ? settings.selectedModels[provider.id]?.trim() || provider.defaultModel?.trim() : "";
  const missingApiKey = useMemo(() => {
    if (!settings || !provider) return true;
    if (!provider.requiresApiKey) return false;
    return !settings.apiKeys[provider.id]?.trim();
  }, [settings, provider]);
  const missingModel = useMemo(() => {
    if (!settings || !provider) return true;
    return !selectedModel;
  }, [settings, provider, selectedModel]);

  useEffect(() => {
    Promise.all([getSettings(), getPromptTemplates(), getSavedResults()]).then(([loadedSettings, loadedPrompts, loadedSaved]) => {
      setSettings(loadedSettings);
      setPrompts(loadedPrompts);
      setSavedResultsState(loadedSaved);
    });
    chrome.runtime.sendMessage({ type: "ACTIVATE_ACTIVE_TAB_AGENT", requestId: crypto.randomUUID() }).catch(() => undefined);
  }, []);

  const sendPromptRef = useRef(sendPrompt);
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
    if (streaming) return;
    setError("");
    setStreaming(true);

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" }
    ]);

    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: AI_STREAM_PORT });
    } catch {
      setStreaming(false);
      setError("Không thể kết nối dịch vụ AI.");
      return;
    }

    port.onDisconnect.addListener(() => {
      setStreaming(false);
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message || "Mất kết nối.");
      }
    });

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
      messages: buildUserChatMessages(text)
    });
  }

  sendPromptRef.current = sendPrompt;

  useEffect(() => {
    function handleMessage(msg: { type: string; prompt?: string }) {
      if (msg.type === "FORWARD_SELECTION_ACTION" && msg.prompt) {
        setView("chat");
        sendPromptRef.current(msg.prompt);
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  async function saveMessage(item: ChatItem) {
    const newResult: SavedResult = {
      id: crypto.randomUUID(),
      title: item.content.slice(0, 60) || "Phản hồi đã lưu",
      sourceType: "chat" as const,
      outputMarkdown: item.content,
      createdAt: new Date().toISOString()
    };
    setSavedResultsState((prev) => {
      const updated = [newResult, ...prev];
      saveSavedResults(updated).catch(() => undefined);
      return updated;
    });
  }

  async function readPage() {
    setError("");
    setReadingPage(true);
    setView("chat");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "EXTRACT_ACTIVE_PAGE",
        requestId: crypto.randomUUID()
      });

      if (response?.error) {
        setError(response.error);
        return;
      }

      if (!response?.text) {
        setError("Trang này không có nội dung đọc được.");
        return;
      }

      sendPrompt(
        [
          "Đọc trang này và tóm tắt từ góc nhìn CEO.",
          "",
          `Tiêu đề: ${response.title}`,
          `URL: ${response.url}`,
          response.warnings?.length ? `Cảnh báo: ${response.warnings.join(" ")}` : "",
          "",
          response.text
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch {
      setError("Không thể đọc trang.");
    } finally {
      setReadingPage(false);
    }
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
  }, [settings?.providerId, selectedModel]);

  if (!settings) {
    return <main className="min-h-screen bg-zinc-950 p-4 text-sm text-zinc-300">Đang tải...</main>;
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <HeaderBar view={view} onViewChange={setView} onReadPage={readPage} readingPage={readingPage} />
      {error ? <div className="border-b border-red-900 bg-red-950 p-2 text-xs text-red-100">{error}</div> : null}
      {view === "settings" ? <SettingsPanel settings={settings} onChange={updateSettings} /> : null}
      {view === "prompts" ? <PromptManager prompts={prompts} onChange={updatePrompts} /> : null}
      {view === "saved" ? <SavedResults results={savedResults} onDelete={(id) => updateSavedResults(savedResults.filter((item) => item.id !== id))} /> : null}
      {view === "chat" ? (
        <>
          {missingApiKey ? (
            <section className="p-3 text-sm text-amber-100">
              {provider ? `Thêm khóa API cho ${provider.label} trong Cài đặt trước khi gửi.` : "Chọn nhà cung cấp trong Cài đặt trước khi gửi."}
            </section>
          ) : missingModel ? (
            <section className="p-3 text-sm text-amber-100">
              {provider ? `Chọn mô hình cho ${provider.label} trong Cài đặt trước khi gửi.` : "Chọn nhà cung cấp trong Cài đặt trước khi gửi."}
            </section>
          ) : null}
          <section className="flex-1 space-y-3 overflow-auto p-3" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 ? <p className="text-sm text-zinc-400">Hỏi về trang, văn bản đã chọn, hoặc công việc của bạn.</p> : null}
            {messages.map((item) => (
              <ChatMessage key={item.id} role={item.role} content={item.content} onSave={item.role === "assistant" ? () => saveMessage(item) : undefined} />
            ))}
          </section>
          <ChatComposer disabled={streaming || missingApiKey || missingModel} onSend={sendPrompt} />
        </>
      ) : null}
    </main>
  );
}
