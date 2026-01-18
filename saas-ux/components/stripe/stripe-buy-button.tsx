'use client';

import { useEffect, useRef } from 'react';

const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RcPVICs6GUQsp1IaEnIePJEsDVsET7sakCSd6ruWgSPX2eKOU1NTJYuRQR6Cxmmqlza2BAcxeLziwLUxbnUJsHh00XgIR3bub';

interface StripeBuyButtonProps {
  buyButtonId: string;
  className?: string;
}

export function StripeBuyButton({ buyButtonId, className }: StripeBuyButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Stripe buy button script if not already loaded
    if (!document.querySelector('script[src="https://js.stripe.com/v3/buy-button.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/buy-button.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Create the stripe-buy-button element
    if (containerRef.current) {
      const stripeBuyButton = document.createElement('stripe-buy-button');
      stripeBuyButton.setAttribute('buy-button-id', buyButtonId);
      stripeBuyButton.setAttribute('publishable-key', STRIPE_PUBLISHABLE_KEY);

      // Clear any existing content and append the button
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(stripeBuyButton);
    }
  }, [buyButtonId]);

  return <div ref={containerRef} className={className} />;
}
