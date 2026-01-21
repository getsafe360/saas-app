// saas-ux/components/stripe/stripe-buy-button.tsx
"use client";

import { useEffect } from "react";

const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51RcPVICs6GUQsp1IaEnIePJEsDVsET7sakCSd6ruWgSPX2eKOU1NTJYuRQR6Cxmmqlza2BAcxeLziwLUxbnUJsHh00XgIR3bub";

interface StripeBuyButtonProps {
  buyButtonId: string;
  className?: string;
}

export function StripeBuyButton({
  buyButtonId,
  className,
}: StripeBuyButtonProps) {
  useEffect(() => {
    // Load Stripe buy button script if not already loaded
    if (
      !document.querySelector(
        'script[src="https://js.stripe.com/v3/buy-button.js"]'
      )
    ) {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/buy-button.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  return (
    <stripe-buy-button
      buy-button-id={buyButtonId}
      publishable-key={STRIPE_PUBLISHABLE_KEY}
      className={className}
    />
  );
}
