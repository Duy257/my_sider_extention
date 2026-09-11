import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface AutocompleteOption {
  id: string;
  label: string;
  hint?: string;
}

export interface AutocompleteProps {
  id: string;
  value: string;
  options: AutocompleteOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

function ChevronIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function Autocomplete(props: AutocompleteProps) {
  const { id, value, options, onChange, placeholder, disabled, loading, emptyMessage } = props;
  const reactId = useId();
  const listboxId = `${id}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.id.toLowerCase().includes(needle)
    );
  }, [options, query]);

  // Reset highlight when filter result changes
  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (loading) {
    return (
      <div
        data-testid="autocomplete-skeleton"
        className="h-[46px] w-full animate-pulse rounded-xl bg-warm-bg border border-stone-850"
        aria-hidden="true"
      />
    );
  }

  function commit(option: AutocompleteOption) {
    onChange(option.id);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return;
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      const choice = filtered[highlight];
      if (choice) commit(choice);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setQuery("");
      }
    } else if (event.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  const displayedValue = open ? query : selectedOption?.label ?? "";

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered[highlight] ? `${reactId}-option-${filtered[highlight].id}` : undefined
        }
        className="w-full rounded-xl border border-stone-850 bg-warm-bg px-3.5 py-3 text-[13.5px] font-medium text-stone-100 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-colors shadow-inner disabled:opacity-50"
        value={displayedValue}
        placeholder={selectedOption ? selectedOption.label : placeholder}
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      <ChevronIcon />
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-800 bg-warm-bg shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3.5 py-2.5 text-xs text-stone-500">{emptyMessage ?? "Không có kết quả."}</li>
          ) : (
            filtered.map((option, index) => {
              const isHighlight = index === highlight;
              const isSelected = option.id === value;
              const showHint = option.hint && option.hint !== option.label;
              return (
                <li
                  key={option.id}
                  id={`${reactId}-option-${option.id}`}
                  role="option"
                  aria-selected={isHighlight}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    commit(option);
                  }}
                  className={`flex flex-col gap-0.5 px-3.5 py-2 text-[13px] cursor-pointer ${
                    isHighlight ? "bg-stone-800/60" : ""
                  } ${isSelected ? "bg-primary/15 text-primary" : "text-stone-100"}`}
                >
                  <span className="font-medium">{option.label}</span>
                  {showHint ? <span className="text-[11px] text-stone-500">{option.hint}</span> : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
