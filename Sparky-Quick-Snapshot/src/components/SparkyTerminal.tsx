import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Cpu, Zap } from 'lucide-react';
import { TerminalLogEntry } from '../types';

interface SparkyTerminalProps {
  logs: TerminalLogEntry[];
  isAnalyzing: boolean;
  labels: {
    processing: string;
    standby: string;
    analyzingPackets: string;
    emptyState: string;
  };
}

const levelStyles: Record<TerminalLogEntry['level'], string> = {
  INFO: 'text-cyan-300',
  SUCCESS: 'text-emerald-400',
  WARNING: 'text-yellow-400',
  METRIC: 'text-violet-300',
  ERROR: 'text-red-400',
};

export const SparkyTerminal: React.FC<SparkyTerminalProps> = ({ logs, isAnalyzing, labels }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-500" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/40">Sparky Engine v2.6.0</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${isAnalyzing ? 'animate-pulse bg-emerald-500' : 'bg-white/20'}`} />
            <span className="font-mono text-[9px] uppercase tracking-tighter text-white/30">{isAnalyzing ? labels.processing : labels.standby}</span>
          </div>
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500/20" />
            <div className="h-2 w-2 rounded-full bg-yellow-500/20" />
            <div className="h-2 w-2 rounded-full bg-green-500/20" />
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-[220px] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
      >
        <AnimatePresence mode="popLayout">
          {logs.map((log, i) => (
            <motion.div key={`${log.timestamp}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-1.5 grid grid-cols-[72px_74px_1fr] gap-3">
              <span className="shrink-0 text-white/20">[{log.timestamp}]</span>
              <span className={`shrink-0 font-bold ${levelStyles[log.level]}`}>[{log.level}]</span>
              <span className="text-white/70">
                <span className="text-white/50">{log.stage}: </span>
                {log.message}
                {log.metric ? <span className="ml-1 text-violet-300">({log.metric})</span> : null}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {isAnalyzing && (
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="mt-2 flex items-center gap-2 text-emerald-500/50"
          >
            <Zap size={10} className="animate-bounce" />
            <span>{labels.analyzingPackets}</span>
          </motion.div>
        )}

        {logs.length === 0 && !isAnalyzing && (
          <div className="flex h-full flex-col items-center justify-center gap-3 opacity-20">
            <Cpu size={32} />
            <p className="text-center uppercase tracking-[0.2em]">{labels.emptyState}</p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    </div>
  );
};
