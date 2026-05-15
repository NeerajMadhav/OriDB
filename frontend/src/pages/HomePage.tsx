/**
 * Landing — welcome when no connection active; recent connections.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";

type Conn = {
  id: string;
  name: string;
  engine: string;
  host?: string;
  environment?: string;
  lastConnectedAt?: string;
};

const RECENT_KEY = "oridb-recent-connections";

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function pushRecent(id: string): void {
  const list = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export function HomePage() {
  const nav = useNavigate();
  const setActive = useSessionStore((s) => s.setActive);
  const pushToast = useUiStore((s) => s.pushToast);
  const [recent, setRecent] = useState<Conn[]>([]);

  useEffect(() => {
    void api<{ connections: Conn[] }>("/connections")
      .then((r) => {
        const ids = loadRecent();
        setRecent(
          ids
            .map((id) => r.connections.find((c) => c.id === id))
            .filter((c): c is Conn => !!c),
        );
      })
      .catch(() => setRecent([]));
  }, []);

  const connect = async (c: Conn) => {
    try {
      await api(`/connections/${c.id}/connect`, { method: "POST" });
      pushRecent(c.id);
      setActive(c.id, true, { name: c.name, engine: c.engine });
      pushToast({ type: "success", message: `Connected to ${c.name}` });
      nav("/workspace");
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-text-primary mb-2 text-3xl font-semibold tracking-tight">
          <span className="text-primary">Ori</span>
          <span>DB</span>
        </h1>
        <p className="text-text-secondary text-sm">Your universal database workspace</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/connections"
          className="bg-primary hover:bg-primary-hover rounded-full px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150"
        >
          New connection
        </Link>
        <Link
          to="/connections"
          className="border-border text-text-primary hover:bg-selection rounded-full border px-5 py-2.5 text-sm transition-colors duration-150"
        >
          Import connection
        </Link>
      </div>
      {recent.length > 0 && (
        <div className="border-border bg-surface-elevated w-full max-w-md rounded-lg border p-4">
          <h2 className="text-text-secondary mb-3 text-xs font-semibold uppercase tracking-wide">
            Recent connections
          </h2>
          <ul className="space-y-2">
            {recent.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="hover:bg-selection border-border flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm transition-colors duration-150"
                  onClick={() => void connect(c)}
                >
                  <span>
                    <span className="text-text-primary font-medium">{c.name}</span>
                    <span className="text-text-muted ml-2 text-xs">
                      {c.engine}
                      {c.host ? ` · ${c.host}` : ""}
                    </span>
                  </span>
                  {c.environment && (
                    <span className="bg-selection text-text-secondary rounded-full px-2 py-0.5 text-[10px] uppercase">
                      {c.environment}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-text-muted text-xs">
        Press <kbd className="rounded border px-1">Ctrl</kbd>+
        <kbd className="rounded border px-1">K</kbd> for the command palette
      </p>
      <p className="text-text-muted fixed right-3 bottom-3 text-[10px]">v1.0.0</p>
    </div>
  );
}
