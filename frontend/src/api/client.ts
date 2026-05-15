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
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(init?.headers ?? {}),
      },
      credentials: "include",
    });
  } catch (e) {
    const hint =
      e instanceof TypeError && /fetch/i.test(e.message)
        ? "Cannot reach the OriDB API. Run npm run dev from the repo root and ensure the backend is on port 8037."
        : e instanceof Error
          ? e.message
          : "Network error";
    throw new Error(hint);
  }
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
