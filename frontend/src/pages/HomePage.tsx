/**
 * Landing — connect to a saved profile or open workspace.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Database } from "lucide-react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";
import { Btn, Card, EngineBadge, Kbd } from "../components/ui";
import { formatConnectionSubtitle } from "../lib/connectionDisplay";

type Conn = {
  id: string;
  name: string;
  engine: string;
  host?: string;
  environment?: string;
  defaultSchema?: string;
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
  const [allCount, setAllCount] = useState(0);

  useEffect(() => {
    void api<{ connections: Conn[] }>("/connections")
      .then((r) => {
        setAllCount(r.connections.length);
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
      const prev = useSessionStore.getState().activeConnectionId;
      if (prev && prev !== c.id) {
        await api(`/connections/${prev}/disconnect`, { method: "POST" }).catch(
          () => undefined,
        );
      }
      await api(`/connections/${c.id}/connect`, { method: "POST" });
      pushRecent(c.id);
      setActive(c.id, true, {
        name: c.name,
        engine: c.engine,
        defaultSchema: c.defaultSchema,
      });
      pushToast({ type: "success", message: `Connected to ${c.name}` });
      nav("/workspace");
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-16">
      <div className="mb-10 text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm">
          <Database className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <h1 className="text-text-primary mb-2 text-4xl font-semibold tracking-tight">
          <span className="text-primary">Ori</span>DB
        </h1>
        <p className="text-text-secondary mx-auto max-w-md text-sm leading-relaxed">
          Connect once, then query and explore in Workspace. Add PostgreSQL, MySQL, SQLite, and more
          from a single place.
        </p>
      </div>

      <div className="mb-10 flex flex-col items-center gap-3 sm:flex-row">
        <Link to="/connections">
          <Btn variant="primary" className="gap-2 px-8">
            <Database className="h-4 w-4" />
            {allCount > 0 ? "Connections" : "Add your first connection"}
          </Btn>
        </Link>
        {allCount > 0 && (
          <Link to="/workspace">
            <Btn variant="secondary" className="gap-2 px-6">
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </Btn>
          </Link>
        )}
      </div>

      <p className="text-text-muted mb-10 max-w-md text-center text-xs">
        Local <strong className="text-text-secondary">.db</strong> file? Open Connections →{" "}
        <Link to="/connections?mode=sqlite" className="text-primary underline">
          SQLite file
        </Link>
        .
      </p>

      {recent.length > 0 && (
        <Card className="w-full max-w-lg" padding="md">
          <h2 className="text-text-muted mb-4 text-[11px] font-semibold tracking-widest uppercase">
            Recent — click to connect & open workspace
          </h2>
          <ul className="space-y-1">
            {recent.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="oridb-connection-row group w-full"
                  onClick={() => void connect(c)}
                >
                  <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <Database className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="text-text-primary block text-sm font-medium break-words">
                      {c.name}
                    </span>
                    <span
                      className="text-text-muted block text-xs break-all"
                      title={formatConnectionSubtitle(c)}
                    >
                      {formatConnectionSubtitle(c)}
                    </span>
                  </span>
                  <EngineBadge engine={c.engine} />
                  <ArrowRight className="text-text-muted h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-text-muted mt-10 flex items-center gap-1.5 text-xs">
        Press <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> for the command palette
      </p>

      <p className="text-text-muted/60 fixed right-4 bottom-4 font-mono text-[10px]">v1.0.0</p>
    </div>
  );
}

