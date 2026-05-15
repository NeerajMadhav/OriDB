/**
 * Typed fetch helper for OriDB API.
 */
const base = () => import.meta.env.VITE_API_BASE ?? "/api";

function parseJson(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 200) };
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });
  const text = await res.text();
  const data = parseJson(text) as {
    error?: { message?: string };
    message?: string;
  };
  if (!res.ok) {
    const msg =
      data?.error?.message ?? data?.message ?? res.statusText ?? "Request failed";
    throw new Error(msg);
  }
  return data as T;
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const b = base().replace(/\/$/, "");
  return `${b}${p}`;
}
