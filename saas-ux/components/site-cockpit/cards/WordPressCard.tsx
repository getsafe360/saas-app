// components/site-cockpit/cards/WordPressCard.tsx
'use client';

import { CockpitCard } from '../CockpitCard';
import { Shield, AlertTriangle, CheckCircle, Package, Palette, Zap } from 'lucide-react';
import type { SiteCockpitResponse } from '@/types/site-cockpit';

interface WordPressCardProps {
  id: string;
  data: SiteCockpitResponse;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  editable?: boolean;
}

export function WordPressCard({
  id,
  data,
  minimized,
  onToggleMinimize,
  editable,
}: WordPressCardProps) {
  const { wordpress } = data;
  
  if (!wordpress) return null;

  return (
    <CockpitCard
      id={id}
      title="WordPress Spotlight"
      category="wordpress"
      score={wordpress.score}
      grade={wordpress.grade}
      minimized={minimized}
      onToggleMinimize={onToggleMinimize}
      editable={editable}
      className="lg:col-span-2"
    >
      {/* Version Status */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-400 mb-1">WordPress Version</div>
            <div className="text-2xl font-bold text-white">
              {wordpress.version.current}
            </div>
          </div>
          {wordpress.version.outdated && (
            <div className="px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-semibold">
              Update Available
            </div>
          )}
        </div>

        {wordpress.version.outdated && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/40 border border-gray-700/50">
            <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-gray-300 mb-1">
                {wordpress.version.daysOld} days old • Latest: {wordpress.version.latest}
              </div>
              <div className="text-xs text-gray-500">
                {wordpress.recommendations.length} security recommendations
              </div>
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap">
              Update Now
            </button>
          </div>
        )}
      </div>

      {/* Security Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SecurityMetric
          label="Login Page"
          icon={Shield}
          status={!wordpress.security.defaultLoginExposed}
          value={wordpress.security.defaultLoginExposed ? 'Exposed' : 'Protected'}
        />
        <SecurityMetric
          label="User Enum"
          icon={Shield}
          status={wordpress.security.userEnumerationBlocked}
          value={wordpress.security.userEnumerationBlocked ? 'Blocked' : 'Vulnerable'}
        />
        <SecurityMetric
          label="XML-RPC"
          icon={Shield}
          status={!wordpress.security.xmlrpcEnabled}
          value={wordpress.security.xmlrpcEnabled ? 'Enabled' : 'Disabled'}
        />
        <SecurityMetric
          label="Debug Mode"
          icon={Shield}
          status={!wordpress.security.wpDebugMode}
          value={wordpress.security.wpDebugMode ? 'On' : 'Off'}
        />
      </div>

      {/* Plugins Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-400" />
            Plugins ({wordpress.plugins.total})
          </h4>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">{wordpress.plugins.active} active</span>
            {wordpress.plugins.outdated > 0 && (
              <span className="text-orange-400">{wordpress.plugins.outdated} outdated</span>
            )}
            {wordpress.plugins.vulnerable > 0 && (
              <span className="text-red-400 font-semibold">{wordpress.plugins.vulnerable} vulnerable</span>
            )}
          </div>
        </div>

        {/* Vulnerable plugins */}
        {wordpress.plugins.list.filter(p => p.vulnerable).length > 0 && (
          <div className="space-y-2 mb-4">
            {wordpress.plugins.list
              .filter(p => p.vulnerable)
              .map(plugin => (
                <div
                  key={plugin.slug}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{plugin.name}</div>
                      <div className="text-xs text-gray-400">
                        Current: {plugin.version} → Update to: {plugin.latest}
                      </div>
                    </div>
                    <button className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors">
                      Fix Now
                    </button>
                  </div>
                  {plugin.vulnerabilities && plugin.vulnerabilities.length > 0 && (
                    <div className="text-xs text-red-400">
                      {plugin.vulnerabilities[0].description}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Outdated plugins (non-vulnerable) */}
        {wordpress.plugins.outdated > wordpress.plugins.vulnerable && (
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center justify-between">
              <div className="text-sm text-orange-400">
                {wordpress.plugins.outdated - wordpress.plugins.vulnerable} plugins need updates
              </div>
              <button className="text-xs text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                View All →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Theme */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/40 border border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Palette className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{wordpress.themes.active}</div>
              <div className="text-xs text-gray-400">
                v{wordpress.themes.version} 
                {wordpress.themes.outdated && ` • Update to ${wordpress.themes.latest}`}
              </div>
            </div>
          </div>
          {wordpress.themes.outdated && (
            <button className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors">
              Update Theme
            </button>
          )}
        </div>
      </div>

      {/* Performance Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <PerformanceMetric
          label="Object Cache"
          value={wordpress.performance.objectCache}
          recommendation={!wordpress.performance.objectCache ? 'Enable for 40% speed boost' : undefined}
        />
        <PerformanceMetric
          label="OPcache"
          value={wordpress.performance.opcacheEnabled}
        />
      </div>
    </CockpitCard>
  );
}

function SecurityMetric({ label, icon: Icon, status, value }: {
  label: string;
  icon: any;
  status: boolean;
  value: string;
}) {
  return (
    <div className={`p-3 rounded-lg border ${
      status 
        ? 'bg-green-500/5 border-green-500/20' 
        : 'bg-red-500/5 border-red-500/20'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${status ? 'text-green-400' : 'text-red-400'}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className={`text-sm font-semibold ${status ? 'text-green-400' : 'text-red-400'}`}>
        {value}
      </div>
    </div>
  );
}

function PerformanceMetric({ label, value, recommendation }: {
  label: string;
  value: boolean;
  recommendation?: string;
}) {
  return (
    <div className={`p-3 rounded-lg border ${
      value 
        ? 'bg-green-500/5 border-green-500/20' 
        : 'bg-orange-500/5 border-orange-500/20'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        {value ? (
          <CheckCircle className="h-4 w-4 text-green-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-orange-400" />
        )}
      </div>
      <div className={`text-sm font-semibold ${value ? 'text-green-400' : 'text-orange-400'}`}>
        {value ? 'Enabled' : 'Disabled'}
      </div>
      {recommendation && (
        <div className="text-xs text-gray-500 mt-1">{recommendation}</div>
      )}
    </div>
  );
}
