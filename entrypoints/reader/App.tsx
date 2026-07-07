import { useCallback, useEffect, useState } from "react";
import { CompanionPanel } from "./components/CompanionPanel";
import { DefinitionPopover } from "./components/DefinitionPopover";
import { ProgressBar } from "./components/ProgressBar";
import { ReaderHeader } from "./components/ReaderHeader";
import { ReaderView } from "./components/ReaderView";
import type { SelectionInfo } from "./types";

type PageData = {
  title: string;
  url: string;
  content: string;
  excerpt: string;
};

export default function App() {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "READER_CONTENT_READY", requestId: crypto.randomUUID() });

    function handleMessage(msg: any) {
      if (msg.type === "LOAD_READER_CONTENT") {
        setPageData({
          title: msg.title || "",
          url: msg.url || "",
          content: msg.content || "",
          excerpt: msg.excerpt || "",
        });
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
    }).then(() => setSaveStatus("saved")).catch(() => setSaveStatus("idle"));
  }, [saveStatus, pageData]);

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
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto">
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
              window.dispatchEvent(new CustomEvent("reader-ask-more", { detail: text }));
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
