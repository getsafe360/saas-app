// app/api/site/ping/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// TODO: replace with a proper lookup from DB (or Blob index map)
async function findSiteByToken(token: string) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  // For MVP, you could keep a tiny map file 'sites/_index.json' => { [tokenHash]: siteId }
  // or scan 'sites/' blobs. We'll move this to Postgres in step 5.
  return null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const site = await findSiteByToken(token);
  if (!site) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ ok: true, siteId: site.siteId });
}
