'use client';

import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed standalone PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold shadow-sm transition-colors cursor-pointer ${className}`}
        title="Install Levelo as a standalone desktop or mobile application"
        aria-label="Install App"
      >
        <Download className="w-3.5 h-3.5 text-indigo-400" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer ${className}`}
          title="Install on iOS"
          aria-label="Install on iOS"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl relative text-slate-100">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
                aria-label="Close guide"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-3">
                <Download className="w-5 h-5" />
              </div>

              <h3 className="text-base font-bold text-slate-100">Install Levelo on iOS</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Install Levelo to your home screen for full-screen games and offline play:
              </p>

              <div className="mt-4 space-y-2.5 text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Share className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>1. Tap the <strong>Share</strong> button in Safari toolbar</span>
                </div>
                <div className="flex items-center gap-2">
                  <PlusSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>2. Scroll down and tap <strong>Add to Home Screen</strong></span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
