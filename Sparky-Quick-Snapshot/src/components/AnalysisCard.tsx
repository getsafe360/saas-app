import React from 'react';
import { LucideIcon, AlertTriangle, CheckCircle2, AlertCircle, Info, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AuditItem } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AnalysisCardProps {
  title: string;
  icon: LucideIcon;
  data?: AuditItem;
  isLoading?: boolean;
  className?: string;
  delay?: number;
}

const SeverityBadge = ({ severity }: { severity: AuditItem['severity'] }) => {
  const colors = {
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    critical: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const icons = {
    low: <Info size={10} />,
    medium: <AlertCircle size={10} />,
    high: <AlertTriangle size={10} />,
    critical: <AlertCircle size={10} />,
  };

  return (
    <div className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", colors[severity])}>
      {icons[severity]}
      {severity}
    </div>
  );
};

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ 
  title, 
  icon: Icon, 
  data, 
  isLoading, 
  className,
  delay = 0 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/10 bg-[#151619] p-5 transition-all hover:border-white/20 hover:shadow-2xl hover:shadow-black/50",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/70 group-hover:text-white transition-colors">
            <Icon size={20} />
          </div>
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-white/50 group-hover:text-white/80 transition-colors">
            {title}
          </h3>
        </div>
        {data?.severity && <SeverityBadge severity={data.severity} />}
      </div>

      <div className="min-h-[100px] space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-white/5" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
          </div>
        ) : data ? (
          <>
            <p className="font-sans text-sm font-medium leading-relaxed text-white/90">
              {data.finding}
            </p>
            <div className="space-y-2 rounded-lg bg-white/[0.02] p-3">
              <div className="flex gap-2">
                <Zap size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                <p className="text-[11px] leading-relaxed text-white/50">
                  <span className="font-bold text-white/70">Impact:</span> {data.impact}
                </p>
              </div>
              {data.fix && (
                <div className="flex gap-2">
                  <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-blue-500" />
                  <p className="text-[11px] leading-relaxed text-white/50">
                    <span className="font-bold text-white/70">Fix:</span> {data.fix}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="font-sans text-sm leading-relaxed text-white/30 italic">
            Awaiting signal...
          </p>
        )}
      </div>

      {/* Decorative hardware elements */}
      <div className="absolute top-2 right-2 flex gap-1">
        <div className="h-1 w-1 rounded-full bg-white/10" />
        <div className="h-1 w-1 rounded-full bg-white/10" />
      </div>
      <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </motion.div>
  );
};
