import { useState } from "react";
import type { ToolDevTrace } from "../../core/devtools/types";
import { DEV_COPY } from "../../core/devtools/copy";

type ToolTraceCardProps = {
  trace: ToolDevTrace;
  compact?: boolean;
};

type Scalar = string | number | boolean;
function isScalar(v: unknown): v is Scalar {
  const t = typeof v;
  return t === "string" || t === "number" || t === "boolean";
}

export function ToolTraceCard({ trace, compact }: ToolTraceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getElapsedTime = () => {
    if (trace.finishedAt === undefined) return "";
    return `${trace.finishedAt - trace.startedAt} ms`;
  };

  const metadataEntries = Object.entries(trace.metadata ?? {}).filter(
    (entry): entry is [string, Scalar] => isScalar(entry[1])
  );

  return (
    <section
      role="region"
      aria-label="Tool trace"
      className={`rounded-xl border border-stone-850 bg-stone-950 font-mono text-[11px] text-stone-400 ${compact ? "p-2" : "p-3"}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`tool-trace-${trace.requestId}`}
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between font-semibold tracking-wide text-stone-300 outline-none hover:text-violet-400 transition-colors cursor-pointer"
      >
        <span className="uppercase">
          {DEV_COPY.tool} / {trace.tool}
        </span>
        <div className="flex items-center gap-2">
          {trace.finishedAt !== undefined && (
            <span className="text-[10px] text-stone-500">{getElapsedTime()}</span>
          )}
          <span className="text-[9px] text-stone-500">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {expanded && (
        <div
          id={`tool-trace-${trace.requestId}`}
          className="mt-3.5 space-y-2.5 border-t border-stone-900 pt-3"
        >
          <div className="space-y-0.5 text-stone-400 pl-2">
            {metadataEntries.map(([key, value]) => {
              const label = DEV_COPY.metadataLabels[key] ?? key;
              return (
                <div key={key}>
                  {label}: <span className="text-stone-300">{String(value)}</span>
                </div>
              );
            })}
            <div>
              {DEV_COPY.status.toLowerCase()}: <span className={`font-semibold ${
                trace.status === "success" ? "text-emerald-400" :
                trace.status === "pending" ? "text-amber-400" : "text-red-400"
              }`}>{trace.status}</span>
            </div>
            {trace.error && (
              <div className="text-red-400 break-all mt-1 bg-red-950/20 border border-red-900/20 p-1.5 rounded">{trace.error}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
