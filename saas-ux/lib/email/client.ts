import 'server-only';
import { Resend } from 'resend';

let _client: Resend | null = null;

export function getResend(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _client = new Resend(key);
  }
  return _client;
}

// The sending domain must be verified in Resend. Only mail.getsafe360.ai is
// verified (the root getsafe360.ai is not), so the default sits on it. A new
// variable name is used on purpose: RESEND_FROM was documented as
// orders@getsafe360.ai and may still hold that unverified address in Vercel.
export const FROM = process.env.EMAIL_FROM ?? 'GetSafe 360 AI <hello@mail.getsafe360.ai>';
// Replies go to a real, receiving inbox: the sending address above lives on a
// sending-only subdomain, so a customer hitting "Reply" would otherwise bounce.
export const REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'support@getsafe360.ai';
export const BASE_URL = 'https://www.getsafe360.ai';
