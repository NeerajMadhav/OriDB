/**
 * WebSocket hub — multiplexed channels: queryStream, importProgress, monitorTail, notifications.
 */
import type { Server } from "node:http";
import { WebSocketServer } from "ws";

const channels = new Map<string, Set<import("ws").WebSocket>>();

export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "hello", channels: Object.keys(Object.fromEntries(channels)) }));
    let current: string | null = null;
    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          channel?: string;
        };
        if (msg.type === "subscribe" && msg.channel) {
          if (current) {
            channels.get(current)?.delete(socket);
          }
          current = msg.channel;
          if (!channels.has(current)) channels.set(current, new Set());
          channels.get(current)!.add(socket);
          socket.send(JSON.stringify({ type: "subscribed", channel: current }));
        }
      } catch {
        /* ignore */
      }
    });
    socket.on("close", () => {
      if (current) channels.get(current)?.delete(socket);
    });
  });
  return wss;
}

export function broadcast(channel: string, payload: unknown): void {
  const set = channels.get(channel);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const s of set) {
    if (s.readyState === s.OPEN) s.send(data);
  }
}
