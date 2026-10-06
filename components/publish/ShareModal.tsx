'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Code2, 
  Sparkles,
  Download,
  Smartphone
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import type { PublishedGame } from '@/lib/types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  publishedGame: PublishedGame;
}

export function ShareModal({ isOpen, onClose, publishedGame }: ShareModalProps) {
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);

  const [origin, setOrigin] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const playUrl = `${origin}/play/${publishedGame.slug}`;
  const embedCode = `<iframe src="${playUrl}" width="800" height="600" style="border:0;border-radius:12px;overflow:hidden;" allowfullscreen sandbox="allow-scripts"></iframe>`;

  // Generate QR Code with canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !playUrl) return;

    QRCode.toCanvas(
      canvasRef.current,
      playUrl,
      {
        width: 180,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#f8fafc',
        },
      },
      (err) => {
        if (!err) setQrGenerated(true);
      }
    );
  }, [isOpen, playUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(playUrl);
    setCopiedLink(true);
    showToast('Play link copied to clipboard!', 'info');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    showToast('Embed code copied!', 'info');
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: publishedGame.title,
          text: `Play "${publishedGame.title}" on Levelo!`,
          url: playUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQr = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${publishedGame.slug}_qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">Share Game</h2>
              <p className="text-xs text-slate-400 truncate max-w-[240px] sm:max-w-xs">{publishedGame.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Direct Link Bar */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Direct Play Link</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={playUrl}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Quick Actions (Open Game / Native Web Share) */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={playUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </a>

            <button
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mobile Share</span>
            </button>
          </div>

          {/* QR Code Section */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0 shadow-inner">
              <canvas ref={canvasRef} className="block w-28 h-28" />
            </div>
            <div className="space-y-2 text-center sm:text-left flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-semibold text-slate-200">
                <QrCode className="w-4 h-4 text-indigo-400" />
                <span>Instant Mobile QR Play</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Scan with any smartphone camera to launch the game instantly fullscreen with touch controls.
              </p>
              {qrGenerated && (
                <button
                  onClick={handleDownloadQr}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 cursor-pointer pt-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download QR Code Image</span>
                </button>
              )}
            </div>
          </div>

          {/* Embed Code Snippet */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Embed Code (iframe)</span>
              </label>
              <button
                onClick={handleCopyEmbed}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                {copiedEmbed ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedEmbed ? 'Copied' : 'Copy embed snippet'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={embedCode}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 select-all focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
