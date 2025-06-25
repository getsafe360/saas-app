"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

// Options: system, light, dark
const MODES = [
    { value: "system", icon: <Monitor size={18} />, label: "System" },
    { value: "light", icon: <Sun size={18} />, label: "Light" },
    { value: "dark", icon: <Moon size={18} />, label: "Dark" },
];

export function BgColorSelector() {
    // Detect default mode from localStorage or 'system'
    const [mode, setMode] = useState(() =>
        typeof window !== "undefined"
            ? localStorage.getItem("theme") || "system"
            : "system"
    );

    useEffect(() => {
        // Remove all possible modes
        document.documentElement.classList.remove("dark", "light");
        let appliedMode = mode;
        if (mode === "system") {
            const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            appliedMode = systemPrefersDark ? "dark" : "light";
        }
        document.documentElement.classList.add(appliedMode);
        localStorage.setItem("theme", mode);
    }, [mode]);

    return (
        <div className="flex items-center gap-1">
            {MODES.map((m) => (
                <button
                    key={m.value}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2
            ${mode === m.value ? "ring-2 ring-sky-400 border-sky-400" : "border-transparent"}
            bg-transparent hover:bg-gray-100 dark:hover:bg-neutral-800 transition
          `}
                    aria-label={m.label}
                    title={m.label}
                    onClick={() => setMode(m.value)}
                    type="button"
                >
                    {m.icon}
                </button>
            ))}
        </div>
    );
}

