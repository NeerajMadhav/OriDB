import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Export current grid data as CSV, Excel, or JSON.
 */
import { useState } from "react";
import { Download, FileSpreadsheet, FileJson, FileText } from "lucide-react";
import { defaultExportBasename, downloadCsv, downloadExcel, downloadJson, } from "../lib/exportData";
import { useUiStore } from "../stores/uiStore";
import { Btn } from "./ui";
export function ExportDataMenu({ columns, rows, basename, disabled, size = "sm", }) {
    const pushToast = useUiStore((s) => s.pushToast);
    const [busy, setBusy] = useState(false);
    const base = basename ?? defaultExportBasename("query-results");
    const guard = () => {
        if (!columns.length || !rows.length) {
            pushToast({ type: "error", message: "No data to export" });
            return false;
        }
        return true;
    };
    const run = async (kind) => {
        if (!guard())
            return;
        setBusy(true);
        try {
            if (kind === "csv") {
                downloadCsv(base, columns, rows);
            }
            else if (kind === "json") {
                downloadJson(base, columns, rows);
            }
            else {
                await downloadExcel(base, columns, rows);
            }
            pushToast({
                type: "success",
                message: `Exported ${rows.length} row${rows.length === 1 ? "" : "s"} as ${kind.toUpperCase()}`,
            });
        }
        catch (e) {
            pushToast({
                type: "error",
                message: e instanceof Error ? e.message : "Export failed",
            });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-wrap items-center gap-1", children: [_jsxs(Btn, { variant: "secondary", size: size, className: "gap-1", disabled: disabled || busy || rows.length === 0, title: "Download CSV", onClick: () => void run("csv"), children: [_jsx(FileText, { className: "h-3.5 w-3.5" }), "CSV"] }), _jsxs(Btn, { variant: "secondary", size: size, className: "gap-1", disabled: disabled || busy || rows.length === 0, title: "Download Excel", onClick: () => void run("xlsx"), children: [_jsx(FileSpreadsheet, { className: "h-3.5 w-3.5" }), "Excel"] }), _jsxs(Btn, { variant: "secondary", size: size, className: "gap-1", disabled: disabled || busy || rows.length === 0, title: "Download JSON", onClick: () => void run("json"), children: [_jsx(FileJson, { className: "h-3.5 w-3.5" }), "JSON"] }), _jsxs("span", { className: "text-text-muted hidden items-center gap-1 text-[10px] sm:inline-flex", children: [_jsx(Download, { className: "h-3 w-3" }), rows.length > 0 ? `${rows.length} rows` : ""] })] }));
}
