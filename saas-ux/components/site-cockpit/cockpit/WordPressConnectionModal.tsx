'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function WordPressConnectionModal({ open, onClose, onConnected }: Props) {
  const [apiKey, setApiKey] = useState('');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/20 bg-[#0f172a] p-6">
        <h2 className="text-lg font-semibold text-white">Connect WordPress</h2>
        <p className="mt-1 text-sm text-slate-300">Choose one connection method to enable live remediation.</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs text-slate-300">Manual API key entry</label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="wp_live_xxx" className="mt-1" />
          </div>
          <Button onClick={onConnected} className="w-full">Plugin auto-connect</Button>
          <Button variant="outline" onClick={onConnected} className="w-full">QR code login</Button>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button disabled={!apiKey.trim()} onClick={onConnected}>Save API Key</Button>
        </div>
      </div>
    </div>
  );
}
