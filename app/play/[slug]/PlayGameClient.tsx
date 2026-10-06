'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Maximize2, 
  Minimize2, 
  Share2, 
  RotateCw, 
  Flag, 
  ArrowLeft, 
  Sparkles, 
  User, 
  Eye, 
  Gamepad2,
  ExternalLink 
} from 'lucide-react';
import { ShareModal } from '@/components/publish/ShareModal';
import { ReportModal } from '@/components/publish/ReportModal';
import { recordGamePlay } from '@/lib/publish-manager';
import { Logo } from '@/components/Logo';
import type { PublishedGame } from '@/lib/types';

interface PlayGameClientProps {
  game: PublishedGame;
}

export function PlayGameClient({ game }: PlayGameClientProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Record play count once per browser session
  useEffect(() => {
    if (game.slug) {
      recordGamePlay(game.slug).catch(console.warn);
    }
  }, [game.slug]);

  // Lock window scroll on mobile/desktop
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="h-[100dvh] w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none fixed inset-0 z-50"
    >
      {/* Top Play Bar */}
      <header className="h-12 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 select-none">
        {/* Left: Brand + Title + Author */}
        <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
          <Link
            href="/explore"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Explore more games"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 overflow-hidden">
            <h1 className="text-xs sm:text-sm font-bold text-slate-100 truncate max-w-[150px] sm:max-w-xs md:max-w-md">
              {game.title}
            </h1>
            <span className="text-slate-600 hidden sm:inline">·</span>
            <span className="text-[11px] text-slate-400 truncate hidden sm:inline flex items-center gap-1">
              by <span className="text-slate-300 font-medium">{game.authorName}</span>
            </span>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Reload Game */}
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Restart Game"
            aria-label="Restart Game"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Share Game */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Report Button */}
          <button
            onClick={() => setIsReportOpen(true)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Report this game"
            aria-label="Report Game"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>

          {/* Made with Levelo Badge */}
          <Link
            href="/"
            className="hidden md:flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 font-medium ml-1 pl-2 border-l border-slate-800 transition-colors"
          >
            <span>Made with</span>
            <span className="text-indigo-400 font-bold">Levelo</span>
          </Link>
        </div>
      </header>

      {/* Main Game Fullscreen Viewport */}
      <main className="flex-1 w-full h-[calc(100dvh-48px)] bg-black relative flex items-center justify-center overflow-hidden">
        <iframe
          key={reloadKey}
          title={game.title}
          srcDoc={game.bundledHtml}
          // Sandboxed without allow-same-origin for maximum security
          sandbox="allow-scripts"
          className="w-full h-full border-0 block bg-slate-950"
          allow="autoplay; fullscreen; accelerometer; gyroscope"
        />
      </main>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        publishedGame={game}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        slug={game.slug}
        gameTitle={game.title}
      />
    </div>
  );
}
