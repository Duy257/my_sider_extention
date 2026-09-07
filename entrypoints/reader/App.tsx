import { useCallback, useEffect, useState } from "react";
import { CompanionPanel } from "./components/CompanionPanel";
import { DefinitionPopover } from "./components/DefinitionPopover";
import { ProgressBar } from "./components/ProgressBar";
import { ReaderHeader } from "./components/ReaderHeader";
import { ReaderView } from "./components/ReaderView";
import type { SelectionInfo } from "./types";
import { ToolTraceCard } from "../../src/components/devtools/ToolTraceCard";
import type { ToolDevTrace } from "../../src/core/devtools/types";
import type { ExtensionMessage } from "../../src/core/messaging/types";
import { EVENTS, EXTRACTION_LIMITS } from "../../src/constants";

type PageData = {
  title: string;
  url: string;
  content: string;
  excerpt: string;
};

// Chỉ hai message này là App quan tâm; type guard thay cho `msg: any`
type ReaderLoadMessage = Extract<ExtensionMessage, { type: "LOAD_READER_CONTENT" | "LOAD_READER_ERROR" }>;

function isReaderLoadMessage(msg: unknown): msg is ReaderLoadMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const type = (msg as { type?: unknown }).type;
  return type === "LOAD_READER_CONTENT" || type === "LOAD_READER_ERROR";
}

export default function App() {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [toolTrace, setToolTrace] = useState<ToolDevTrace | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('requestId') || crypto.randomUUID();
    chrome.runtime.sendMessage({ type: "READER_CONTENT_READY", requestId }).catch(() => {});

    function handleMessage(msg: unknown) {
      if (!isReaderLoadMessage(msg) || msg.requestId !== requestId) return;

      if (msg.type === "LOAD_READER_CONTENT") {
        setPageData({
          title: typeof msg.title === "string" ? msg.title : "",
          url: typeof msg.url === "string" ? msg.url : "",
          content: typeof msg.content === "string" ? msg.content : "",
          excerpt: typeof msg.excerpt === "string" ? msg.excerpt : "",
        });
        if (msg.toolTrace) {
          setToolTrace(msg.toolTrace);
        }
      } else {
        setError(typeof msg.error === "string" && msg.error ? msg.error : "Không thể tải nội dung.");
        if (msg.toolTrace) {
          setToolTrace(msg.toolTrace);
        }
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const handleBack = useCallback(() => {
    window.close();
  }, []);

  const handleSave = useCallback(() => {
    if (saveStatus !== "idle") return;
    setSaveStatus("saving");
    chrome.runtime.sendMessage({
      type: "READER_SAVE_SESSION",
      requestId: crypto.randomUUID(),
      title: pageData?.title || "",
      url: pageData?.url || "",
      summary: "",
      date: new Date().toISOString(),
    }).then((response) => {
      // Background trả về { ok: false; error } khi ghi storage thất bại
      const failed = Boolean(response) && (response as { ok?: unknown }).ok === false;
      setSaveStatus(failed ? "idle" : "saved");
    }).catch(() => setSaveStatus("idle"));
  }, [saveStatus, pageData]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-warm-bg text-stone-50 font-mono p-4">
        <div className="max-w-md w-full space-y-4">
          <div className="rounded-xl border border-red-900/30 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
          {toolTrace && <ToolTraceCard trace={toolTrace} />}
        </div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-bg">
        <div className="flex items-center gap-3 text-stone-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium">Đang tải nội dung...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-warm-bg text-stone-50">
      <ProgressBar />
      <ReaderHeader
        title={pageData.title}
        onBack={handleBack}
        onSave={handleSave}
        saving={saveStatus === "saving"}
        saved={saveStatus === "saved"}
      />
      {pageData.content.length >= EXTRACTION_LIMITS.MAX_CONTEXT_CHARS ? (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-amber-900/30 bg-amber-950/20 px-3.5 py-2 text-xs text-amber-400">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Nội dung đã bị cắt bớt do trang quá dài.</span>
        </div>
      ) : null}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto">
          {toolTrace && (
            <div className="mx-4 mt-4 animate-fade-in-up">
              <ToolTraceCard trace={toolTrace} />
            </div>
          )}
          <ReaderView
            content={pageData.content}
            title={pageData.title}
            url={pageData.url}
            onSelection={setSelection}
            onDismissSelection={() => setSelection(null)}
          />
          <DefinitionPopover
            selection={selection}
            onAskMore={(text) => {
              setSelection(null);
              window.dispatchEvent(new CustomEvent<string>(EVENTS.READER_ASK_MORE, { detail: text }));
            }}
            onDismiss={() => setSelection(null)}
          />
        </main>
        <aside className="hidden lg:block w-[340px] flex-shrink-0">
          <CompanionPanel
            pageContent={pageData.content}
            title={pageData.title}
            url={pageData.url}
          />
        </aside>
      </div>

      {!showBottomSheet && (
        <button
          onClick={() => setShowBottomSheet(true)}
          className="fixed bottom-4 right-4 z-50 lg:hidden rounded-full bg-primary p-3 shadow-lg"
        >
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {showBottomSheet && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBottomSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] animate-fade-in-up">
            <CompanionPanel
              pageContent={pageData.content}
              title={pageData.title}
              url={pageData.url}
            />
          </div>
        </div>
      )}
    </div>
  );
}
