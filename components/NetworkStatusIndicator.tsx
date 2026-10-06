'use client';

import { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';

export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API for slow network detection (e.g. 2G or slow effectiveType)
    const nav = navigator as any;
    if (nav.connection) {
      const checkConnection = () => {
        const effectiveType = nav.connection.effectiveType;
        const saveData = nav.connection.saveData;
        setIsSlow(effectiveType === '2g' || effectiveType === 'slow-2g' || saveData === true);
      };
      checkConnection();
      nav.connection.addEventListener('change', checkConnection);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        nav.connection.removeEventListener('change', checkConnection);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !isSlow) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2">
      {!isOnline ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-950/90 border border-rose-600/50 text-rose-200 text-xs shadow-lg backdrop-blur-md font-medium">
          <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>Offline mode active</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/90 border border-amber-600/50 text-amber-200 text-xs shadow-lg backdrop-blur-md font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Slow network detected</span>
        </div>
      )}
    </div>
  );
}
