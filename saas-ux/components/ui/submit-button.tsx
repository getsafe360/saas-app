'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { useClerk } from "@clerk/clerk-react";
import type { VariantProps } from "class-variance-authority";

type SubmitButtonProps = VariantProps<typeof buttonVariants>;

export function SubmitButton({
  variant = "default",
  size = "lg",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const { openSignUp } = useClerk();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    openSignUp();
  };

  return (
    <Button
      type="submit"
      disabled={pending}
      variant={variant}
      size={size}
      onClick={handleClick}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          Loading...
        </>
      ) : (
        <>
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}