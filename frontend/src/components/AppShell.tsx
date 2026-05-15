/**
 * App chrome — top bar, theme toggle, notifications, command palette trigger.
 */
import { Link, NavLink } from "react-router-dom";
import { Moon, Sun, Bell, Command } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "../stores/uiStore";
import { useSessionStore } from "../stores/sessionStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useAppHotkeys } from "../hooks/useAppHotkeys";
import { CommandPalette } from "./CommandPalette";
import { ToastHost } from "./ToastHost";

export function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const items = useNotificationStore((s) => s.items);
  const [bellOpen, setBellOpen] = useState(false);
  useAppHotkeys();

  useEffect(() => {
    const root = document.documentElement;
    const dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => {
      if (theme !== "system") return;
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [theme]);

  useEffect(() => {
    const ws = new WebSocket(
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`,
    );
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
    };
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(String(ev.data));
        if (d.type === "notify") {
          useNotificationStore.getState().push({
            type: "info",
            title: String(d.title ?? "Notice"),
            body: d.body ? String(d.body) : undefined,
          });
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, []);

  const activeId = useSessionStore((s) => s.activeConnectionId);
  const connectionName = useSessionStore((s) => s.connectionName);
  const connected = useSessionStore((s) => s.connected);

  return (
    <div className="bg-bg text-text-primary flex min-h-screen flex-col">
      <header className="border-border bg-surface flex h-[52px] items-center gap-3 border-b px-3">
        <Link to="/" className="text-text-primary flex items-center gap-1 font-semibold tracking-tight">
          <span className="text-primary">Ori</span>DB
        </Link>
        <nav className="text-text-secondary flex gap-3 text-sm">
          <NavLink
            to="/connections"
            className={({ isActive }) =>
              isActive ? "text-text-primary font-medium" : "hover:text-text-primary"
            }
          >
            Connections
          </NavLink>
          <NavLink
            to="/workspace"
            className={({ isActive }) =>
              isActive ? "text-text-primary font-medium" : "hover:text-text-primary"
            }
          >
            Workspace
          </NavLink>
        </nav>
        <div className="text-text-muted ml-auto flex items-center gap-2 text-xs">
          {activeId && (
            <span className="flex items-center gap-1">
              <span
                className={
                  connected ? "bg-success inline-block h-2 w-2 rounded-full" : "bg-warning inline-block h-2 w-2 rounded-full"
                }
              />
              {connectionName ?? "Connected"}
            </span>
          )}
          <button
            type="button"
            className="border-border hover:bg-selection rounded border p-1"
            title="Command palette"
            aria-label="Command palette"
            onClick={() => setCommandOpen(true)}
          >
            <Command size={16} />
          </button>
          <div className="relative">
            <button
              type="button"
              className="border-border hover:bg-selection rounded border p-1"
              aria-label="Notifications"
              onClick={() => setBellOpen((v) => !v)}
            >
              <Bell size={16} />
            </button>
            {bellOpen && (
              <div className="border-border bg-surface-elevated absolute right-0 z-40 mt-1 w-72 rounded border p-2 text-xs shadow-lg">
                {items.length === 0 ? (
                  <div className="text-text-muted py-4 text-center">No notifications</div>
                ) : (
                  items.map((n) => (
                    <div key={n.id} className="border-border mb-1 border-b pb-1 last:border-0">
                      <div className="text-text-primary font-medium">{n.title}</div>
                      {n.body && (
                        <div className="text-text-muted">{n.body}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="border-border hover:bg-selection rounded border p-1"
            title="Cycle theme"
            aria-label="Cycle theme"
            onClick={() => {
              if (theme === "light") setTheme("dark");
              else if (theme === "dark") setTheme("system");
              else setTheme("light");
            }}
          >
            {theme === "dark" ||
            (theme === "system" &&
              window.matchMedia("(prefers-color-scheme: dark)").matches) ? (
              <Sun size={16} />
            ) : (
              <Moon size={16} />
            )}
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
      <ToastHost />
      <CommandPalette />
    </div>
  );
}
