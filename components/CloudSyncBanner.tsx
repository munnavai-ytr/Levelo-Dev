'use client';

import { useState, useEffect } from 'react';
import { subscribeSyncStatus, flushPendingWrites, type SyncStatus } from '@/lib/sync-manager';
import { CloudOff, RotateCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export function CloudSyncBanner() {
  const [status, setStatus] = useState<SyncStatus>({
    state: 'synced',
    pendingCount: 0,
    lastError: null,
    attempts: 0
  });
  const [isManualRetrying, setIsManualRetrying] = useState(false);

  useEffect(() => {
    return subscribeSyncStatus(setStatus);
  }, []);

  if (status.state === 'synced' && status.pendingCount === 0) {
    return null;
  }

  const handleManualRetry = async () => {
    setIsManualRetrying(true);
    try {
      await flushPendingWrites();
    } finally {
      setIsManualRetrying(false);
    }
  };

  const isFailed = status.attempts >= 5;

  return (
    <div
      role="alert"
      className={`w-full px-4 py-2 text-xs flex items-center justify-between transition-colors z-50 ${
        isFailed
          ? 'bg-rose-950/90 text-rose-200 border-b border-rose-800/80'
          : 'bg-amber-950/90 text-amber-200 border-b border-amber-800/80'
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {isFailed ? (
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        ) : (
          <CloudOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        )}
        <span>
          {isFailed
            ? `Not saved to cloud — Max retry attempts reached (${status.pendingCount} pending change${status.pendingCount > 1 ? 's' : ''})`
            : `Not saved to cloud — retrying (${status.attempts}/5)...`}
        </span>
        {status.lastError && (
          <span className="hidden sm:inline text-amber-300/70 font-mono text-[11px] truncate max-w-xs">
            ({status.lastError})
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleManualRetry}
          disabled={isManualRetrying || status.state === 'saving'}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
            isFailed
              ? 'bg-rose-800 hover:bg-rose-700 text-white'
              : 'bg-amber-800/80 hover:bg-amber-700 text-amber-100'
          }`}
        >
          <RotateCw className={`w-3 h-3 ${isManualRetrying || status.state === 'saving' ? 'animate-spin' : ''}`} />
          <span>{isManualRetrying || status.state === 'saving' ? 'Saving...' : 'Retry Now'}</span>
        </button>
      </div>
    </div>
  );
}
