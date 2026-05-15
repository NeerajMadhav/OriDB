/**
 * Monaco SQL editor with run/format keybindings.
 */
import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useRef } from "react";
import { useUiStore } from "../stores/uiStore";
import { api } from "../api/client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: (sql: string) => void;
  dialect?: "postgresql" | "mysql" | "sqlite";
};

export function QueryEditor({ value, onChange, onRun, dialect = "postgresql" }: Props) {
  const theme = useUiStore((s) => s.theme);
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(
    null,
  );

  const onMount = useCallback<OnMount>(
    (ed, monaco) => {
      editorRef.current = ed;
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

  return (
    <Editor
      height="100%"
      defaultLanguage="sql"
      theme={dark ? "vs-dark" : "light"}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={onMount}
      options={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 13,
        minimap: { enabled: true },
        wordWrap: "on",
        automaticLayout: true,
        tabSize: 2,
      }}
    />
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
