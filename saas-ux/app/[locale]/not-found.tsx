import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex flex-1 items-center justify-center">
        <div className="max-w-md space-y-2 p-4 text-center">
          <div className="text-8xl text-orange-500">404</div>
            <h1 className="text-4xl font-bold dark:text-slate-300 tracking-tight">
            Page Not Found
          </h1>
           <p className="text-base dark:text-slate-300">
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
          <Link
            href="/"
            title="Back to Home"
            className="max-w-48 mx-auto flex justify-center py-2 px-4 border border-gray-300 rounded-full shadow-sm text-sm font-medium dark:text-slate-300 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-orange-500"
          >
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
