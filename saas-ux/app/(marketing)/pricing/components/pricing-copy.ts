"use client";

import { useTranslations } from "next-intl";

export function usePricingCopy() {
  return useTranslations("pricing");
}
