// app\(login)\sign-in\page.tsx

import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Login } from "../login";

export default function SignInPage() {
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      {/* Brand / Marketing side */}
      <aside className="relative hidden md:flex overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-indigo-600 to-fuchsia-600" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between p-10 text-white">
          <div className="text-2xl font-semibold tracking-tight">GetSafe 360</div>
          <div className="mt-10">
            <h2 className="text-3xl font-semibold leading-tight">
              Secure, simple <br /> WordPress optimization
            </h2>
            <ul className="mt-6 space-y-3 text-white/90">
              {[
                "Privacy-safe connector",
                "Instant audits & insights",
                "One-click fixes with cost preview",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-10 text-xs text-white/70">
            © {new Date().getFullYear()} GetSafe 360. All rights reserved.
          </p>
        </div>
      </aside>

      {/* Auth card */}
      <main className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Welcome back
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Sign in to your GetSafe 360 account
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 shadow-xl backdrop-blur p-6">
            <Suspense>
              <Login mode="signin" />
            </Suspense>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="font-medium text-indigo-600 hover:text-indigo-500">
              Create one
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
