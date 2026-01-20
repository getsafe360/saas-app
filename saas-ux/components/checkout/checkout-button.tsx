'use client';

import { useAuth } from '@clerk/nextjs';
import { SignUpButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { checkoutAction } from '@/lib/payments/actions';
import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

interface CheckoutButtonProps {
  priceId: string;
  variant?: 'default' | 'blue' | 'purple' | 'green';
  className?: string;
  children: React.ReactNode;
}

function CheckoutSubmitButton({ variant, className, children }: Omit<CheckoutButtonProps, 'priceId'>) {
  const { pending } = useFormStatus();

  const variantMap = {
    default: 'default',
    blue: 'default',
    purple: 'default',
    green: 'default',
  } as const;

  return (
    <Button
      type="submit"
      disabled={pending}
      variant={variantMap[variant || 'default']}
      className={className}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );
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
      <CheckoutSubmitButton variant={variant} className={className}>
        {children}
      </CheckoutSubmitButton>
    </form>
  );
}
