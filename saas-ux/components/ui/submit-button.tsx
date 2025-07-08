'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { useSignUp, useClerk } from "@clerk/clerk-react";

export function SubmitButton({ variant = "default", size = "lg"}) {
  const { pending } = useFormStatus();
  const { openSignUp } = useClerk();

  const handleClick = (e) => {
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
