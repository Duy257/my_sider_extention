import { useState } from "react";
import { SummaryTab } from "./SummaryTab";
import { QATab } from "./QATab";

type CompanionTab = "summary" | "qa";

export function CompanionPanel({
  pageContent,
  title,
  url,
}: {
  pageContent: string;
  title: string;
  url: string;
}) {
  const [activeTab, setActiveTab] = useState<CompanionTab>("summary");

  return (
    <aside className="flex h-full flex-col border-l border-stone-850 bg-surface/50">
      <div className="flex border-b border-stone-850">
        <button
          className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "summary"
              ? "border-b-2 border-primary text-stone-100"
              : "text-stone-500 hover:text-stone-300"
          }`}
          onClick={() => setActiveTab("summary")}
        >
          Tóm tắt
        </button>
        <button
          className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "qa"
              ? "border-b-2 border-primary text-stone-100"
              : "text-stone-500 hover:text-stone-300"
          }`}
          onClick={() => setActiveTab("qa")}
        >
          Hỏi đáp
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {activeTab === "summary" ? (
          <SummaryTab pageContent={pageContent} title={title} url={url} />
        ) : (
          <QATab pageContent={pageContent} />
        )}
      </div>
    </aside>
  );
}
