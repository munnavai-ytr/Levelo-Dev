'use client';

import { useState, useEffect } from 'react';
import { subscribeSyncStatus, flushPendingWrites, type SyncStatus } from '@/lib/sync-manager';
import { CloudOff, RotateCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export function CloudSyncBanner() {
  const [status, setStatus] = useState<SyncStatus>({
    state: 'synced',
    pendingCount: 0,
    lastError: null,
    retryAttempt: 0,
  });
  const [isRetryingNow, setIsRetryingNow] = useState(false);

  useEffect(() => {
    return subscribeSyncStatus(setStatus);
  }, []);

  if (status.state === 'synced' || status.pendingCount === 0) {
    return null;
  }

  const handleManualRetry = async () => {
    setIsRetryingNow(true);
    await flushPendingWrites();
    setIsRetryingNow(false);
  };

  return (
    <div className="bg-amber-950/90 border-b border-amber-600/40 text-amber-200 px-3 sm:px-4 py-2 text-xs flex items-center justify-between gap-3 sticky top-0 z-50 backdrop-blur-md shadow-md animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2 overflow-hidden">
        {status.state === 'offline' ? (
          <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        )}
        <div className="truncate">
          <span className="font-semibold mr-1">Not saved to cloud —</span>
          <span className="text-amber-300/90 font-mono">
            {status.state === 'offline'
              ? 'Working offline. Changes will sync when reconnected.'
              : `Retrying write queue (${status.pendingCount} pending, attempt ${status.retryAttempt}/5)`}
          </span>
        </div>
      </div>

      <button
        onClick={handleManualRetry}
        disabled={isRetryingNow}
        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-md text-[11px] shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
      >
        <RotateCw className={`w-3 h-3 ${isRetryingNow ? 'animate-spin' : ''}`} />
        <span>{isRetryingNow ? 'Retrying...' : 'Retry Now'}</span>
      </button>
    </div>
  );
}
