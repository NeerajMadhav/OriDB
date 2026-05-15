/**
 * Command palette (Cmd+K) — fuzzy navigation across routes and actions.
 */
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { useUiStore } from "../stores/uiStore";

const actions = [
  { id: "home", label: "Home", path: "/" },
  { id: "conn", label: "Connections", path: "/connections" },
  { id: "ws", label: "Workspace", path: "/workspace" },
  { id: "mig", label: "Migrations", path: "/workspace/migrations" },
  { id: "imp", label: "Import / Export", path: "/workspace/import-export" },
  { id: "mon", label: "Monitoring", path: "/workspace/monitoring" },
  { id: "er", label: "ER Diagram", path: "/workspace/er" },
  { id: "diff", label: "Query result diff", path: "/workspace/diff" },
  { id: "multi", label: "Multi-connection query", path: "/workspace/multi" },
  { id: "saved", label: "Saved queries", path: "/workspace/saved" },
  { id: "settings", label: "Settings", path: "/workspace/settings" },
];

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      role="presentation"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="bg-surface-elevated border-border text-text-primary w-full max-w-lg overflow-hidden rounded-lg border shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Command className="oridb-scrollbar max-h-[min(60vh,420px)] overflow-y-auto">
          <Command.Input
            autoFocus
            placeholder="Search actions…"
            className="border-border font-sans w-full border-b px-3 py-2.5 text-sm outline-none"
          />
          <Command.List>
            <Command.Empty className="text-text-muted px-3 py-6 text-center text-sm">
              No results.
            </Command.Empty>
            <Command.Group heading="Navigate">
              {actions.map((a) => (
                <Command.Item
                  key={a.id}
                  value={a.label}
                  onSelect={() => {
                    navigate(a.path);
                    setOpen(false);
                  }}
                  className="text-text-primary aria-selected:bg-selection cursor-pointer px-3 py-2 text-sm"
                >
                  {a.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
