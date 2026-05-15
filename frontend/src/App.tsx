/**
 * Root routes — lazy-loaded pages so home does not pull Monaco/Recharts.
 */
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";

const HomePage = lazy(() =>
  import("./pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const ConnectionsPage = lazy(() =>
  import("./pages/ConnectionsPage").then((m) => ({ default: m.ConnectionsPage })),
);
const WorkspaceShell = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.WorkspaceShell })),
);
const QueryTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.QueryTab })),
);
const VisualTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.VisualTab })),
);
const ErTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.ErTab })),
);
const MigrationsTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.MigrationsTab })),
);
const ImportExportTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.ImportExportTab })),
);
const MonitorTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.MonitorTab })),
);
const DiffTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.DiffTab })),
);
const MultiTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.MultiTab })),
);
const SavedTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.SavedTab })),
);
const SettingsTab = lazy(() =>
  import("./pages/WorkspacePage").then((m) => ({ default: m.SettingsTab })),
);

function PageFallback() {
  return (
    <div className="text-text-muted flex min-h-[50vh] items-center justify-center text-sm">
      Loading…
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary title="OriDB encountered an error">
      <AppShell>
        <Suspense fallback={<PageFallback />}>
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
        </Suspense>
      </AppShell>
    </ErrorBoundary>
  );
}
