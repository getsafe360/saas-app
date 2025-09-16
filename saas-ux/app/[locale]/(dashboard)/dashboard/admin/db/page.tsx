// app/(dashboard)/dashboard/admin/db/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DbAdmin() {
  const base = ""; // same origin
  const [health, inspect] = await Promise.all([
    fetch(`${base}/api/admin/db/health`, { cache: "no-store" }).then(r => r.json()),
    fetch(`${base}/api/admin/db/inspect`, { cache: "no-store" }).then(r => r.json()),
  ]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Database</h1>

      <div className="border rounded-lg p-4">
        <div className="font-semibold mb-2">Health</div>
        <pre className="text-xs bg-slate-50 p-3 rounded">{JSON.stringify(health, null, 2)}</pre>
      </div>

      <div className="border rounded-lg p-4">
        <div className="font-semibold mb-2">Tables</div>
        <pre className="text-xs bg-slate-50 p-3 rounded">{JSON.stringify(inspect, null, 2)}</pre>
      </div>
    </div>
  );
}
