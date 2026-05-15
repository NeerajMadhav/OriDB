import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App.tsx";

const rootEl = document.getElementById("root");

function showBootError(message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div style="font-family:system-ui;padding:2rem;max-width:40rem;margin:2rem auto">
      <h1 style="color:#b83228;margin:0 0 0.5rem">OriDB failed to start</h1>
      <pre style="white-space:pre-wrap;background:#f5f0ea;padding:1rem;border-radius:8px;font-size:13px">${message.replace(/</g, "&lt;")}</pre>
      <p style="font-size:14px;color:#5c4a3a">Try clearing site data for localhost, then refresh. If it persists, run <code>npm run dev</code> from the repo root.</p>
    </div>`;
}

if (!rootEl) {
  throw new Error("Missing #root element in index.html");
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
} catch (e) {
  showBootError(e instanceof Error ? e.message : String(e));
  console.error(e);
}
