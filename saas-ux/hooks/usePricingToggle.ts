"use client";

import { useCallback, useState } from "react";

import type { BillingCycle } from "@/config/plans.config";

export function usePricingToggle() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const toggleBillingCycle = useCallback(() => {
    setBillingCycle((previous) =>
      previous === "monthly" ? "yearly" : "monthly",
    );
  }, []);

  return { billingCycle, toggleBillingCycle };
}
