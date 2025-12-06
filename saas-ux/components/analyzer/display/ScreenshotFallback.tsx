// components/analyzer/display/ScreenshotFallback.tsx
import { AlertCircle } from "lucide-react";

export default function ScreenshotFallback() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 p-8 text-center">
      <AlertCircle className="h-16 w-16 text-neutral-400 mb-4" />
      <div className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
        Screenshot Not Available
      </div>
      <div className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
        This site prevented automated screenshots. We're working on alternative
        capture methods.
      </div>
    </div>
  );
}
