// components/site-cockpit/cards/wordpress/components/Actions/QuickFixButton.tsx
"use client";

import { useState } from "react";
import { Wrench, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export type FixType =
  | "plugin-update"
  | "theme-update"
  | "wordpress-update"
  | "security-fix"
  | "performance-optimization";

interface Issue {
  type: FixType;
  id: string;
  severity?: "critical" | "high" | "medium" | "low";
  description?: string;
}

interface QuickFixButtonProps {
  issue: Issue;
  siteId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  variant?: "primary" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function QuickFixButton({
  issue,
  siteId,
  onSuccess,
  onError,
  variant = "primary",
  size = "sm",
  className = "",
}: QuickFixButtonProps) {
  const [status, setStatus] = useState<"idle" | "fixing" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  const handleFix = async () => {
    setStatus("fixing");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/fix/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          issueIds: [issue.id],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fix failed");
      }

      setStatus("success");
      onSuccess?.();

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fix failed";
      setStatus("error");
      setErrorMessage(message);
      onError?.(message);

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setStatus("idle");
        setErrorMessage("");
      }, 5000);
    }
  };

  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    warning: "bg-orange-600 hover:bg-orange-500 text-white",
  };

  const sizes = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const baseClasses =
    "rounded-lg font-semibold transition-colors flex items-center gap-2";
  const disabledClasses =
    status === "fixing" ? "opacity-50 cursor-not-allowed" : "";
  const buttonClasses = `${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className}`;

  return (
    <div className="inline-block">
      <button
        onClick={handleFix}
        disabled={status === "fixing"}
        className={buttonClasses}
        title={issue.description}
      >
        {status === "idle" && (
          <>
            <Wrench
              className={
                size === "sm"
                  ? "h-3 w-3"
                  : size === "md"
                  ? "h-4 w-4"
                  : "h-5 w-5"
              }
            />
            Fix Now
          </>
        )}
        {status === "fixing" && (
          <>
            <Loader2
              className={`${
                size === "sm"
                  ? "h-3 w-3"
                  : size === "md"
                  ? "h-4 w-4"
                  : "h-5 w-5"
              } animate-spin`}
            />
            Fixing...
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle
              className={
                size === "sm"
                  ? "h-3 w-3"
                  : size === "md"
                  ? "h-4 w-4"
                  : "h-5 w-5"
              }
            />
            Fixed!
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle
              className={
                size === "sm"
                  ? "h-3 w-3"
                  : size === "md"
                  ? "h-4 w-4"
                  : "h-5 w-5"
              }
            />
            Failed
          </>
        )}
      </button>

      {/* Error Message */}
      {status === "error" && errorMessage && (
        <div className="mt-2 text-xs text-red-400">{errorMessage}</div>
      )}
    </div>
  );
}
