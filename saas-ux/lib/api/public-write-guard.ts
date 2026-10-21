import 'server-only';
import { rateLimit } from '@/lib/api/rate-limit';

/** Largest JSON body the public stash endpoints accept (they write to public storage). */
export const MAX_PUBLIC_BODY_BYTES = 200 * 1024;

export type GuardResult =
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 413 | 429; error: string };

/**
 * Guards the unauthenticated endpoints that write to public blob storage:
 * a body-size cap, JSON parsing, and a per-IP rate limit (fail-open, so a storage
 * hiccup in the limiter never blocks a real visitor).
 */
export async function guardPublicWrite(req: Request, scope: string): Promise<GuardResult> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_PUBLIC_BODY_BYTES) return { ok: false, status: 413, error: 'Payload too large' };

  const raw = await req.text().catch(() => '');
  if (raw.length > MAX_PUBLIC_BODY_BYTES) return { ok: false, status: 413, error: 'Payload too large' };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' };
  }

  const ip = (req.headers.get('x-forwarded-for') ?? 'anon').split(',')[0].trim();
  try {
    const rl = await rateLimit(`${scope}:${ip}`, 30, 60 * 60 * 1000); // 30 writes / hour / IP
    if (!rl.ok) return { ok: false, status: 429, error: 'Too many requests' };
  } catch (err) {
    console.error('[public-write-guard] rate limiter unavailable, allowing', err);
  }

  return { ok: true, data };
}
