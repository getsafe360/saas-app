import * as React from "react";
import { Slot as SlotPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "w-full max-w-9/10 inline-flex text-center items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-lg font-semibold transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring/70",
  {
    variants: {
      variant: {
        agent:
          "bg-gradient-to-r from-blue-600 via-purple-500 to-sky-500 text-white border border-blue-300/50 shadow-xl hover:shadow-blue-400/30 hover:from-blue-700 hover:to-purple-600 hover:border-blue-200 focus-visible:ring-blue-400/60 transition-all duration-200",
        green:
          "border border-[--thin-border] border-green-700/20 bg-green-50 text-green-800 dark:border-green-400/40 dark:bg-green-600/60 dark:text-white/90 dark:hover:bg-green-500/60 transition-all duration-200",
        blue:
          "border border-[--thin-border] border-blue-700/20 bg-blue-50 text-blue-800 dark:border-blue-400/40 dark:bg-blue-600/60 dark:text-white/90 dark:hover:bg-blue-500/60 transition-all duration-200",
        purple:
          "border border-[--thin-border] border-purple-700/20 bg-purple-50 text-purple-800 dark:border-purple-400/40 dark:bg-purple-600/60 dark:text-white/90 dark:hover:bg-purple-500/60 transition-all duration-200",
        free:
          "bg-gradient-to-r from-green-600 via-emerald-500 to-lime-400 text-white border border-green-200/70 shadow-xl hover:shadow-lime-400/30 hover:from-green-700 hover:to-emerald-600 hover:border-lime-200 focus-visible:ring-lime-300/60 transition-all duration-200",
        default:
          "bg-gradient-to-r from-purple-500 via-blue-500 to-sky-400 text-white border border-blue-200/40 shadow-lg hover:from-purple-600 hover:to-blue-500 hover:shadow-blue-300/40 transition-all duration-200",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-5 py-1 w-95",
        sm: "h-10 rounded-xl gap-1.5 px-4 py-2",
        lg: "h-10 rounded-2xl px-10 py-3 text-lg w-95",
        icon: "size-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? SlotPrimitive.Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
