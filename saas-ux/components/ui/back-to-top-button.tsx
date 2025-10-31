'use client';

import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";

export default function BackToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show after user scrolls 300px
    const handleScroll = () => setShow(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
  <div
    className="fixed z-[1000] right-4 bottom-[12%] flex items-center"
    style={{ pointerEvents: show ? 'auto' : 'none' }}
    aria-hidden={!show}
  >
    <button
      onClick={handleClick}
      className={[
        "to-top group flex items-center rounded-l-full rounded-r-[28px] pl-3 pr-2 py-2",
        "min-w-[48px] max-w-[168px] hover:pr-6 cursor-pointer outline-none border-0 overflow-hidden",
        // sky theme + transitions
        "bg-gradient-to-r from-sky-600 to-cyan-500 dark:from-sky-400/40 dark:to-cyan-400/60 text-white",
        "shadow-lg transition-all duration-500 ease-in-out",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500 dark:focus-visible:ring-offset-0"
      ].join(" ")}
      tabIndex={show ? 0 : -1}
      title="To top"
      aria-label="To top"
    >
      {/* Rocket + tiny exhaust glow */}
      <span className="relative mr-2 grid place-items-center">
        <span
          className="absolute -right-1 h-2 w-2 rounded-full bg-amber-400/80 blur-[2px] opacity-70
                    group-hover:opacity-100 group-hover:scale-110 transition will-change-transform"
          aria-hidden
        />
        <Rocket
          className="w-6 h-6 -rotate-45 rocket-icon"
          strokeWidth={1.75}
        />
      </span>

      {/* Label slides in on hover */}
      <span
        className="font-semibold text-white/95 transition-all duration-400 ease-in-out
                  opacity-0 group-hover:opacity-100 group-focus:opacity-100
                  max-w-0 group-hover:max-w-[100px] group-focus:max-w-[100px]
                  overflow-hidden whitespace-nowrap"
      >
        To top
      </span>
    </button>
  </div>
  );
}
