// lib/server/payments/methodMapper.ts
type PaymentElementConfig = {
  paymentMethodOrder: string[];        // for UI ordering
  paymentMethodTypes: string[];        // Stripe Payment Element types
};

export function mapRegionToPaymentElement(region?: string | null): PaymentElementConfig {
  const r = (region ?? 'GL').toUpperCase();

  // Base
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
      types = ['card', 'us_bank_account']; // ACH
      break;
    case 'BR':
      order = ['card', 'pix', 'boleto'];
      // PIX/BOLETO are region-specific; Stripe auto-selects in Element based on account settings
      types = ['card', 'boleto']; // Pix is wallet-like; Element enables when supported
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

  // Payment Element uses `paymentMethodOrder` for UI. `paymentMethodTypes` limits what shows up.
  return { paymentMethodOrder: order, paymentMethodTypes: types };
}
