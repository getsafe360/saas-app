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
        className={`
          flex items-center rounded-l-full rounded-r-[28px] pl-3 pr-2 py-2
          bg-[#167DC4] dark:bg-[#185c97] text-white shadow-lg
          transition-all duration-300
          min-w-[48px] max-w-[148px]
          hover:pr-6 group
          cursor-pointer border-0 outline-none
          overflow-hidden
          ${show ? "opacity-100" : "opacity-0"}
        `}
        tabIndex={show ? 0 : -1}
        title="To top"
        aria-label="To top"
      >
        {/* Rocket is always visible, always white, never rotated */}
        <Rocket className="w-6 h-6 text-white -rotate-45" strokeWidth={1.5} stroke="white" fill="#cc3300" />
        {/* Only the text slides in on hover */}
        <span
          className={`
            ml-2 font-semibold text-white
            transition-all duration-200 ease-in-out
            opacity-0 group-hover:opacity-100 group-focus:opacity-100
            max-w-0 group-hover:max-w-[80px] group-focus:max-w-[80px] 
            overflow-hidden whitespace-nowrap
          `}
        >
          To top
        </span>
      </button>
    </div>
  );
}
