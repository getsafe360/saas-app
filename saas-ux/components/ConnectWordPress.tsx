// components/ConnectWordPress.tsx
"use client";
import { useState } from "react";

export default function ConnectWordPress() {
  const [url, setUrl] = useState("");
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle"|"checking"|"ready"|"error">("idle");
  const [message, setMessage] = useState("");

  async function start() {
    try {
      setStatus("checking");
      const res = await fetch("/api/connect/start", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ siteUrl: url.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPairCode(data.pairCode); // e.g. "371942"
      setMessage(data.pluginDetected
        ? "Open your WordPress admin → GetSafe 360 → paste the code to connect."
        : "Install the GetSafe 360 plugin (zip provided) → activate → paste the code.");
      setStatus("ready");
    } catch (e:any) {
      setMessage(e.message);
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="https://your-site.com"
          value={url}
          onChange={e=>setUrl(e.target.value)}
        />
        <button onClick={start} className="px-4 py-2 rounded bg-blue-600 text-white">Generate Code</button>
      </div>

      {status === "ready" && (
        <div className="rounded-lg border p-4">
          <div className="text-sm opacity-70 mb-1">{message}</div>
          <div className="text-3xl font-mono tracking-widest">{pairCode}</div>
          <div className="text-xs mt-1 opacity-60">Code expires in 10 minutes • single use</div>
          <a className="underline text-sm mt-3 inline-block" href="/static/getsafe360-wp-plugin.zip">Download plugin</a>
        </div>
      )}

      {status === "error" && <div className="text-red-600 text-sm">{message}</div>}
    </div>
  );
}
