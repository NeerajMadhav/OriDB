import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Monaco SQL editor with run/format keybindings.
 */
import Editor from "@monaco-editor/react";
import { useCallback, useRef } from "react";
import { useUiStore } from "../stores/uiStore";
import { api } from "../api/client";
export function QueryEditor({ value, onChange, onRun, dialect = "postgresql" }) {
    const theme = useUiStore((s) => s.theme);
    const dark = theme === "dark" ||
        (theme === "system" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
    const editorRef = useRef(null);
    const onMount = useCallback((ed, monaco) => {
        editorRef.current = ed;
        ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            const sel = ed.getSelection();
            const model = ed.getModel();
            if (!model)
                return;
            const sql = sel && !sel.isEmpty()
                ? model.getValueInRange(sel)
                : model.getValue();
            onRun(sql);
        });
    }, [onRun]);
    return (_jsx(Editor, { height: "100%", defaultLanguage: "sql", theme: dark ? "vs-dark" : "light", value: value, onChange: (v) => onChange(v ?? ""), onMount: onMount, options: {
            fontFamily: "var(--font-mono), monospace",
            fontSize: 13,
            minimap: { enabled: true },
            wordWrap: "on",
            automaticLayout: true,
            tabSize: 2,
        } }));
}
export async function formatSql(sql, dialect) {
    const r = await api("/query/format", {
        method: "POST",
        body: JSON.stringify({ sql, dialect }),
    });
    return r.sql;
}
