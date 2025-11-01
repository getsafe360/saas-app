// saas-ux/components/analyzer/StickyMiniBar.tsx
"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { ExternalLink, RefreshCw } from "lucide-react";

type Props = {
  domain: string;
  finalUrl: string;
  status: number;
  isHttps: boolean;
  onRerun?: () => void;
};

export default function StickyMiniBar({ domain, finalUrl, status, isHttps, onRerun }: Props) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 200);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className={cn(
        "fixed left-1/2 z-40 -translate-x-1/2 top-3 transition-all",
        show ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="rounded-full border border-white/10 bg-neutral-900/80 backdrop-blur px-3 py-1.5 text-xs text-neutral-200 flex items-center gap-2 shadow-lg">
        <span className="font-semibold">{domain}</span>
        <span className={cn("rounded-full px-2 py-0.5",
          isHttps ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
        )}>{isHttps ? "HTTPS" : "HTTP"} • {status}</span>
        <a href={finalUrl} target="_blank" className="inline-flex items-center gap-1 hover:text-white">
          Open <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {onRerun && (
          <button onClick={onRerun} className="inline-flex items-center gap-1 hover:text-white">
            Re-run <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
