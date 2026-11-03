// lib/net/fetchWithTimeout.ts
export async function fetchWithTimeout(
  url: string,
  opts: { timeoutMs?: number } & RequestInit = {}
) {
  const { timeoutMs = 5000, signal: external, ...init } = opts;
  const ctrl = new AbortController();
  // A caller's signal also cancels this request, including while its body is being read.
  if (external) {
    if (external.aborted) ctrl.abort();
    else external.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: init.redirect ?? "follow" });
  } finally {
    clearTimeout(id);
  }
}
