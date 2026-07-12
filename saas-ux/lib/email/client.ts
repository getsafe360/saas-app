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

export const FROM = 'GetSafe360 AI <support@getsafe360.ai>';
export const BASE_URL = 'https://www.getsafe360.ai';
