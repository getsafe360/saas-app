// components/analyzer/core/AnalyzerProvider.tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import type { Finding, Facts } from '../types';

type AnalyzerContextType = {
  url: string;
  status: 'idle' | 'loading' | 'streaming' | 'done' | 'error';
  findings: Finding[];
  facts: Facts | null;
  output: string;
  startAnalysis: (url: string) => Promise<void>;
  cancel: () => void;
};

const AnalyzerContext = createContext<AnalyzerContextType | null>(null);

export function AnalyzerProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'streaming' | 'done' | 'error'>('idle');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [output, setOutput] = useState('');

  // Move all analysis logic here
  const startAnalysis = async (newUrl: string) => {
    // Your existing analysis logic
  };

  const cancel = () => {
    // Cancel logic
  };

  return (
    <AnalyzerContext.Provider value={{ 
      url, status, findings, facts, output, 
      startAnalysis, cancel 
    }}>
      {children}
    </AnalyzerContext.Provider>
  );
}

export function useAnalyzer() {
  const context = useContext(AnalyzerContext);
  if (!context) throw new Error('useAnalyzer must be used within AnalyzerProvider');
  return context;
}