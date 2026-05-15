/**
 * App chrome — top bar, theme toggle, notifications, command palette trigger.
 */
import { Link, NavLink } from "react-router-dom";
import { Moon, Sun, Bell, Command, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "../stores/uiStore";
import { useSessionStore } from "../stores/sessionStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useAppHotkeys } from "../hooks/useAppHotkeys";
import { CommandPalette } from "./CommandPalette";
import { ToastHost } from "./ToastHost";

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <span className="oridb-nav-pill" data-active={isActive}>
          {children}
        </span>
      )}
    </NavLink>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="text-text-muted hover:text-text-primary hover:bg-selection flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

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
  const engine = useSessionStore((s) => s.engine);
  const connected = useSessionStore((s) => s.connected);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="bg-bg text-text-primary flex min-h-screen flex-col">
      <header className="border-border bg-surface/80 sticky top-0 z-50 flex h-14 items-center gap-4 border-b px-4 backdrop-blur-md">
        <Link
          to="/"
          className="text-text-primary flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <Database className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span>
            <span className="text-primary">Ori</span>DB
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavItem to="/connections">Connections</NavItem>
          <NavItem to="/workspace">Workspace</NavItem>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {activeId && (
            <Link
              to="/workspace"
              className="border-border bg-surface-elevated hover:border-primary/30 hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 sm:flex"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-success" : "bg-warning"}`}
              />
              <span className="text-text-primary max-w-[120px] truncate font-medium">
                {connectionName ?? "Connected"}
              </span>
              {engine && (
                <span className="text-text-muted font-mono text-[10px] uppercase">
                  {engine}
                </span>
              )}
            </Link>
          )}

          <IconBtn title="Command palette (Ctrl+K)" onClick={() => setCommandOpen(true)}>
            <Command size={17} strokeWidth={2} />
          </IconBtn>

          <div className="relative">
            <IconBtn title="Notifications" onClick={() => setBellOpen((v) => !v)}>
              <Bell size={17} strokeWidth={2} />
              {items.length > 0 && (
                <span className="bg-primary absolute top-1 right-1 h-1.5 w-1.5 rounded-full" />
              )}
            </IconBtn>
            {bellOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40"
                  aria-label="Close notifications"
                  onClick={() => setBellOpen(false)}
                />
                <div className="oridb-card border-border absolute right-0 z-50 mt-2 w-80 overflow-hidden p-0 shadow-lg">
                  <div className="border-border border-b px-3 py-2 text-xs font-semibold tracking-wide uppercase">
                    Notifications
                  </div>
                  <div className="oridb-scrollbar max-h-64 overflow-y-auto p-2">
                    {items.length === 0 ? (
                      <p className="text-text-muted py-6 text-center text-xs">
                        No notifications yet
                      </p>
                    ) : (
                      items.map((n) => (
                        <div
                          key={n.id}
                          className="hover:bg-selection rounded-lg px-2 py-2 transition-colors"
                        >
                          <div className="text-text-primary text-sm font-medium">{n.title}</div>
                          {n.body && (
                            <div className="text-text-muted mt-0.5 text-xs">{n.body}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <IconBtn
            title="Cycle theme"
            onClick={() => {
              if (theme === "light") setTheme("dark");
              else if (theme === "dark") setTheme("system");
              else setTheme("light");
            }}
          >
            {isDark ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
          </IconBtn>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
      <ToastHost />
      <CommandPalette />
    </div>
  );
}
