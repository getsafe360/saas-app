'use client';

import { useUser } from "@clerk/clerk-react";
import { useTranslations } from 'next-intl';
import { PricingTable } from "@/components/ui/pricing-table";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function PricingPage() {
  const t = useTranslations('pricing');
  const { user } = useUser(); // Safely fetch current user (for user?.id)
  
  // Example dynamic price (replace with your own logic)
  const price = "18.00";
  const currency = "USD";

  // Get PayPal clientId from env
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    console.error("PayPal clientId is missing. Check your environment variables.");
  }

  return (
    <main className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-[90vh] bg-[--page-bg] transition-colors">
      <div className="max-w-5xl w-full mx-auto">

        {/* Headline Section */}

          <section className="mb-10">
            <h1 className="font-extrabold text-4xl sm:text-6xl tracking-tight text-center mb-6">
              <span className="bg-gradient-to-r from-white via-sky-300/80 to-sky-400/70 bg-clip-text text-transparent">
                {t('headline1')}
              </span>
            </h1>
            <h2 className="text-xl font-semibold sm:text-2xl text-center mb-6">
             <span className="font-bold text-3xl sm:text-5xl text-blue-600 block">
                {t('headline2')}
              </span>
            </h2>
            <h3 className="text-lg font-medium sm:text-xl text-center mb-6">
              {t('subheadline')}
            </h3>
          </section>

          <PricingTable />

          {/* PayPal Buttons */}
          {clientId && (
            <PayPalScriptProvider options={{ clientId }}>
              <PayPalButtons
                createOrder={(data, actions) => {
                  return actions.order.create({
                    intent: "CAPTURE",
                    purchase_units: [{
                      amount: {
                        currency_code: currency,
                        value: price
                      }
                    }]
                  });
                }}
                onApprove={(data, actions) => {
                  if (!actions.order) {
                    console.error("PayPal actions.order is undefined.");
                    return Promise.reject(new Error("PayPal actions.order is undefined."));
                  }
                  return actions.order.capture().then(function(details) {
                    // Call your API after payment
                    fetch("/api/after-payment", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        orderId: data.orderID,
                        payerId: data.payerID,
                        userId: user?.id || null, // safe fallback
                        details
                      })
                    });
                  });
                }}
              />
            </PayPalScriptProvider>
          )}
      </div>
    </main>
  );
}
