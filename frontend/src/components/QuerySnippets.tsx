/**
 * Quick-insert predefined SQL snippets above the editor.
 */
import { BookOpen } from "lucide-react";
import type { QuerySnippet } from "../lib/querySnippets";

export function QuerySnippets({
  snippets,
  onInsert,
}: {
  snippets: QuerySnippet[];
  onInsert: (sql: string) => void;
}) {
  return (
    <div className="border-border bg-surface flex shrink-0 flex-wrap items-center gap-1.5 rounded border px-2 py-1.5">
      <span className="text-text-muted flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
        <BookOpen className="h-3 w-3" />
        Quick SQL
      </span>
      {snippets.map((s) => (
        <button
          key={s.id}
          type="button"
          title={s.description}
          className="border-border hover:bg-selection text-text-primary rounded border px-2 py-0.5 text-[11px] transition-colors"
          onClick={() => onInsert(s.sql)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
