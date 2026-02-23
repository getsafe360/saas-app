// components/site-cockpit/cards/wordpress/components/ConnectionStatus/PairingModal.tsx
"use client";

import {
  Link as LinkIcon,
  XCircle,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";

interface PairingModalProps {
  pairCode: string | null;
  pairingStatus: string;
  pairingMessage: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}

export function PairingModal({
  pairCode,
  pairingStatus,
  pairingMessage,
  copied,
  onCopy,
  onClose,
}: PairingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <LinkIcon className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Pairing Code Generated
            </h3>
            <p className="text-sm" style={{ color: "var(--text-subtle)" }}>{pairingMessage}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg transition-colors" style={{ color: "var(--text-subtle)" }}
        >
          <XCircle className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {pairCode && (
        <div className="bg-gray-900/60 rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-subtle)" }}>Your Pairing Code</span>
            <button
              onClick={onCopy}
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="text-4xl font-mono tracking-[0.5em] text-center text-white mb-2">
            {pairCode}
          </div>
          <div className="text-xs text-gray-500 text-center">
            Expires in ~10 minutes • Single use only
          </div>
        </div>
      )}

      {pairingStatus === "waiting" && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          <div className="text-sm text-blue-300">
            Waiting for connection... Enter the code in WordPress admin
          </div>
        </div>
      )}

      {pairingStatus === "error" && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="text-sm text-red-300">{pairingMessage}</div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="text-xs text-gray-500 mb-3">Need help?</div>
        <div className="flex gap-3">
          <a
            href="/wp-plugin/getsafe360-connector.zip"
            download
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Download Plugin
          </a>
          <span className="text-gray-600">•</span>
          <a
            href="/docs/wordpress-connection"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Setup Guide
          </a>
        </div>
      </div>
          </div>
    </div>
  );
}
