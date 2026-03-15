export type TokenPackId = 'small' | 'medium' | 'large';

export interface TokenPackDefinition {
  id: TokenPackId;
  name: string;
  tokens: number;
  priceEur: number;
  stripePriceId: string;
  stripeCheckoutUrl: string;
  highlight?: 'best-value';
}

export const TOKEN_PACKS: TokenPackDefinition[] = [
  {
    id: 'small',
    name: 'Small Pack',
    tokens: 10_000,
    priceEur: 5,
    stripePriceId: 'price_1SqaxtCs6GUQsp1IL0d9dOgV',
    stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/8x214m9s69Ta5oR4RYbAs03',
  },
  {
    id: 'medium',
    name: 'Medium Pack',
    tokens: 25_000,
    priceEur: 10,
    stripePriceId: 'price_1SqazKCs6GUQsp1IP9mYvV5n',
    stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/dRm8wO9s6d5mbNf2JQbAs02',
    highlight: 'best-value',
  },
  {
    id: 'large',
    name: 'Large Pack',
    tokens: 40_000,
    priceEur: 15,
    stripePriceId: 'price_1Sqb0CCs6GUQsp1INNhNduLq',
    stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/eVq14m1ZE4yQg3v706bAs04',
  },
];

export const DEFAULT_AUTO_REPLENISH_PACK_ID: TokenPackId = 'small';

export function getTokenPackById(id: string | null | undefined) {
  return TOKEN_PACKS.find((pack) => pack.id === id) ?? null;
}

export function getTokenPackByPriceId(priceId: string) {
  return TOKEN_PACKS.find((pack) => pack.stripePriceId === priceId) ?? null;
}
