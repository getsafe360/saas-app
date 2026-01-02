// components/site-cockpit/cards/wordpress/components/Actions/UpdateButton.tsx
"use client";

import { useState } from "react";
import { Download, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export type UpdateTarget = "wordpress" | "plugin" | "theme";

interface UpdateButtonProps {
  target: UpdateTarget;
  targetId: string; // plugin slug, theme slug, or "core" for WordPress
  currentVersion: string;
  targetVersion: string;
  siteId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  variant?: "blue" | "purple" | "orange";
  size?: "sm" | "md";
  showVersion?: boolean;
  className?: string;
}

export function UpdateButton({
  target,
  targetId,
  currentVersion,
  targetVersion,
  siteId,
  onSuccess,
  onError,
  variant = "blue",
  size = "sm",
  showVersion = false,
  className = "",
}: UpdateButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "updating" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleUpdate = async () => {
    setStatus("updating");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/sites/${siteId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          targetId,
          currentVersion,
          targetVersion,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Update failed");
      }

      setStatus("success");
      onSuccess?.();

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update failed";
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
    blue: "bg-blue-600 hover:bg-blue-500 text-white",
    purple: "bg-purple-600 hover:bg-purple-500 text-white",
    orange: "bg-orange-600 hover:bg-orange-500 text-white",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };

  const baseClasses =
    "rounded-lg font-semibold transition-colors flex items-center gap-2 whitespace-nowrap";
  const disabledClasses =
    status === "updating" ? "opacity-50 cursor-not-allowed" : "";
  const buttonClasses = `${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className}`;

  const getButtonText = () => {
    if (showVersion) {
      return {
        idle: `Update to ${targetVersion}`,
        updating: "Updating...",
        success: "Updated!",
        error: "Failed",
      };
    }
    return {
      idle:
        target === "wordpress"
          ? "Update WordPress"
          : target === "plugin"
          ? "Update Plugin"
          : "Update Theme",
      updating: "Updating...",
      success: "Updated!",
      error: "Failed",
    };
  };

  const text = getButtonText();

  return (
    <div className="inline-block">
      <button
        onClick={handleUpdate}
        disabled={status === "updating"}
        className={buttonClasses}
      >
        {status === "idle" && (
          <>
            <Download className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            {text.idle}
          </>
        )}
        {status === "updating" && (
          <>
            <Loader2
              className={`${
                size === "sm" ? "h-3 w-3" : "h-4 w-4"
              } animate-spin`}
            />
            {text.updating}
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            {text.success}
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            {text.error}
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
