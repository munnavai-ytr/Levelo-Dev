'use client';

import { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';

export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkStatus = () => {
      setIsOnline(navigator.onLine);

      // Check network connection speed if NetworkInformation API is supported
      const nav = navigator as any;
      const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
      if (conn) {
        const slowTypes = ['slow-2g', '2g'];
        const isSlowSpeed = slowTypes.includes(conn.effectiveType) || (conn.rtt && conn.rtt > 800);
        setIsSlow(Boolean(isSlowSpeed));
      }
    };

    checkStatus();

    const handleOnline = () => {
      setIsOnline(true);
      checkStatus();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', checkStatus);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', checkStatus);
      }
    };
  }, []);

  if (isOnline && !isSlow) return null;

  return (
    <aside
      aria-label="Network status notification"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {!isOnline && (
        <div className="bg-rose-950/90 text-rose-200 border border-rose-800/80 px-3 py-1.5 rounded-lg shadow-xl text-xs flex items-center gap-2 pointer-events-auto backdrop-blur-md">
          <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>Offline mode — using local cache</span>
        </div>
      )}

      {isOnline && isSlow && (
        <div className="bg-amber-950/90 text-amber-200 border border-amber-800/80 px-3 py-1.5 rounded-lg shadow-xl text-xs flex items-center gap-2 pointer-events-auto backdrop-blur-md">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Slow network detected — optimizing assets</span>
        </div>
      )}
    </aside>
  );
}
