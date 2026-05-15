/**
 * Bottom status bar — connection, query metrics, WebSocket, transaction.
 */
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

export function StatusBar() {
  const connId = useSessionStore((s) => s.activeConnectionId);
  const connected = useSessionStore((s) => s.connected);
  const lastQueryMs = useWorkspaceStore((s) => s.lastQueryMs);
  const lastRows = useWorkspaceStore((s) => s.lastRows);
  const lastAffected = useWorkspaceStore((s) => s.lastAffected);
  const wsConnected = useWorkspaceStore((s) => s.wsConnected);
  const inTransaction = useWorkspaceStore((s) => s.inTransaction);
  const setWsConnected = useWorkspaceStore((s) => s.setWsConnected);
  const [conn, setConn] = useState<{ name: string; engine: string } | null>(null);

  useEffect(() => {
    if (!connId) {
      setConn(null);
      return;
    }
    void api<{ connections: { id: string; name: string; engine: string }[] }>(
      "/connections",
    ).then((r) => {
      const c = r.connections.find((x) => x.id === connId);
      setConn(c ? { name: c.name, engine: c.engine } : null);
    });
  }, [connId]);

  useEffect(() => {
    const ws = new WebSocket(
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`,
    );
    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: "subscribe", channel: "importProgress" }));
    };
    ws.onclose = () => setWsConnected(false);
    return () => ws.close();
  }, [setWsConnected]);

  const dot =
    connected && connId
      ? "bg-success"
      : connId
        ? "bg-warning"
        : "bg-error";

  return (
    <footer className="border-border bg-surface text-text-secondary flex h-6 shrink-0 items-center justify-between border-t px-2 font-mono text-[11px]">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} title="Connection status" />
        <span className="text-text-primary">{conn?.name ?? "No connection"}</span>
        {conn && <span className="text-text-muted">{conn.engine}</span>}
      </div>
      <div className="flex items-center gap-3">
        {lastQueryMs != null && <span>{lastQueryMs} ms</span>}
        {lastRows != null && <span>{lastRows} rows</span>}
        {lastAffected != null && lastAffected > 0 && (
          <span>{lastAffected} affected</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {inTransaction && (
          <span className="bg-warning/20 text-warning rounded-full px-2 py-0.5">TX</span>
        )}
        <span className={wsConnected ? "text-success" : "text-text-muted"}>
          WS {wsConnected ? "on" : "off"}
        </span>
        <span className="text-text-muted rounded border px-1">:8037</span>
      </div>
    </footer>
  );
}
