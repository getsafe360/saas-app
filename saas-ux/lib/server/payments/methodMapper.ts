// lib/server/payments/methodMapper.ts
import 'server-only';
import { listPaymentMethodsForRegion } from '@/lib/db/queries';

type PaymentElementConfig = {
  paymentMethodOrder: string[]; // UI ordering; can include apple_pay/google_pay
  paymentMethodTypes: string[]; // Stripe Payment Element types only
};

const WALLET_CODES = new Set(['apple_pay', 'google_pay']);

/** Map our internal codes → Stripe Payment Element types. */
function toPaymentElementType(code: string): string | undefined {
  switch (code) {
    case 'card':
      return 'card';
    case 'ach_debit':
      return 'us_bank_account';
    case 'sepa_debit':
      return 'sepa_debit';
    case 'sofort':
      return 'sofort';
    case 'giropay':
      return 'giropay';
    case 'bancontact':
      return 'bancontact';
    case 'ideal':
      return 'ideal';
    case 'p24':
      return 'p24';
    case 'eps':
      return 'eps';
    case 'boleto':
      return 'boleto';
    case 'pix':
      return 'pix'; // Stripe will ignore if not enabled on your account/region
    case 'alipay':
      return 'alipay';
    case 'wechat_pay':
      return 'wechat_pay';
    case 'paypal':
      return 'paypal'; // supported in Payment Element when enabled
    // Wallets are *not* paymentMethodTypes; they show with 'card' when supported
    case 'apple_pay':
    case 'google_pay':
      return undefined;
    default:
      return undefined;
  }
}

/** Static fallback identical to your previous behavior. */
function fallbackFor(region?: string | null): PaymentElementConfig {
  const r = (region ?? 'GL').toUpperCase();
  let order: string[] = ['card'];
  let types: string[] = ['card'];

  switch (r) {
    case 'DE':
      order = ['card', 'apple_pay', 'google_pay', 'sepa_debit', 'sofort', 'giropay'];
      types = ['card', 'sepa_debit', 'sofort', 'giropay'];
      break;
    case 'FR':
    case 'ES':
    case 'IT':
    case 'PT':
      order = ['card', 'apple_pay', 'google_pay', 'sepa_debit'];
      types = ['card', 'sepa_debit'];
      break;
    case 'US':
      order = ['card', 'apple_pay', 'google_pay', 'us_bank_account'];
      types = ['card', 'us_bank_account'];
      break;
    case 'BR':
      order = ['card', 'pix', 'boleto'];
      types = ['card', 'boleto']; // Pix shows when supported
      break;
    case 'AU':
    case 'NZ':
      order = ['card', 'apple_pay', 'google_pay'];
      types = ['card'];
      break;
    default:
      order = ['card', 'apple_pay', 'google_pay'];
      types = ['card'];
  }

  return { paymentMethodOrder: order, paymentMethodTypes: types };
}

/**
 * DB-driven mapper: builds Payment Element config from region mapping.
 * Falls back to static mapping if DB has no rows or throws.
 */
export async function mapRegionToPaymentElement(
  region?: string | null,
  locale: string = 'en'
): Promise<PaymentElementConfig> {
  const regionCode = (region ?? 'GL').toUpperCase();

  try {
    const methods = await listPaymentMethodsForRegion({ regionCode, locale });
    const enabled = methods.filter((m) => m.enabled).sort((a, b) => a.priority - b.priority);

    if (enabled.length === 0) return fallbackFor(region);

    // UI order: use your codes in priority order (wallets allowed here)
    const paymentMethodOrder: string[] = [];
    for (const m of enabled) {
      if (!paymentMethodOrder.includes(m.code)) paymentMethodOrder.push(m.code);
    }

    // Allowed types: map to valid Payment Element types (exclude wallets)
    const paymentMethodTypes: string[] = [];
    for (const m of enabled) {
      const t = toPaymentElementType(m.code);
      if (t && !paymentMethodTypes.includes(t)) paymentMethodTypes.push(t);
    }

    // If 'card' is enabled, wallets show automatically when supported; keep order hints if present
    return { paymentMethodOrder, paymentMethodTypes };
  } catch {
    // Any DB error → safe fallback
    return fallbackFor(region);
  }
}
