/**
 * Monaco SQL editor with run/format keybindings and schema autocomplete.
 */
import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";
import { useUiStore } from "../stores/uiStore";
import { api } from "../api/client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: (sql: string) => void;
  dialect?: "postgresql" | "mysql" | "sqlite";
  connectionId?: string;
  schema?: string;
  heightPx?: number;
};

export function QueryEditor({
  value,
  onChange,
  onRun,
  dialect = "postgresql",
  connectionId,
  schema = "public",
  heightPx = 280,
}: Props) {
  const theme = useUiStore((s) => s.theme);
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(
    null,
  );
  const completionRef = useRef<{ dispose: () => void } | null>(null);

  const onMount = useCallback<OnMount>(
    (ed, monaco) => {
      editorRef.current = ed;
      ed.focus();
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        const sel = ed.getSelection();
        const model = ed.getModel();
        if (!model) return;
        const sql =
          sel && !sel.isEmpty()
            ? model.getValueInRange(sel)
            : model.getValue();
        onRun(sql);
      });
    },
    [onRun],
  );

  useEffect(() => {
    let cancelled = false;
    void import("monaco-editor").then((monaco) => {
      if (cancelled) return;
      completionRef.current?.dispose();
      completionRef.current = monaco.languages.registerCompletionItemProvider(
        "sql",
        {
          triggerCharacters: [" ", ".", "\n", "_"],
          provideCompletionItems: async (model, position) => {
            const word = model.getWordUntilPosition(position);
            const prefix = word.word;
            if (!prefix && !connectionId) return { suggestions: [] };
            try {
              const r = await api<{
                suggestions: { kind: string; label: string }[];
              }>("/query/autocomplete", {
                method: "POST",
                body: JSON.stringify({
                  prefix: prefix || "",
                  connectionId,
                  schema,
                }),
              });
              const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
              };
              return {
                suggestions: r.suggestions.map((s) => ({
                  label: s.label,
                  kind:
                    s.kind === "table"
                      ? monaco.languages.CompletionItemKind.Class
                      : monaco.languages.CompletionItemKind.Keyword,
                  insertText: s.label,
                  range,
                })),
              };
            } catch {
              return { suggestions: [] };
            }
          },
        },
      );
    });
    return () => {
      cancelled = true;
      completionRef.current?.dispose();
    };
  }, [connectionId, schema]);

  return (
    <div
      className="border-border bg-code-bg overflow-hidden rounded border"
      style={{ height: heightPx, minHeight: 200 }}
    >
      <Editor
        height={heightPx}
        defaultLanguage="sql"
        theme={dark ? "vs-dark" : "vs"}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={onMount}
        loading={
          <div className="text-text-muted flex h-full items-center justify-center text-sm">
            Loading editor…
          </div>
        }
        options={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 13,
          lineNumbers: "on",
          minimap: { enabled: false },
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
          padding: { top: 8, bottom: 8 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, strings: false, comments: false },
        }}
      />
    </div>
  );
}

export async function formatSql(
  sql: string,
  dialect: "postgresql" | "mysql" | "sqlite",
): Promise<string> {
  const r = await api<{ sql: string }>("/query/format", {
    method: "POST",
    body: JSON.stringify({ sql, dialect }),
  });
  return r.sql;
}


