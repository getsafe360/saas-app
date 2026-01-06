// components/site-cockpit/cards/optimization/components/QuickWins/InstructionsModal.tsx
"use client";

import { X, Copy, CheckCircle, ExternalLink } from "lucide-react";
import { useState } from "react";

interface InstructionsModalProps {
  title: string;
  steps: string[];
  code?: string;
  downloadUrl?: string;
  onClose: () => void;
}

export function InstructionsModal({
  title,
  steps,
  code,
  downloadUrl,
  onClose,
}: InstructionsModalProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (code) {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-gray-900 border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
            <p className="text-sm text-gray-400">
              Follow these steps to complete the optimization
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Steps */}
          <div className="mb-6">
            <div className="text-sm font-semibold text-gray-300 mb-3">
              📋 Setup Instructions:
            </div>
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-semibold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-300 pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Code Block */}
          {code && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-300">
                  💻 Code to Add:
                </div>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-gray-950 border border-gray-700 text-xs text-gray-300 overflow-x-auto font-mono">
                {code}
              </pre>
            </div>
          )}

          {/* Download Link */}
          {downloadUrl && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <ExternalLink className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-blue-400 mb-1">
                    Download Required
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    Click below to download the necessary files
                  </div>
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                  >
                    Download Now
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-6 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 text-sm">💡</span>
              <div className="text-xs text-gray-400">
                <strong className="text-yellow-400">Need help?</strong> If
                you're not comfortable making these changes manually, you can
                hire a developer or contact your hosting provider for
                assistance.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
