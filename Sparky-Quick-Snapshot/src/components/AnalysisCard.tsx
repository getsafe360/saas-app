import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InsightCardData } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AnalysisCardProps {
  title: string;
  icon: LucideIcon;
  content: InsightCardData;
  isLoading?: boolean;
  className?: string;
  delay?: number;
  fallbackText: string;
  metricLabel: string;
  evidenceLabel: string;
  actionLabel: string;
}

const statusStyle: Record<InsightCardData['status'], string> = {
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
};

export const AnalysisCard: React.FC<AnalysisCardProps> = ({
  title,
  icon: Icon,
  content,
  isLoading,
  className,
  delay = 0,
  fallbackText,
  metricLabel,
  evidenceLabel,
  actionLabel,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-white/10 bg-[#151619] p-5 transition-all hover:border-white/20 hover:shadow-2xl hover:shadow-black/50',
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/70 transition-colors group-hover:text-white">
          <Icon size={20} />
        </div>
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-white/50 transition-colors group-hover:text-white/80">
          {title}
        </h3>
      </div>

      <div className="min-h-[128px]">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-white/5" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
          </div>
        ) : (
          <div className="space-y-3">
            <span className={cn('inline-flex rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider', statusStyle[content.status])}>
              {content.status}
            </span>

            <p className="font-sans text-sm leading-relaxed text-white/80">{content.summary || fallbackText}</p>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/70">
              <p>
                <span className="font-mono uppercase tracking-wide text-white/50">{metricLabel}: </span>
                {content.metric || fallbackText}
              </p>
              <p className="mt-1">
                <span className="font-mono uppercase tracking-wide text-white/50">{evidenceLabel}: </span>
                {content.evidence || fallbackText}
              </p>
            </div>

            <p className="font-mono text-[11px] text-emerald-300/90">
              {actionLabel}: {content.actionHint || fallbackText}
            </p>
          </div>
        )}
      </div>

      <div className="absolute right-2 top-2 flex gap-1">
        <div className="h-1 w-1 rounded-full bg-white/10" />
        <div className="h-1 w-1 rounded-full bg-white/10" />
      </div>
      <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </motion.div>
  );
};
