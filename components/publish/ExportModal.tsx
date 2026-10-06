'use client';

import { useState } from 'react';
import { 
  X, 
  Download, 
  FileCode, 
  Archive, 
  Smartphone, 
  Loader2, 
  CheckCircle2, 
  ArrowRight,
  Info
} from 'lucide-react';
import { 
  exportProjectZip, 
  exportStandaloneHtml, 
  exportCapacitorZip, 
  downloadBlob 
} from '@/lib/export-manager';
import { useToast } from '@/components/Toast';
import type { GameProject, ProjectAsset } from '@/lib/types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: GameProject;
  assets: ProjectAsset[];
}

export function ExportModal({ isOpen, onClose, project, assets }: ExportModalProps) {
  const { showToast } = useToast();
  const [downloadingType, setDownloadingType] = useState<'zip' | 'html' | 'capacitor' | null>(null);

  if (!isOpen) return null;

  const sanitizedFileName = project.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 24) || 'levelo_game';

  // 1. Export Project ZIP
  const handleExportZip = async () => {
    setDownloadingType('zip');
    try {
      const blob = await exportProjectZip(project, assets);
      downloadBlob(blob, `${sanitizedFileName}_source.zip`);
      showToast('Project ZIP downloaded successfully!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to export project ZIP.', 'error');
    } finally {
      setDownloadingType(null);
    }
  };

  // 2. Export Standalone HTML
  const handleExportHtml = () => {
    setDownloadingType('html');
    try {
      const htmlContent = exportStandaloneHtml(project, assets);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      downloadBlob(blob, `${sanitizedFileName}.html`);
      showToast('Standalone HTML file downloaded!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to export HTML.', 'error');
    } finally {
      setDownloadingType(null);
    }
  };

  // 3. Export Capacitor Mobile App Folder
  const handleExportCapacitor = async () => {
    setDownloadingType('capacitor');
    try {
      const blob = await exportCapacitorZip(project, assets);
      downloadBlob(blob, `${sanitizedFileName}_capacitor_app.zip`);
      showToast('Capacitor Mobile project downloaded! Check README for APK build steps.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to export Capacitor bundle.', 'error');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">Export Game</h2>
              <p className="text-xs text-slate-400">Download standalone packages, source code or mobile wrappers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Options */}
        <div className="p-5 space-y-3.5 overflow-y-auto max-h-[75vh]">
          {/* Option 1: Standalone Single HTML File */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-3 group">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                  Standalone HTML File (.html)
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  A single self-contained file with all game logic, styles, and asset data URIs inlined. Double-click to play in any browser offline or upload to itch.io!
                </p>
              </div>
            </div>

            <button
              onClick={handleExportHtml}
              disabled={downloadingType !== null}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              {downloadingType === 'html' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download Standalone HTML</span>
            </button>
          </div>

          {/* Option 2: Full Source Code ZIP */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-3 group">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
                  Full Project Source Code (.zip)
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Complete directory with <code className="text-amber-300/90 font-mono">index.html</code>, scripts, styles, separate <code className="text-amber-300/90 font-mono">assets/</code> folder, and local runner instructions.
                </p>
              </div>
            </div>

            <button
              onClick={handleExportZip}
              disabled={downloadingType !== null}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              {downloadingType === 'zip' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download Project ZIP</span>
            </button>
          </div>

          {/* Option 3: Capacitor Mobile App */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-3 group">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
                  Mobile App Bundle (Capacitor)
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  A ready-to-build native mobile project (<code className="text-emerald-300/90 font-mono">package.json</code>, <code className="text-emerald-300/90 font-mono">capacitor.config.ts</code>, <code className="text-emerald-300/90 font-mono">www/</code>) and step-by-step README for compiling Android APKs in Android Studio.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[10px] text-slate-400 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                Note: Native Android APKs and iOS IPAs are compiled via Android Studio or Xcode on your machine.
              </span>
            </div>

            <button
              onClick={handleExportCapacitor}
              disabled={downloadingType !== null}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              {downloadingType === 'capacitor' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download Mobile App (Capacitor)</span>
            </button>
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
