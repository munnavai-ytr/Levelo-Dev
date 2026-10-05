'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { bundleProjectHtml } from '@/lib/bundler';
import type { DeviceMode, PlaytestResult } from '@/lib/types';
import { 
  RotateCw, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Maximize2, 
  ExternalLink, 
  RotateCcw,
  Terminal,
  AlertTriangle,
  Sparkles,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

interface PreviewPanelProps {
  files?: Record<string, string>;
  htmlCode?: string; // backwards compatibility
  onFixWithAi?: (errorInfo: { message: string; stack?: string }, isAutoFix?: boolean) => void;
  onCaptureThumbnail?: (thumbnail: string) => void;
  onPlaytestResult?: (result: PlaytestResult) => void;
}

export function PreviewPanel({
  files,
  htmlCode,
  onFixWithAi,
  onCaptureThumbnail,
  onPlaytestResult
}: PreviewPanelProps) {
  const { deviceMode, setDeviceMode, isLandscape, toggleOrientation } = useAppStore();
  const [reloadKey, setReloadKey] = useState(0);
  const [showConsole, setShowConsole] = useState(false);
  const [logs, setLogs] = useState<{ id: string; type: 'log' | 'warn' | 'error'; message: string; time: string }[]>([]);
  const [activeError, setActiveError] = useState<{ message: string; stack?: string } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warn' | 'log'>('all');

  // Playtest state
  const [playtestResult, setPlaytestResult] = useState<PlaytestResult>({ status: 'checking' });

  // Auto-fix toggle (default ON, saved in localStorage)
  const [autoFix, setAutoFix] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('levelo_auto_fix_errors');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const toggleAutoFix = () => {
    const next = !autoFix;
    setAutoFix(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('levelo_auto_fix_errors', String(next));
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastAutoFixedErrorRef = useRef<string>('');

  // ResizeObserver to calculate real container dimensions for CSS scale transform
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Multi-file bundling: bundles index.html with inlined local styles and scripts
  const bundledRawHtml = useMemo(() => {
    if (files && Object.keys(files).length > 0) {
      return bundleProjectHtml(files);
    }
    return htmlCode || '';
  }, [files, htmlCode]);

  // Reset playtest status whenever code changes or preview reloads
  useEffect(() => {
    setPlaytestResult({ status: 'checking' });
    setActiveError(null);
  }, [bundledRawHtml, reloadKey]);

  // Listen to message events from iframe console, errors, playtest, and thumbnail
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;

      // Console logs
      if (e.data.source === 'levelo-preview-console' || e.data.source === 'gameforge-preview-console') {
        const newLog = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: (e.data.level || 'log') as 'log' | 'warn' | 'error',
          message: typeof e.data.args === 'string' ? e.data.args : JSON.stringify(e.data.args),
          time: new Date().toLocaleTimeString()
        };
        setLogs((prev) => [...prev.slice(-99), newLog]);
      }

      // Runtime error capture
      if (e.data.source === 'levelo-preview-error' || e.data.source === 'gameforge-preview-error') {
        const errMsg = e.data.message || 'Unknown runtime error';
        const errObj = {
          message: errMsg,
          stack: e.data.stack || ''
        };
        setActiveError(errObj);

        // Auto-fix loop trigger (if autoFix enabled and not identical to previous)
        if (autoFix && onFixWithAi && lastAutoFixedErrorRef.current !== errMsg) {
          lastAutoFixedErrorRef.current = errMsg;
          onFixWithAi(errObj, true);
        }
      }

      // Real Playtest Health Check report
      if (e.data.source === 'levelo-preview-playtest') {
        const result: PlaytestResult = {
          status: e.data.status === 'passed' ? 'passed' : 'failed',
          reason: e.data.reason || undefined,
          fps: e.data.fps || undefined,
          timestamp: Date.now()
        };
        setPlaytestResult(result);
        onPlaytestResult?.(result);

        // If playtest failed and autoFix is ON, feed failure into auto-debug loop
        if (result.status === 'failed' && autoFix && onFixWithAi) {
          const failMsg = `Playtest Failed: ${result.reason || 'Game did not start properly'}`;
          if (lastAutoFixedErrorRef.current !== failMsg) {
            lastAutoFixedErrorRef.current = failMsg;
            onFixWithAi({ message: failMsg, stack: '' }, true);
          }
        }
      }

      // Thumbnail capture
      if (e.data.source === 'levelo-preview-thumbnail' && e.data.thumbnail) {
        if (onCaptureThumbnail) {
          onCaptureThumbnail(e.data.thumbnail);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCaptureThumbnail, autoFix, onFixWithAi, onPlaytestResult]);

  // Target device dimensions in pixels
  const { targetWidth, targetHeight } = useMemo(() => {
    if (deviceMode === 'mobile') {
      return isLandscape ? { targetWidth: 844, targetHeight: 390 } : { targetWidth: 390, targetHeight: 844 };
    }
    if (deviceMode === 'tablet') {
      return isLandscape ? { targetWidth: 1180, targetHeight: 820 } : { targetWidth: 820, targetHeight: 1180 };
    }
    return { targetWidth: containerDimensions.width, targetHeight: containerDimensions.height };
  }, [deviceMode, isLandscape, containerDimensions]);

  // Compute scale factor
  const scale = useMemo(() => {
    if (deviceMode === 'desktop') return 1;
    const padX = 24;
    const padY = 24;
    const availW = Math.max(containerDimensions.width - padX, 200);
    const availH = Math.max(containerDimensions.height - padY, 200);
    const factorW = availW / targetWidth;
    const factorH = availH / targetHeight;
    return Math.min(1, factorW, factorH);
  }, [deviceMode, targetWidth, targetHeight, containerDimensions]);

  // Inject error capture, playtest check, and rewrite known CDNs to local /libs
  const enhancedCode = useMemo(() => {
    if (!bundledRawHtml) return '';

    // Rewrite known CDN URLs to local self-hosted /libs path
    const processedHtml = bundledRawHtml
      .replace(
        /(https?:)?\/\/(cdn\.jsdelivr\.net\/npm\/phaser[^"'>\s]*|cdnjs\.cloudflare\.com\/ajax\/libs\/phaser[^"'>\s]*|unpkg\.com\/phaser[^"'>\s]*)/gi,
        '/libs/phaser.min.js'
      )
      .replace(
        /(https?:)?\/\/(cdn\.jsdelivr\.net\/npm\/three[^"'>\s]*|cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js[^"'>\s]*|unpkg\.com\/three[^"'>\s]*)/gi,
        '/libs/three.min.js'
      );

    const bridge = `
      <script>
        (function() {
          let frameCount = 0;
          let hasUncaughtError = false;
          let lastErrorMessage = '';

          // rAF frame counter for real playtest check
          const countFrame = () => {
            frameCount++;
            requestAnimationFrame(countFrame);
          };
          requestAnimationFrame(countFrame);

          const send = (level, args) => {
            try {
              window.parent.postMessage({
                source: 'levelo-preview-console',
                level: level,
                args: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
              }, '*');
            } catch(e) {}
          };

          const sendError = (msg, stack) => {
            hasUncaughtError = true;
            lastErrorMessage = msg;
            try {
              window.parent.postMessage({
                source: 'levelo-preview-error',
                message: msg,
                stack: stack || ''
              }, '*');
            } catch(e) {}
          };

          window.addEventListener('error', function(e) {
            const text = (e.message || 'Error') + (e.lineno ? ' (line ' + e.lineno + ')' : '');
            send('error', [text]);
            sendError(text, e.error ? e.error.stack : '');
          });

          window.addEventListener('unhandledrejection', function(e) {
            const reason = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled Promise Rejection';
            send('error', ['Unhandled Rejection: ' + reason]);
            sendError(reason, e.reason ? e.reason.stack : '');
          });

          const origLog = console.log;
          const origWarn = console.warn;
          const origErr = console.error;
          console.log = function() { origLog.apply(console, arguments); send('log', arguments); };
          console.warn = function() { origWarn.apply(console, arguments); send('warn', arguments); };
          console.error = function() { 
            origErr.apply(console, arguments); 
            send('error', arguments);
            const str = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            sendError(str);
          };

          // REAL PLAYTEST CHECK (Runs at ~3.8 seconds after load)
          setTimeout(function() {
            if (hasUncaughtError) {
              window.parent.postMessage({
                source: 'levelo-preview-playtest',
                status: 'failed',
                reason: 'Uncaught error: ' + (lastErrorMessage || 'Script error')
              }, '*');
              return;
            }

            const canvasEl = document.querySelector('canvas');
            if (!canvasEl) {
              window.parent.postMessage({
                source: 'levelo-preview-playtest',
                status: 'failed',
                reason: 'No <canvas> found'
              }, '*');
              return;
            }

            if (frameCount < 10) {
              window.parent.postMessage({
                source: 'levelo-preview-playtest',
                status: 'failed',
                reason: 'Animation stopped (rAF not ticking)'
              }, '*');
              return;
            }

            const approxFps = Math.min(60, Math.round(frameCount / 3.8));
            window.parent.postMessage({
              source: 'levelo-preview-playtest',
              status: 'passed',
              fps: approxFps,
              reason: 'Game running smoothly'
            }, '*');
          }, 3800);

          // Capture real canvas thumbnail (320px wide, JPEG 0.6)
          const captureThumbnail = () => {
            try {
              const canvasEl = document.querySelector('canvas');
              if (canvasEl && canvasEl.width > 0 && canvasEl.height > 0) {
                const targetW = 320;
                const targetH = Math.max(1, Math.round((canvasEl.height / canvasEl.width) * targetW));
                const offscreen = document.createElement('canvas');
                offscreen.width = targetW;
                offscreen.height = targetH;
                const offCtx = offscreen.getContext('2d');
                if (offCtx) {
                  offCtx.drawImage(canvasEl, 0, 0, targetW, targetH);
                  const dataUrl = offscreen.toDataURL('image/jpeg', 0.6);
                  window.parent.postMessage({
                    source: 'levelo-preview-thumbnail',
                    thumbnail: dataUrl
                  }, '*');
                }
              }
            } catch (err) {}
          };

          setTimeout(captureThumbnail, 1200);
          window.addEventListener('pointerdown', () => setTimeout(captureThumbnail, 800), { once: true });
        })();
      </script>
    `;

    if (processedHtml.includes('<head>')) {
      return processedHtml.replace('<head>', '<head>' + bridge);
    }
    return bridge + processedHtml;
  }, [bundledRawHtml]);

  const handleReload = () => {
    setActiveError(null);
    setReloadKey((k) => k + 1);
  };

  const handleFullscreen = () => {
    if (wrapperRef.current) {
      if (!document.fullscreenElement) {
        wrapperRef.current.requestFullscreen().catch(console.error);
      } else {
        document.exitFullscreen().catch(console.error);
      }
    }
  };

  const handleOpenNewTab = () => {
    const blob = new Blob([bundledRawHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.type === logFilter;
  });

  const errorCount = logs.filter((l) => l.type === 'error').length;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden" ref={wrapperRef}>
      {/* Top Preview Toolbar */}
      <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm px-3 flex items-center justify-between shrink-0 gap-2 overflow-x-auto scrollbar-none">
        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/80 shrink-0">
          <button
            onClick={() => setDeviceMode('mobile')}
            className={`p-1.5 rounded-md transition-colors ${
              deviceMode === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Mobile Simulation (390×844)"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeviceMode('tablet')}
            className={`p-1.5 rounded-md transition-colors ${
              deviceMode === 'tablet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tablet Simulation (820×1180)"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeviceMode('desktop')}
            className={`p-1.5 rounded-md transition-colors ${
              deviceMode === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Desktop Canvas (Fit to Panel)"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Playtest Status Badge & Auto-Fix Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Real Playtest Badge */}
          {playtestResult.status === 'checking' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>Playtest: Checking...</span>
            </div>
          )}

          {playtestResult.status === 'passed' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/80 text-[10px] font-mono text-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Playtest: Passed {playtestResult.fps ? `(${playtestResult.fps} FPS)` : ''}</span>
            </div>
          )}

          {playtestResult.status === 'failed' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/70 border border-rose-800/80 text-[10px] font-mono text-rose-300">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span className="truncate max-w-[140px] sm:max-w-xs">Playtest: Failed ({playtestResult.reason})</span>
            </div>
          )}

          {/* Auto-Fix Toggle */}
          <button
            onClick={toggleAutoFix}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
              autoFix
                ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Auto-fix errors on build"
          >
            <Sparkles className={`w-3 h-3 ${autoFix ? 'text-indigo-400' : 'text-slate-500'}`} />
            <span className="hidden md:inline">Auto-fix</span>
            <span className="text-[9px] uppercase tracking-wider">{autoFix ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          {deviceMode !== 'desktop' && (
            <button
              onClick={toggleOrientation}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title={`Rotate to ${isLandscape ? 'Portrait' : 'Landscape'}`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleReload}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reload Game"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleFullscreen}
            className="hidden sm:inline-flex p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fullscreen Mode"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleOpenNewTab}
            className="hidden sm:inline-flex p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Open Game in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Console Drawer Toggle */}
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs cursor-pointer ${
              showConsole 
                ? 'border-indigo-500/50 bg-indigo-950/40 text-indigo-300' 
                : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Debug Console"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-mono text-[11px]">
              {logs.length > 0 ? logs.length : 'Console'}
            </span>
            {errorCount > 0 && (
              <span className="px-1 py-0.2 rounded-full bg-rose-500/80 text-white font-mono text-[9px]">
                {errorCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Preview Screen */}
      <div 
        ref={containerRef}
        className="flex-1 w-full h-full relative overflow-hidden bg-slate-950 flex items-center justify-center p-2 sm:p-4"
      >
        {deviceMode === 'desktop' ? (
          <iframe
            key={`preview-desktop-${reloadKey}`}
            title="Levelo Live Game"
            srcDoc={enhancedCode}
            sandbox="allow-scripts allow-modals allow-pointer-lock"
            className="w-full h-full border-0 bg-slate-950 rounded-lg shadow-inner"
          />
        ) : (
          <div
            className="relative transition-all duration-200 shadow-2xl rounded-2xl border-4 border-slate-800 bg-slate-900 flex items-center justify-center overflow-hidden"
            style={{
              width: targetWidth * scale,
              height: targetHeight * scale,
            }}
          >
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-slate-950 rounded-full z-20 pointer-events-none opacity-80" />
            
            <iframe
              key={`preview-device-${reloadKey}-${deviceMode}-${isLandscape ? 'land' : 'port'}`}
              title="Levelo Device Simulation"
              srcDoc={enhancedCode}
              sandbox="allow-scripts allow-modals allow-pointer-lock"
              style={{
                width: targetWidth,
                height: targetHeight,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
              className="border-0 bg-slate-950"
            />
          </div>
        )}
      </div>

      {/* Runtime Error Banner */}
      {activeError && (
        <div className="bg-rose-950/90 border-t border-rose-500/40 p-3 px-4 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 z-30 shadow-lg animate-in slide-in-from-bottom-2">
          <div className="flex items-start gap-2.5 overflow-hidden">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="truncate">
              <span className="font-semibold text-rose-100">Runtime Error: </span>
              <span className="font-mono text-[11px] text-rose-300">{activeError.message}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {onFixWithAi && (
              <button
                onClick={() => onFixWithAi(activeError, false)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all duration-150 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fix with AI</span>
              </button>
            )}
            <button
              onClick={() => setActiveError(null)}
              className="p-1 rounded-md text-rose-400 hover:text-white hover:bg-rose-900/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Console Drawer */}
      {showConsole && (
        <div className="h-48 border-t border-slate-800 bg-slate-950 flex flex-col shrink-0 z-30 animate-in slide-in-from-bottom-2 duration-150">
          <div className="h-8 border-b border-slate-800/80 bg-slate-900/90 px-3 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-slate-200">Runtime Console</span>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  onClick={() => setLogFilter('all')}
                  className={`px-1.5 py-0.5 rounded ${logFilter === 'all' ? 'bg-indigo-600 text-white' : 'hover:text-slate-200'}`}
                >
                  All ({logs.length})
                </button>
                <button
                  onClick={() => setLogFilter('error')}
                  className={`px-1.5 py-0.5 rounded ${logFilter === 'error' ? 'bg-rose-600 text-white' : 'hover:text-slate-200'}`}
                >
                  Errors ({errorCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => setLogs([])} className="p-1 hover:text-slate-200">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowConsole(false)} className="p-1 hover:text-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-1">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-600 italic p-2">No logs captured yet</div>
            ) : (
              filteredLogs.map((l) => (
                <div key={l.id} className="flex items-start gap-2">
                  <span className="text-slate-600">{l.time}</span>
                  <span className={l.type === 'error' ? 'text-rose-400' : l.type === 'warn' ? 'text-amber-400' : 'text-slate-300'}>
                    {l.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
