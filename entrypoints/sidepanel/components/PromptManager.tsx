import type { PromptTemplate } from "../../../src/lib/prompts/types";

export function PromptManager(props: {
  prompts: PromptTemplate[];
  onChange: (prompts: PromptTemplate[]) => void;
}) {
  function updatePrompt(id: string, instruction: string) {
    props.onChange(
      props.prompts.map((prompt) =>
        prompt.id === id ? { ...prompt, instruction, updatedAt: new Date().toISOString() } : prompt
      )
    );
  }

  function addPrompt() {
    const now = new Date().toISOString();
    props.onChange([
      ...props.prompts,
      {
        id: crypto.randomUUID(),
        name: "Custom prompt",
        instruction: "Analyze this content and return concise practical recommendations.",
        category: "custom",
        sortOrder: props.prompts.length,
        createdAt: now,
        updatedAt: now
      }
    ]);
  }

  function deletePrompt(id: string) {
    props.onChange(props.prompts.filter((prompt) => prompt.id !== id));
  }

  return (
    <section className="space-y-3 p-3">
      <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={addPrompt}>New prompt</button>
      {props.prompts.map((prompt) => (
        <article key={prompt.id} className="rounded border border-zinc-800 p-3">
          <div className="text-sm font-medium text-zinc-100">{prompt.name}</div>
          <textarea
            className="mt-2 h-24 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
            value={prompt.instruction}
            onChange={(event) => updatePrompt(prompt.id, event.target.value)}
          />
          <button className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => deletePrompt(prompt.id)}>Delete</button>
        </article>
      ))}
    </section>
  );
}
