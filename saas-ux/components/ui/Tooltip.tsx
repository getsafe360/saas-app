// saas-ux/components/ui/Tooltip.tsx
"use client";
import * as RT from "@radix-ui/react-tooltip";
import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  delay?: number;
  asChild?: boolean;
};

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  className,
  delay = 150,
  asChild = true,
}: Props) {
  return (
    <RT.Provider delayDuration={delay}>
      <RT.Root>
        <RT.Trigger asChild={asChild}>{children}</RT.Trigger>
        <RT.Content
          side={side}
          align={align}
          collisionPadding={8}
          className={cn(
            "z-50 select-none rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white shadow-lg ring-1 ring-white/10",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1",
            "data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
            className
          )}
        >
          {content}
          <RT.Arrow className="fill-neutral-900" />
        </RT.Content>
      </RT.Root>
    </RT.Provider>
  );
}
