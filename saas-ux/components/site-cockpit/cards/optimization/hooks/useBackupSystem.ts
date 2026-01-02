// components/site-cockpit/cards/optimization/hooks/useBackupSystem.ts
"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  BackupSystem,
  BackupInfo,
  BackupMethod,
  ConnectionInfo,
  UseBackupSystemReturn,
} from "../types";

export function useBackupSystem(
  siteId: string,
  connection: ConnectionInfo
): UseBackupSystemReturn {
  const [backupSystem, setBackupSystem] = useState<BackupSystem>({
    available: false,
    method: "wordpress-plugin",
    autoBackup: true,
  });
  
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Check backup system availability on mount
  useEffect(() => {
    checkBackupAvailability();
  }, [siteId, connection.method]);

  /**
   * Check what backup methods are available
   */
  const checkBackupAvailability = useCallback(async () => {
    try {
      if (connection.method === "wordpress" && connection.wordpress?.siteId) {
        // Check for WordPress backup plugin
        const hasPlugin = await checkBackupPlugin();
        
        setBackupSystem({
          available: hasPlugin,
          method: "wordpress-plugin",
          plugin: {
            name: "UpdraftPlus",
            installed: hasPlugin,
          },
          autoBackup: true,
        });
      } else if (connection.method === "ftp") {
        // FTP: Use checkpoint system
        setBackupSystem({
          available: true,
          method: "checkpoint",
          autoBackup: true,
        });
      } else if (connection.method === "ssh") {
        // SSH: Full backup capability
        setBackupSystem({
          available: true,
          method: "ssh",
          autoBackup: true,
        });
      } else {
        // No connection: No backup
        setBackupSystem({
          available: false,
          method: "wordpress-plugin",
          autoBackup: false,
        });
      }
    } catch (error) {
      console.error("Error checking backup availability:", error);
      setBackupSystem({
        available: false,
        method: "wordpress-plugin",
        autoBackup: false,
      });
    }
  }, [siteId, connection]);

  /**
   * Check if WordPress backup plugin is installed
   */
  const checkBackupPlugin = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/sites/${siteId}/backup/check`, {
        method: "GET",
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.installed || false;
    } catch (error) {
      console.error("Error checking backup plugin:", error);
      return false;
    }
  }, [siteId]);

  /**
   * Install WordPress backup plugin
   */
  const installBackupPlugin = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/sites/${siteId}/backup/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to install backup plugin");
      }

      const data = await response.json();
      
      // Update backup system state
      if (data.success) {
        setBackupSystem(prev => ({
          ...prev,
          available: true,
          plugin: {
            name: "UpdraftPlus",
            installed: true,
            version: data.version,
          },
        }));
      }

      return data.success || false;
    } catch (error) {
      console.error("Error installing backup plugin:", error);
      return false;
    }
  }, [siteId]);

  /**
   * Create a backup
   */
  const createBackup = useCallback(async (): Promise<BackupInfo> => {
    setIsBackingUp(true);

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

      const backupInfo: BackupInfo = {
        id: data.backupId,
        timestamp: new Date(data.timestamp),
        method: backupSystem.method,
        size: data.size,
        includes: data.includes,
        downloadUrl: data.downloadUrl,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      };

      // Update backup system with last backup
      setBackupSystem(prev => ({
        ...prev,
        lastBackup: backupInfo,
      }));

      setIsBackingUp(false);
      return backupInfo;
    } catch (error) {
      setIsBackingUp(false);
      throw error;
    }
  }, [siteId, backupSystem.method]);

  /**
   * Restore from a backup
   */
  const restoreBackup = useCallback(async (backupId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/sites/${siteId}/backup/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });

      if (!response.ok) {
        throw new Error("Backup restoration failed");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Restore failed");
      }
    } catch (error) {
      console.error("Error restoring backup:", error);
      throw error;
    }
  }, [siteId]);

  return {
    backupSystem,
    isBackingUp,
    createBackup,
    restoreBackup,
    checkBackupPlugin,
    installBackupPlugin,
  };
}