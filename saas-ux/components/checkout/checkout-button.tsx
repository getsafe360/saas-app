'use client';

import { Button } from '@/components/ui/button';

interface CheckoutButtonProps {
  stripeCheckoutUrl?: string | null;
  variant?: 'default' | 'blue' | 'purple' | 'green';
  className?: string;
  children: React.ReactNode;
}

export function CheckoutButton({
  stripeCheckoutUrl,
  variant = 'default',
  className,
  children
}: CheckoutButtonProps) {
  // If Stripe checkout URL is available, link directly to Stripe
  if (stripeCheckoutUrl) {
    return (
      <Button
        asChild
        variant={variant}
        className={className}
      >
        <a href={stripeCheckoutUrl} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      </Button>
    );
  }

  // Fallback: render disabled button if no URL configured
  return (
    <Button
      disabled
      variant={variant}
      className={className}
    >
      {children}
    </Button>
  );
}
