// saas-ux/components/header/HeaderAuthCta.client.tsx
'use client';

import { SignedOut, SignUpButton, SignInButton } from '@clerk/nextjs';

type Props = {
  t?: (k: string) => string;
};

export default function HeaderAuthCta({ t }: Props) {
  return (
    <SignedOut>
      <div className="flex items-center gap-2">
        <SignUpButton mode="modal">
          <button
            className="button-shine hover:cursor-pointer ml-2 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-600 dark:focus-visible:ring-offset-0 transition"
          >
            {t ? t('createFreeAccount') : 'Create free account'}
          </button>
        </SignUpButton>

        {/* Optional: subtle sign-in for returning users */}
        <SignInButton mode="modal">
          <button className="text-sm text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline">
            {t ? t('signIn') : 'Sign in'}
          </button>
        </SignInButton>
      </div>
    </SignedOut>
  );
}
