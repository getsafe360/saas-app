// components/site-cockpit/cards/optimization/components/Backup/BackupButton.tsx
"use client";

import { useState } from "react";
import {
  Shield,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
} from "lucide-react";
import type { BackupButtonProps } from "../../types";

export function BackupButton({
  backupSystem,
  siteId,
  connection,
  onBackupCreated,
}: BackupButtonProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/sites/${siteId}/backup/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: backupSystem.method,
          includes: ["database", "files", "plugins", "themes"],
        }),
      });

      if (!response.ok) {
        throw new Error("Backup creation failed");
      }

      const data = await response.json();

      const backupInfo = {
        id: data.backupId,
        timestamp: new Date(data.timestamp),
        method: backupSystem.method,
        size: data.size,
        includes: data.includes,
        downloadUrl: data.downloadUrl,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      };

      setSuccess(true);
      onBackupCreated?.(backupInfo);

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setIsCreating(false);
    }
  };

  if (!backupSystem.available) {
    return (
      <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-orange-400 mb-1">
              Backup System Unavailable
            </div>
            <div className="text-xs text-gray-400 mb-3">
              {connection.method === "none"
                ? "Connect your site to enable backups"
                : "Install a backup plugin to enable automatic backups"}
            </div>
            {connection.method === "wordpress" && (
              <button className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors">
                Install Backup Plugin
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Backup Status */}
      {backupSystem.lastBackup && (
        <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Shield className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  Last Backup
                </div>
                <div className="text-xs text-gray-400">
                  {backupSystem.lastBackup.timestamp.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
            {backupSystem.lastBackup.downloadUrl && (
              <a
                href={backupSystem.lastBackup.downloadUrl}
                download
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Download className="h-4 w-4 text-gray-400" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Create Backup Button */}
      <button
        onClick={handleCreateBackup}
        disabled={isCreating || success}
        className={`w-full px-4 py-3 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
          success
            ? "bg-green-600 text-white cursor-default"
            : isCreating
            ? "bg-blue-600 text-white cursor-wait"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {isCreating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating Backup...
          </>
        ) : success ? (
          <>
            <CheckCircle className="h-4 w-4" />
            Backup Created!
          </>
        ) : (
          <>
            <Shield className="h-4 w-4" />
            Create Backup Before Optimizing
          </>
        )}
      </button>

      {/* Auto-backup info */}
      {backupSystem.autoBackup && !backupSystem.lastBackup && (
        <div className="text-xs text-gray-500 text-center">
          💡 Backups are created automatically before each optimization
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-400">{error}</div>
          </div>
        </div>
      )}

      {/* Backup Method Info */}
      <div className="text-xs text-gray-500 text-center">
        {backupSystem.method === "wordpress-plugin" && (
          <>Using {backupSystem.plugin?.name || "WordPress Plugin"}</>
        )}
        {backupSystem.method === "checkpoint" && (
          <>Using Checkpoint System (FTP)</>
        )}
        {backupSystem.method === "ssh" && <>Using SSH Backup</>}
      </div>
    </div>
  );
}
