// app/[locale]/(dashboard)/dashboard/settings/page.tsx
import { UserProfile } from "@clerk/nextjs";
import { CreditCard, ExternalLink } from "lucide-react";

const STRIPE_CUSTOMER_PORTAL_URL = "https://buy.getsafe360.ai/p/login/8x214mfQud5mbNf84abAs00";

export default function SettingsPage() {
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Account Settings</h1>

      {/* Plan & Billing Section */}
      <div className="mb-8 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Plan & Billing</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your subscription and payment methods</p>
          </div>
        </div>
        <a
          href={STRIPE_CUSTOMER_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
        >
          Manage Subscription
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Account Profile Section */}
      <div className="rounded-xl overflow-hidden">
        <UserProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border border-gray-200 dark:border-gray-800"
            }
          }}
        />
      </div>
    </div>
  );
}
