"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

// Use your smaller icon sizes
const MODES = [
    { label: "System", value: "system", icon: <Monitor className="w-4 h-4" /> },
    { label: "Light", value: "light", icon: <Sun className="w-4 h-4" /> },
    { label: "Dark", value: "dark", icon: <Moon className="w-4 h-4" /> },
];

export function BgColorSelector() {
    const [mode, setMode] = useState(
        typeof window !== "undefined" ? localStorage.getItem("theme") || "system" : "system"
    );

    useEffect(() => {
        document.documentElement.classList.remove("dark", "light");
        let appliedMode = mode;
        if (mode === "system") {
            appliedMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        document.documentElement.classList.add(appliedMode);
        localStorage.setItem("theme", mode);
    }, [mode]);

    // Dynamic colors for light/dark mode
    const baseBg = "bg-gray-100 dark:bg-[#23272E]";
    const baseBorder = "border border-[#1b2430] dark:border-[#1b2430]";
    const selectedBg = "bg-[#cccccc] dark:bg-[#0D1117]"; // dark for selected in dark mode
    const selectedBgLight = "bg-gray-100 dark:bg-[#cccccc]"; // light for selected in light mode

    return (
        <div
            className={[
                "flex rounded-full overflow-hidden shadow-inner select-none w-fit transition-colors duration-300",
                baseBg,
                baseBorder,
            ].join(" ")}
        >
            {MODES.map((m, idx) => (
                <button
                    key={m.value}
                    type="button"
                    aria-label={m.label}
                    title={m.label}
                    onClick={() => setMode(m.value)}
                    className={[
                        "w-8 h-8 flex items-center justify-center transition-colors duration-300",
                        // Highlight selected in both light and dark
                        mode === m.value
                            ? "bg-gray-100 dark:bg-[#0D1117]" // light/gray in light mode, black pearl in dark
                            : "bg-transparent",
                        "hover:bg-gray-200 dark:hover:bg-[#15181D]",
                        // Borders between icons except last one
                        idx !== MODES.length - 1 ? "border-r border-[#1b2430] dark:border-[#1b2430]" : "",
                    ].join(" ")}
                >
                    {m.icon}
                </button>
            ))}
        </div>
    );
}
