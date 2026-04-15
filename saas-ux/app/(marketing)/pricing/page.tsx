"use client";

import FaqSection from "./components/FaqSection";
import PlanGrid from "./components/PlanGrid";
import PricingHero from "./components/PricingHero";
import PricingToggle from "./components/PricingToggle";
import TokenPacks from "./components/TokenPacks";

import { usePricingToggle } from "@/hooks/usePricingToggle";

export default function PricingPage() {
  const { billingCycle, toggleBillingCycle } = usePricingToggle();

  return (
    <div className="min-h-screen bg-[var(--background-default)] transition-colors duration-300">
      <PricingHero />
      <PricingToggle billingCycle={billingCycle} onToggle={toggleBillingCycle} />
      <PlanGrid billingCycle={billingCycle} />
      <TokenPacks />
      <FaqSection />
    </div>
  );
}
