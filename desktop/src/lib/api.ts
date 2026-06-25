// Thin wrapper around fetch that prefers the Tauri HTTP plugin (avoids CORS) when available.

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const WEB_BASE = import.meta.env.VITE_WEB_URL || "http://localhost:3000";

export interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

let cachedFetcher: Fetcher | null = null;

async function getFetcher(): Promise<Fetcher> {
  if (cachedFetcher) return cachedFetcher;
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    try {
      const mod = await import("@tauri-apps/plugin-http");
      cachedFetcher = (input, init) => mod.fetch(input, init);
      return cachedFetcher;
    } catch {
      /* fall through */
    }
  }
  cachedFetcher = (input, init) => fetch(input, init);
  return cachedFetcher;
}

export async function api<T = unknown>(
  path: string,
  opts: FetchOptions = {},
): Promise<T> {
  const { body, headers, timeoutMs = 15_000, ...rest } = opts;
  const f = await getFetcher();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await f(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(headers as Record<string, string> | undefined),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function getApiBase(): string {
  return API_BASE;
}

export function getWebBase(): string {
  return WEB_BASE;
}
