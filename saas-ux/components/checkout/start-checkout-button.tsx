'use client';

import { Button } from '@/components/ui/button';
import { useStartCheckout } from '@/hooks/useStartCheckout';
import type { CheckoutTarget } from '@/config/billing/catalogue';

interface StartCheckoutButtonProps {
  target: CheckoutTarget;
  returnTo?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  className?: string;
  children: React.ReactNode;
}

/** Starts a server-created Stripe Checkout Session (sets team_id metadata for fulfilment). */
export function StartCheckoutButton({
  target,
  returnTo = '/pricing',
  variant,
  className,
  children,
}: StartCheckoutButtonProps) {
  const { start, loading, error } = useStartCheckout(returnTo);

  return (
    <>
      <Button type="button" variant={variant} className={className} disabled={loading} onClick={() => start(target)}>
        {children}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {error}
        </p>
      )}
    </>
  );
}
