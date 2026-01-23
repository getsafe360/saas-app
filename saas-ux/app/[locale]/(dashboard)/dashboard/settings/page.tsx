// app/[locale]/(dashboard)/dashboard/settings/page.tsx
import { UserProfile } from "@clerk/nextjs";

export default function SettingsPage() {
  return (
    <div className="container max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>
      <UserProfile
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "shadow-none border border-gray-200 dark:border-gray-800"
          }
        }}
      />
    </div>
  );
}
