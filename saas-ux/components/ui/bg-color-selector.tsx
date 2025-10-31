// saas-ux/components/ui/bg-color-selector.tsx
"use client";

import {useEffect, useMemo, useState} from "react";
import {Sun, Moon, Monitor} from "lucide-react";

type Mode = "system" | "light" | "dark";

const MODES: Array<{label: string; value: Mode; Icon: React.ComponentType<any>}> = [
  {label: "System", value: "system", Icon: Monitor},
  {label: "Light", value: "light", Icon: Sun},
  {label: "Dark", value: "dark", Icon: Moon}
];

export function BgColorSelector() {
  // Default to dark if no preference stored
  const [mode, setMode] = useState<Mode>("dark");
  const [mounted, setMounted] = useState(false);

  // On mount, restore stored value (or keep dark), and apply theme
  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem("theme") as Mode)) || "dark";
    setMode(stored);
    setMounted(true);
  }, []);

  // Apply theme and subscribe to system changes when needed
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const apply = (m: Mode) => {
      root.classList.remove("light", "dark");
      if (m === "system") {
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        root.classList.add(mql.matches ? "dark" : "light");
        return;
      }
      root.classList.add(m);
    };

    apply(mode);
    localStorage.setItem("theme", mode);

    if (mode === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => apply("system");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
  }, [mode, mounted]);

  const index = useMemo(() => MODES.findIndex((m) => m.value === mode), [mode]);

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={[
        "relative isolate grid grid-cols-3 items-center rounded-full p-0.5",
        "bg-black/5 dark:bg-white/5",
        "ring-1 ring-slate-900/10 dark:ring-white/10",
        "shadow-inner"
      ].join(" ")}
      // move the thumb with transform
      style={{["--i" as any]: index}}
    >
      {/* sliding thumb */}
      <span
        aria-hidden
        className={[
          "pointer-events-none absolute inset-y-0 left-0",
          "w-[calc(100%/3)] translate-x-[calc(var(--i)*100%)]",
          "rounded-full",
          "bg-white/70 dark:bg-white/[0.06]",
          "ring-1 ring-slate-900/10 dark:ring-white/10",
          "shadow-sm",
          "transition-transform duration-300 ease-out"
        ].join(" ")}
      />

      {MODES.map(({label, value, Icon}, i) => {
        const selected = mode === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setMode(value)}
            className={[
              "relative z-10 grid place-items-center",
              // smaller control: 28x28 (w-7 h-7). Adjust spacing here.
              "w-7 h-7",
              "rounded-full",
              "transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500 dark:focus-visible:ring-offset-0"
            ].join(" ")}
          >
            <Icon
              className={[
                "h-3.5 w-3.5",
                selected ? "text-sky-500 dark:text-sky-400" : "text-slate-500 dark:text-slate-400"
              ].join(" ")}
              strokeWidth={1.6}
            />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
