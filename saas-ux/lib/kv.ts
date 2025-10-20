let mem = new Map<string, { value: string; expiresAt: number }>();

export async function kvGet(key: string): Promise<string | null> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const r = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });
    if (!r.ok) return null;
    const { result } = await r.json().catch(() => ({ result: null }));
    return (typeof result === "string" && result) || null;
  }
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && hit.expiresAt > now) return hit.value;
  return null;
}

export async function kvSet(key: string, value: string, ttlSeconds: number) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    await fetch(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
      body: JSON.stringify({ value, ex: ttlSeconds })
    }).catch(() => {});
  } else {
    mem.set(key, { value, expiresAt });
  }
}
