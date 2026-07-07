import { useCallback, useEffect, useState } from "react";
import { CompanionPanel } from "./components/CompanionPanel";
import { ProgressBar } from "./components/ProgressBar";
import { ReaderHeader } from "./components/ReaderHeader";
import { ReaderView } from "./components/ReaderView";

type PageData = {
  title: string;
  url: string;
  content: string;
  excerpt: string;
};

export default function App() {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

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
    </div>
  );
}
