import { PACK_PRICE_IDS, type CheckoutPackSlug } from './catalogue';

export type TokenPackId = CheckoutPackSlug;

export interface TokenPackDefinition {
  id: TokenPackId;
  name: string;
  tokens: number;
  priceEur: number;
  stripePriceId: string;
  highlight?: 'best-value';
}

export const TOKEN_PACKS: TokenPackDefinition[] = [
  {
    id: 'small',
    name: 'Small Pack',
    tokens: 10_000,
    priceEur: 5,
    stripePriceId: PACK_PRICE_IDS.small,
  },
  {
    id: 'medium',
    name: 'Medium Pack',
    tokens: 25_000,
    priceEur: 10,
    stripePriceId: PACK_PRICE_IDS.medium,
    highlight: 'best-value',
  },
  {
    id: 'large',
    name: 'Large Pack',
    tokens: 40_000,
    priceEur: 15,
    stripePriceId: PACK_PRICE_IDS.large,
  },
];

export const DEFAULT_AUTO_REPLENISH_PACK_ID: TokenPackId = 'small';

export function getTokenPackById(id: string | null | undefined) {
  return TOKEN_PACKS.find((pack) => pack.id === id) ?? null;
}

export function getTokenPackByPriceId(priceId: string) {
  return TOKEN_PACKS.find((pack) => pack.stripePriceId === priceId) ?? null;
}
