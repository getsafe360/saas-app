"use client";

import React from 'react';

const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RcPVICs6GUQsp1IaEnIePJEsDVsET7sakCSd6ruWgSPX2eKOU1NTJYuRQR6Cxmmqlza2BAcxeLziwLUxbnUJsHh00XgIR3bub';

interface StripeBuyButtonProps {
  buyButtonId: string;
  className?: string;
}

// TypeScript declaration for custom Stripe element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-buy-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'buy-button-id': string;
          'publishable-key': string;
        },
        HTMLElement
      >;
    }
  }
}

/**
 * Clean, simple Stripe Buy Button component
 * No useEffect, no DOM manipulation, no refs, no script injection
 * Stripe's custom element automatically initializes when the script loads
 */
export function StripeBuyButton({ buyButtonId, className }: StripeBuyButtonProps) {
  return (
    <stripe-buy-button
      buy-button-id={buyButtonId}
      publishable-key={STRIPE_PUBLISHABLE_KEY}
      className={className}
    />
  );
}
