/**
 * 3-panel resizable workspace — schema sidebar, center, inspector.
 */
import type { ReactNode } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import { StatusBar } from "./StatusBar";

export function WorkspaceLayout({
  sidebar,
  center,
  inspector,
}: {
  sidebar: ReactNode;
  center: ReactNode;
  inspector: ReactNode;
}) {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const inspectorCollapsed = useUiStore((s) => s.inspectorCollapsed);
  const centerMaximized = useUiStore((s) => s.centerMaximized);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleInspector = useUiStore((s) => s.toggleInspector);

  const hideSide = centerMaximized || sidebarCollapsed;
  const hideInsp = centerMaximized || inspectorCollapsed;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <PanelGroup direction="horizontal" autoSaveId="oridb-workspace-panels">
          {!hideSide && (
            <>
              <Panel defaultSize={18} minSize={12} maxSize={35}>
                <div className="bg-surface-elevated flex h-full flex-col shadow-sm">
                  {sidebar}
                </div>
              </Panel>
              <PanelResizeHandle className="bg-border hover:bg-primary w-1 transition-colors duration-150" />
            </>
          )}
          <Panel minSize={40}>
            <div className="flex h-full min-h-0 flex-col">{center}</div>
          </Panel>
          {!hideInsp && (
            <>
              <PanelResizeHandle className="bg-border hover:bg-primary w-1 transition-colors duration-150" />
              <Panel defaultSize={22} minSize={15} maxSize={40}>
                <div className="bg-surface-elevated flex h-full flex-col shadow-sm">
                  {inspector}
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
        {!hideSide && (
          <button
            type="button"
            title="Toggle sidebar (Cmd+B)"
            aria-label="Toggle sidebar"
            className="border-border bg-surface-elevated text-text-muted hover:text-text-primary absolute top-2 left-0 z-10 rounded-r border border-l-0 p-0.5 transition-colors duration-150"
            onClick={toggleSidebar}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {hideSide && (
          <button
            type="button"
            title="Show sidebar"
            aria-label="Show sidebar"
            className="border-border bg-surface-elevated text-text-muted absolute top-2 left-0 z-10 rounded border p-0.5"
            onClick={toggleSidebar}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {!hideInsp && (
          <button
            type="button"
            title="Toggle inspector (Cmd+J)"
            aria-label="Toggle inspector"
            className="border-border bg-surface-elevated text-text-muted hover:text-text-primary absolute top-2 right-0 z-10 rounded-l border border-r-0 p-0.5 transition-colors duration-150"
            onClick={toggleInspector}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {hideInsp && (
          <button
            type="button"
            title="Show inspector"
            aria-label="Show inspector"
            className="border-border bg-surface-elevated text-text-muted absolute top-2 right-0 z-10 rounded border p-0.5"
            onClick={toggleInspector}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>
      <StatusBar />
    </div>
  );
}
