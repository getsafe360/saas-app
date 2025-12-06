export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import ConnectWordPress from "@/components/ConnectWordPress";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url = "" } = await searchParams;
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">
        Connect your WordPress site
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Generate a 6-digit code and enter it in the GetSafe 360 plugin in your
        WP admin.
      </p>
      <ConnectWordPress defaultUrl={url} />
    </div>
  );
}
