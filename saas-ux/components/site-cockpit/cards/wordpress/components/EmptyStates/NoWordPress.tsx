// components/site-cockpit/cards/wordpress/components/EmptyStates/NoWordPress.tsx
"use client";

import { Globe, AlertCircle, ExternalLink, HelpCircle } from "lucide-react";

interface NoWordPressProps {
  siteUrl: string;
  detectedCMS?: string;
}

export function NoWordPress({ siteUrl, detectedCMS }: NoWordPressProps) {
  return (
    <div className="p-6">
      {/* No WordPress Detected */}
      <div className="mb-6 p-6 rounded-xl bg-gradient-to-br from-gray-500/10 to-gray-600/10 border border-gray-600/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-gray-500/10">
            <Globe className="h-6 w-6 text-gray-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              WordPress Not Detected
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              We couldn't detect WordPress on this site. This could mean:
            </p>
            <ul className="space-y-2 text-sm text-gray-300 mb-4">
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <span>This site is not using WordPress</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <span>WordPress is heavily customized or obfuscated</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <span>The site uses a headless WordPress setup</span>
              </li>
            </ul>

            {detectedCMS && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4">
                <div className="text-sm text-blue-300">
                  <span className="font-semibold">Detected CMS:</span>{" "}
                  {detectedCMS}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-4 w-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-white">
              Using WordPress?
            </h4>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            If your site uses WordPress but we couldn't detect it, try manually
            connecting with the plugin.
          </p>
          <a
            href={`/dashboard/sites/connect?url=${encodeURIComponent(siteUrl)}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Manual Connection
          </a>
        </div>

        <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-purple-400" />
            <h4 className="text-sm font-semibold text-white">Other CMS?</h4>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            We're working on support for more content management systems.
          </p>
          <a
            href="/docs/supported-cms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs font-semibold transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            See Supported CMS
          </a>
        </div>
      </div>

      {/* Site Info */}
      <div className="mt-4 p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
        <div className="text-xs text-gray-500 mb-1">Site URL</div>
        <div className="text-sm font-mono text-gray-300">{siteUrl}</div>
      </div>
    </div>
  );
}
