'use client';

import { useAuth } from '@clerk/nextjs';
import { SignUpButton } from '@clerk/clerk-react';
import { SubmitButton } from '@/components/ui/submit-button';
import { checkoutAction } from '@/lib/payments/actions';

interface CheckoutButtonProps {
  priceId: string;
  variant?: 'default' | 'blue' | 'purple' | 'green';
  className?: string;
  children: React.ReactNode;
}

export function CheckoutButton({ priceId, variant = 'default', className, children }: CheckoutButtonProps) {
  const { isSignedIn } = useAuth();

  // If not signed in, show sign-up button
  if (!isSignedIn) {
    return (
      <SignUpButton mode="modal">
        <SubmitButton variant={variant} className={className}>
          {children}
        </SubmitButton>
      </SignUpButton>
    );
  }

  // If signed in, create checkout session
  return (
    <form action={checkoutAction}>
      <input type="hidden" name="priceId" value={priceId} />
      <SubmitButton variant={variant} className={className}>
        {children}
      </SubmitButton>
    </form>
  );
}
