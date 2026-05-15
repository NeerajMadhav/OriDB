/**
 * Typed fetch helper for OriDB API.
 */
const base = () => import.meta.env.VITE_API_BASE ?? "/api";
function parseJson(text) {
    if (!text.trim())
        return {};
    try {
        return JSON.parse(text);
    }
    catch {
        return { message: text.slice(0, 200) };
    }
}
export async function api(path, init) {
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
    const data = parseJson(text);
    if (!res.ok) {
        const msg = data?.error?.message ?? data?.message ?? res.statusText ?? "Request failed";
        throw new Error(msg);
    }
    return data;
}
export function apiUrl(path) {
    const p = path.startsWith("/") ? path : `/${path}`;
    const b = base().replace(/\/$/, "");
    return `${b}${p}`;
}
