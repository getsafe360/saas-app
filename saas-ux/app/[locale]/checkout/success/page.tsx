// app/[locale]/checkout/success/page.tsx
import { Suspense } from 'react';
import { CheckoutSuccessContent } from './checkout-success-content';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className="container max-w-2xl mx-auto py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <CardTitle>Loading...</CardTitle>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
