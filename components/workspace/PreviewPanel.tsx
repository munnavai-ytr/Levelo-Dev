'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
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
  Trash2
} from 'lucide-react';
import type { DeviceMode } from '@/lib/types';

interface PreviewPanelProps {
  htmlCode: string;
  onFixWithAi?: (errorInfo: { message: string; stack?: string }) => void;
  onCaptureThumbnail?: (thumbnail: string) => void;
}

export function PreviewPanel({ htmlCode, onFixWithAi, onCaptureThumbnail }: PreviewPanelProps) {
  const { deviceMode, setDeviceMode, isLandscape, toggleOrientation } = useAppStore();
  const [reloadKey, setReloadKey] = useState(0);
  const [showConsole, setShowConsole] = useState(false);
  const [logs, setLogs] = useState<{ id: string; type: 'log' | 'warn' | 'error'; message: string; time: string }[]>([]);
  const [activeError, setActiveError] = useState<{ message: string; stack?: string } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warn' | 'log'>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Listen to message events from iframe console and error bridge
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;

      if (e.data.source === 'levelo-preview-console' || e.data.source === 'gameforge-preview-console') {
        const newLog = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: (e.data.level || 'log') as 'log' | 'warn' | 'error',
          message: typeof e.data.args === 'string' ? e.data.args : JSON.stringify(e.data.args),
          time: new Date().toLocaleTimeString()
        };
        setLogs((prev) => [...prev.slice(-99), newLog]);
      }

      if (e.data.source === 'levelo-preview-error' || e.data.source === 'gameforge-preview-error') {
        const errMsg = e.data.message || 'Unknown runtime error';
        setActiveError({
          message: errMsg,
          stack: e.data.stack || ''
        });
      }

      if (e.data.source === 'levelo-preview-thumbnail' && e.data.thumbnail) {
        if (onCaptureThumbnail) {
          onCaptureThumbnail(e.data.thumbnail);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCaptureThumbnail]);

  // Clear error whenever code changes or preview reloads
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveError(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [htmlCode, reloadKey]);

  // Target device dimensions in pixels
  const { targetWidth, targetHeight } = useMemo(() => {
    if (deviceMode === 'mobile') {
      return isLandscape ? { targetWidth: 844, targetHeight: 390 } : { targetWidth: 390, targetHeight: 844 };
    }
    if (deviceMode === 'tablet') {
      return isLandscape ? { targetWidth: 1180, targetHeight: 820 } : { targetWidth: 820, targetHeight: 1180 };
    }
    // Desktop: fits the panel
    return { targetWidth: containerDimensions.width, targetHeight: containerDimensions.height };
  }, [deviceMode, isLandscape, containerDimensions]);

  // Compute scale factor so simulated devices always fit inside panel container
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

  // Inject error capture and console interceptor into iframe code and rewrite known CDNs to local /libs
  const enhancedCode = useMemo(() => {
    if (!htmlCode) return '';

    // Rewrite known CDN URLs to local self-hosted /libs path at preview time only
    const processedHtml = htmlCode
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
  }, [htmlCode]);

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
    const blob = new Blob([htmlCode], { type: 'text/html' });
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
      <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm px-3 flex items-center justify-between shrink-0 gap-2">
        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/80">
          <button
            onClick={() => setDeviceMode('mobile')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              deviceMode === 'mobile'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Mobile View (390 x 844)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mobile</span>
          </button>

          <button
            onClick={() => setDeviceMode('tablet')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              deviceMode === 'tablet'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tablet View (820 x 1180)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tablet</span>
          </button>

          <button
            onClick={() => setDeviceMode('desktop')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              deviceMode === 'desktop'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Fit to Desktop Container"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Rotate orientation (active on mobile/tablet) */}
          {deviceMode !== 'desktop' && (
            <button
              onClick={toggleOrientation}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title={`Rotate to ${isLandscape ? 'Portrait' : 'Landscape'}`}
              aria-label="Rotate device orientation"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Scale Badge if scaled */}
          {deviceMode !== 'desktop' && scale < 0.99 && (
            <span className="hidden md:inline-block text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
              {Math.round(scale * 100)}%
            </span>
          )}

          {/* Reload Preview */}
          <button
            onClick={handleReload}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Reload Game"
            aria-label="Reload preview"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Console Drawer Toggle */}
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs ${
              showConsole 
                ? 'border-indigo-500/50 bg-indigo-950/40 text-indigo-300' 
                : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Debug Console"
            aria-label="Toggle console"
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

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fullscreen"
            aria-label="Fullscreen preview"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Open in New Tab */}
          <button
            onClick={handleOpenNewTab}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Open in New Tab"
            aria-label="Open preview in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Preview Sandbox Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full bg-slate-950 relative flex items-center justify-center p-2 sm:p-3 overflow-hidden"
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
            {/* Device frame camera notch / speaker indicator */}
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

      {/* Preview Runtime Error Banner with "Fix with AI" Button */}
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
                onClick={() => onFixWithAi(activeError)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all duration-150 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fix with AI</span>
              </button>
            )}
            <button
              onClick={() => setActiveError(null)}
              className="p-1 rounded-md text-rose-400 hover:text-rose-200 hover:bg-rose-900/40 transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Console Live Logs Tab */}
      {showConsole && (
        <div className="h-48 border-t border-slate-800 bg-slate-950/95 font-mono text-[11px] flex flex-col z-20 shrink-0">
          <div className="px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                Console
              </span>
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded border border-slate-800">
                <button
                  onClick={() => setLogFilter('all')}
                  className={`px-2 py-0.5 text-[10px] rounded ${logFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  All ({logs.length})
                </button>
                <button
                  onClick={() => setLogFilter('error')}
                  className={`px-2 py-0.5 text-[10px] rounded ${logFilter === 'error' ? 'bg-rose-950/60 text-rose-300 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Errors ({errorCount})
                </button>
                <button
                  onClick={() => setLogFilter('warn')}
                  className={`px-2 py-0.5 text-[10px] rounded ${logFilter === 'warn' ? 'bg-amber-950/60 text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Warn
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setLogs([])}
                className="hover:text-slate-200 text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800 flex items-center gap-1"
                title="Clear console"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="text-slate-400 hover:text-slate-200 p-0.5"
                aria-label="Close console"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-2 overflow-y-auto space-y-1">
            {filteredLogs.length === 0 ? (
              <p className="text-slate-600 italic p-1.5 text-xs">No console entries recorded.</p>
            ) : (
              filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className={`flex items-start gap-2 py-0.5 px-1.5 rounded ${
                    log.type === 'error' 
                      ? 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500' 
                      : log.type === 'warn' 
                      ? 'bg-amber-950/40 text-amber-300 border-l-2 border-amber-500' 
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-500 shrink-0 select-none text-[10px]">{log.time}</span>
                  <span className="font-bold text-[10px] uppercase select-none w-11 shrink-0">
                    {log.type}
                  </span>
                  <span className="break-all whitespace-pre-wrap flex-1 leading-relaxed">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
