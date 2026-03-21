"use client";

import { useTranslations } from "next-intl";

export function usePricingCopy() {
  const t = useTranslations("pricing");

  return (key: string) => t(key as never);
}
