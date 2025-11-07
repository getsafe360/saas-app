"use client";
import { cn } from "@/lib/cn";
import { WordPressIcon } from "../../icons/WordPress";
import { Shield, Lock, RefreshCw } from "lucide-react";
import * as React from "react";

type Props = {
  version?: string | null;
  jsonApi: boolean | null;
  xmlrpc: boolean | null;
  className?: string;
};

export default function WPSpotlight({ version, jsonApi, xmlrpc, className }: Props) {
  const Badge = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center rounded-full bg-purple-500/10 text-purple-300 px-2 py-0.5 text-xs border border-purple-500/30">
      {children}
    </span>
  );

  const Hint = ({
    Icon,
    title,
    desc,
  }: {
    Icon: React.ElementType;
    title: string;
    desc: string;
  }) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-purple-300">
          <Icon className="h-4 w-4" />
        </span>
        <span>{title}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-300">{desc}</p>
    </div>
  );

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WordPressIcon size={20} className="text-purple-300" />
          <div className="text-sm font-semibold">WordPress Smart Hints</div>
          {version ? <Badge>v{version}</Badge> : <Badge>detected</Badge>}
          {jsonApi ? <Badge>REST</Badge> : null}
          {xmlrpc ? <Badge>XML-RPC</Badge> : null}
        </div>
        <span className="text-[10px] text-neutral-400">A/B variant</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <Hint
          Icon={Shield}
          title="Hide version meta"
          desc='Remove the &lt;meta name="generator"&gt; tag to avoid leaking the CMS version.'
        />
        <Hint
          Icon={Lock}
          title="Restrict REST API"
          desc="Require authentication for /wp-json/ unless your app needs public endpoints."
        />
        <Hint
          Icon={Lock}
          title="Disable XML-RPC"
          desc="Turn off XML-RPC to reduce brute-force surface and pingback abuse."
        />
        <Hint
          Icon={RefreshCw}
          title="Auto-update minor versions"
          desc="Enable automatic minor updates to receive security patches quickly."
        />
      </div>

      <div className="mt-3 text-right">
        <a href="/dashboard/wp-toolbox" className="text-xs text-purple-300 hover:text-purple-200 underline underline-offset-4">
          Open WP Toolbox →
        </a>
      </div>
    </div>
  );
}
