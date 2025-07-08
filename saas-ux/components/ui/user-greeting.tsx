'use client';

import { useUser } from "@clerk/clerk-react";

export function UserGreeting() {
  const { isSignedIn, user, isLoaded } = useUser();
  // Show loading state if user data is not loaded
  if (!isLoaded) return null;
  // Optionally, only show if signed in
  if (!isSignedIn) return null;

  // Fallback to email or username if firstName is not set
  const name =
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "there";

  return (
    <div className="text-center my-6 flex flex-col items-center gap-4">
      <p className="text-xl font-semibold">
        Welcome back, {name}!
      </p>
      <a
        href="/dashboard"
        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold shadow-lg hover:from-purple-600 hover:to-blue-600 transition"
      >
        Go to your Dashboard
      </a>
    </div>
  );
}
