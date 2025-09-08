// app/(dashboard)/dashboard/sites/connect/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import ConnectWordPress from "@/components/ConnectWordPress";

export default function ConnectPage({
  searchParams,
}: {
  searchParams:
    | { url?: string }
    | Promise<{ url?: string }>;
}) {
  const sp = searchParams instanceof Promise ? undefined : searchParams;
  // If your Next version passes a Promise, do this instead:
  // const sp = await searchParams;

  const defaultUrl = sp?.url ?? "";
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">Connect your WordPress site</h1>
      <p className="text-sm text-slate-500 mb-6">
        Generate a 6-digit code and paste it in the GetSafe 360 plugin in your WP admin.
      </p>
      <ConnectWordPress defaultUrl={defaultUrl} />
    </div>
  );
}
