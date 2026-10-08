'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check if there is already a waiting worker
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateAvailable(true);
      }

      // Check for incoming updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });
    }).catch((err) => {
      console.warn('PWA service worker registration failed:', err);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  if (!updateAvailable) return null;

  return (
    <div 
      className="fixed bottom-5 right-5 z-50 p-4 rounded-xl bg-slate-900 border border-indigo-500/50 shadow-2xl flex items-center gap-3.5 max-w-sm animate-in slide-in-from-bottom-3 duration-200"
      role="alert"
      aria-live="assertive"
    >
      <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
        <RefreshCw className="w-4 h-4 animate-spin" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-100">Update Available</p>
        <p className="text-[11px] text-slate-400 mt-0.5">A new version of Levelo is ready.</p>
      </div>
      <button
        onClick={handleUpdate}
        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors shrink-0 cursor-pointer"
        aria-label="Reload and apply update"
      >
        Reload
      </button>
    </div>
  );
}
