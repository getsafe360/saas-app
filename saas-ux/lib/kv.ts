let mem = new Map<string, { value: string; expiresAt: number }>();
let memCounter = new Map<string, number>();

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

export async function kvIncr(key: string, delta = 1): Promise<number> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const target = `${process.env.KV_REST_API_URL}/incr/${encodeURIComponent(key)}`;
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      },
      body: JSON.stringify({ by: delta }),
    }).catch(() => null);

    if (res?.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        result?: number | string;
      };
      const asNumber =
        typeof payload.result === "number"
          ? payload.result
          : Number(payload.result);
      if (Number.isFinite(asNumber)) return asNumber;
    }
  }

  const next = (memCounter.get(key) ?? 0) + delta;
  memCounter.set(key, next);
  return next;
}
