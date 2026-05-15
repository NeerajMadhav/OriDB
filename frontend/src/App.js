import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Root routes and layout for OriDB.
 */
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { WorkspaceShell, QueryTab, VisualTab, ErTab, MigrationsTab, ImportExportTab, MonitorTab, DiffTab, MultiTab, SavedTab, SettingsTab, } from "./pages/WorkspacePage";
export function App() {
    return (_jsx(AppShell, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/connections", element: _jsx(ConnectionsPage, {}) }), _jsxs(Route, { path: "/workspace", element: _jsx(WorkspaceShell, {}), children: [_jsx(Route, { index: true, element: _jsx(QueryTab, {}) }), _jsx(Route, { path: "visual", element: _jsx(VisualTab, {}) }), _jsx(Route, { path: "er", element: _jsx(ErTab, {}) }), _jsx(Route, { path: "migrations", element: _jsx(MigrationsTab, {}) }), _jsx(Route, { path: "import-export", element: _jsx(ImportExportTab, {}) }), _jsx(Route, { path: "monitoring", element: _jsx(MonitorTab, {}) }), _jsx(Route, { path: "diff", element: _jsx(DiffTab, {}) }), _jsx(Route, { path: "multi", element: _jsx(MultiTab, {}) }), _jsx(Route, { path: "saved", element: _jsx(SavedTab, {}) }), _jsx(Route, { path: "settings", element: _jsx(SettingsTab, {}) })] })] }) }));
}
