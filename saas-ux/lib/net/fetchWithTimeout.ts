// lib/net/fetchWithTimeout.ts
export async function fetchWithTimeout(
  url: string,
  opts: { timeoutMs?: number } & RequestInit = {}
) {
  const { timeoutMs = 5000, ...init } = opts;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: init.redirect ?? "follow" });
  } finally {
    clearTimeout(id);
  }
}
