import type { SavedResult } from "../../../src/lib/storage/types";

export function SavedResults(props: {
  results: SavedResult[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="space-y-3 p-3">
      {props.results.length === 0 ? <p className="text-sm text-zinc-400">No saved results yet.</p> : null}
      {props.results.map((result) => (
        <article key={result.id} className="rounded border border-zinc-800 p-3">
          <div className="text-sm font-medium text-zinc-100">{result.title}</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{result.outputMarkdown}</div>
          <button className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onDelete(result.id)}>Delete</button>
        </article>
      ))}
    </section>
  );
}
