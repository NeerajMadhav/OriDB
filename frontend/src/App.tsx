/**
 * Root routes and layout for OriDB.
 */
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import {
  WorkspaceShell,
  QueryTab,
  VisualTab,
  ErTab,
  MigrationsTab,
  ImportExportTab,
  MonitorTab,
  DiffTab,
  MultiTab,
  SavedTab,
  SettingsTab,
} from "./pages/WorkspacePage";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/workspace" element={<WorkspaceShell />}>
          <Route index element={<QueryTab />} />
          <Route path="visual" element={<VisualTab />} />
          <Route path="er" element={<ErTab />} />
          <Route path="migrations" element={<MigrationsTab />} />
          <Route path="import-export" element={<ImportExportTab />} />
          <Route path="monitoring" element={<MonitorTab />} />
          <Route path="diff" element={<DiffTab />} />
          <Route path="multi" element={<MultiTab />} />
          <Route path="saved" element={<SavedTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Route>
      </Routes>
    </AppShell>
  );
}
