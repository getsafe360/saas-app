// components/site-cockpit/cards/wordpress/components/Actions/SyncButton.tsx
"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface SyncButtonProps {
  siteId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  variant?: "ghost" | "outline" | "solid";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function SyncButton({
  siteId,
  onSuccess,
  onError,
  variant = "ghost",
  size = "sm",
  showLabel = true,
  className = "",
}: SyncButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSync = async () => {
    setStatus("syncing");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/sites/${siteId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Sync failed");
      }

      setStatus("success");
      onSuccess?.();

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
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
    ghost: "bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white",
    outline:
      "bg-transparent border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white",
    solid: "bg-blue-600 hover:bg-blue-500 text-white",
  };

  const sizes = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-3",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const baseClasses = "rounded-lg transition-colors flex items-center gap-2";
  const disabledClasses =
    status === "syncing" ? "opacity-50 cursor-not-allowed" : "";

  const buttonClasses = showLabel
    ? `${baseClasses} ${variants[variant]} px-3 py-1.5 ${textSizes[size]} ${disabledClasses} ${className}`
    : `${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className}`;

  const getIcon = () => {
    switch (status) {
      case "syncing":
        return <RefreshCw className={`${iconSizes[size]} animate-spin`} />;
      case "success":
        return <CheckCircle className={iconSizes[size]} />;
      case "error":
        return <AlertCircle className={iconSizes[size]} />;
      default:
        return <RefreshCw className={iconSizes[size]} />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case "syncing":
        return "Syncing...";
      case "success":
        return "Synced!";
      case "error":
        return "Failed";
      default:
        return "Sync Data";
    }
  };

  return (
    <div className="inline-block">
      <button
        onClick={handleSync}
        disabled={status === "syncing"}
        className={buttonClasses}
        title="Refresh WordPress data"
      >
        {getIcon()}
        {showLabel && <span>{getLabel()}</span>}
      </button>

      {/* Error Message */}
      {status === "error" && errorMessage && (
        <div className="mt-2 text-xs text-red-400">{errorMessage}</div>
      )}
    </div>
  );
}
