// app/[locale]/checkout/success/checkout-success-content.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, SignInButton, SignUpButton } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function CheckoutSuccessContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { isSignedIn, userId } = useAuth();
  const sessionId = searchParams.get('session_id');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If user is signed in and we have a session ID, link the purchase to their account
    if (isSignedIn && userId && sessionId && !isProcessing) {
      linkPurchaseToAccount();
    }
  }, [isSignedIn, userId, sessionId]);

  async function linkPurchaseToAccount() {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/link-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to link purchase');
      }

      // Redirect to dashboard after successful linking
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsProcessing(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="container max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              <CardTitle>{t('checkout.success.invalidSession')}</CardTitle>
            </div>
            <CardDescription>
              {t('checkout.success.noSession')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // User is signed in - processing the purchase
  if (isSignedIn) {
    if (isProcessing) {
      return (
        <div className="container max-w-2xl mx-auto py-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <CardTitle>{t('checkout.success.processing')}</CardTitle>
              </div>
              <CardDescription>
                {t('checkout.success.activating')}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    if (error) {
      return (
        <div className="container max-w-2xl mx-auto py-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <CardTitle>{t('checkout.success.error')}</CardTitle>
              </div>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.reload()}>
                {t('checkout.success.tryAgain')}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="container max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <CardTitle>{t('checkout.success.title')}</CardTitle>
            </div>
            <CardDescription>
              {t('checkout.success.redirecting')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // User is NOT signed in - show sign up/sign in options
  return (
    <div className="container max-w-2xl mx-auto py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <CardTitle>{t('checkout.success.title')}</CardTitle>
          </div>
          <CardDescription>
            {t('checkout.success.thankYou')} {t('checkout.success.signInPrompt')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Important:</strong> {t('checkout.success.emailNote')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <SignUpButton mode="modal">
              <Button className="flex-1" size="lg">
                {t('checkout.success.createAccount')}
              </Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button variant="outline" className="flex-1" size="lg">
                {t('checkout.success.signIn')}
              </Button>
            </SignInButton>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t('checkout.success.alreadyHaveAccount')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
