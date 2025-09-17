// saas-ux//types/route-params.ts
// Small helpers for Next 15 async params/searchParams
export type Awaitable<T> = T | Promise<T>;

export type SearchParams = Awaitable<
  Record<string, string | string[] | undefined>
>;

// Add any dynamic segments you need via the generic
export type LocaleParams<T extends Record<string, string> = {}> =
  Awaitable<{ locale: string } & T>;
// saas-ux/types/route-params.ts
export type ServerLocaleParams<T extends Record<string, string> = {}> =
  Promise<{ locale: string } & T>;

export type ServerSearchParams =
  Promise<Record<string, string | string[] | undefined>>;
