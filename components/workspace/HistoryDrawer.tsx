'use client';

import { useState } from 'react';
import { 
  X, 
  History, 
  RotateCcw, 
  Eye, 
  GitCompare, 
  Sparkles, 
  Bookmark, 
  Save, 
  Plus, 
  Check, 
  Clock, 
  AlertCircle,
  FileCode,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import type { ProjectVersion } from '@/lib/types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  versions: ProjectVersion[];
  currentFiles: Record<string, string>;
  activePreviewVersionId: string | null;
  onPreviewVersion: (version: ProjectVersion) => void;
  onExitPreview: () => void;
  onCompareVersion: (version: ProjectVersion) => void;
  onRestoreVersion: (version: ProjectVersion) => Promise<void>;
  onSaveManualVersion: (label: string) => Promise<void>;
}

export function HistoryDrawer({
  isOpen,
  onClose,
  versions,
  currentFiles,
  activePreviewVersionId,
  onPreviewVersion,
  onExitPreview,
  onCompareVersion,
  onRestoreVersion,
  onSaveManualVersion
}: HistoryDrawerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLabel.trim()) return;
    setIsSaving(true);
    try {
      await onSaveManualVersion(customLabel.trim());
      setCustomLabel('');
      setShowSaveInput(false);
    } finally {
      setIsSaving(false);
    }
  };

  const formatRelativeTime = (isoString: any) => {
    if (!isoString) return 'recently';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec < 45) return 'just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
      if (diffSec < 172800) return 'yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'recently';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-in fade-in duration-150">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      <div className="absolute inset-0 flex justify-end pointer-events-none">
        {/* Drawer container: side drawer on desktop, bottom sheet on mobile */}
        <div className="pointer-events-auto w-full max-w-md h-full bg-slate-950 border-l border-slate-800/90 shadow-2xl flex flex-col text-slate-100 z-10 transition-transform duration-200">
          {/* Drawer Header */}
          <div className="h-14 border-b border-slate-800 bg-slate-900/80 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Version History</h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  {versions.length} of 50 snapshots
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowSaveInput(!showSaveInput)}
                className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                title="Create a new manual snapshot"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Preview Alert Banner */}
          {activePreviewVersionId && (
            <div className="bg-amber-950/80 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Viewing historical preview</span>
              </div>
              <button
                onClick={onExitPreview}
                className="text-[11px] underline font-semibold text-amber-300 hover:text-amber-100"
              >
                Exit Preview
              </button>
            </div>
          )}

          {/* Manual Snapshot Input Form */}
          {showSaveInput && (
            <form onSubmit={handleSaveSubmit} className="p-3 bg-slate-900 border-b border-slate-800 flex flex-col gap-2 shrink-0">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                <span>Save Current State</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Snapshot label (e.g., Added audio fx)..."
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isSaving || !customLabel.trim()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shrink-0"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {/* Versions List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {versions.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4">
                <History className="w-8 h-8 text-slate-600 mb-2" />
                <p>No snapshots recorded yet.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Snapshots are automatically taken before & after each AI build.
                </p>
              </div>
            ) : (
              versions.map((ver, idx) => {
                const isCurrentPreview = activePreviewVersionId === ver.id;
                const fileCount = Object.keys(ver.files || {}).length;

                return (
                  <div
                    key={ver.id}
                    className={`rounded-xl border p-3 transition-all ${
                      isCurrentPreview
                        ? 'bg-amber-950/20 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800'
                    }`}
                  >
                    {/* Top Row: Source Badge & Timestamp */}
                    <div className="flex items-center justify-between mb-1.5 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        {ver.source === 'ai' && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 font-semibold flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI Build
                          </span>
                        )}
                        {ver.source === 'manual' && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-semibold flex items-center gap-1">
                            <Bookmark className="w-2.5 h-2.5" />
                            Manual
                          </span>
                        )}
                        {ver.source === 'restore' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center gap-1">
                            <RotateCcw className="w-2.5 h-2.5" />
                            Restored
                          </span>
                        )}

                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            Latest
                          </span>
                        )}
                      </div>

                      <div className="text-slate-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(ver.createdAt)}</span>
                      </div>
                    </div>

                    {/* Label */}
                    <h4 className="text-xs font-semibold text-slate-200 mb-1 leading-snug">
                      {ver.label}
                    </h4>

                    {/* AI Prompt (collapsible if available) */}
                    {ver.prompt && (
                      <div className="my-1.5">
                        <button
                          onClick={() => setExpandedPromptId(expandedPromptId === ver.id ? null : ver.id)}
                          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer font-mono"
                        >
                          <span>Prompt details</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${expandedPromptId === ver.id ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedPromptId === ver.id && (
                          <p className="mt-1 p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 italic whitespace-pre-wrap leading-relaxed">
                            &quot;{ver.prompt}&quot;
                          </p>
                        )}
                      </div>
                    )}

                    {/* Metadata & Actions */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {fileCount} {fileCount === 1 ? 'file' : 'files'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {/* Preview Action */}
                        {isCurrentPreview ? (
                          <button
                            onClick={onExitPreview}
                            className="px-2 py-1 rounded bg-amber-600/30 border border-amber-500/50 text-amber-300 text-[11px] font-medium"
                          >
                            Exit
                          </button>
                        ) : (
                          <button
                            onClick={() => onPreviewVersion(ver)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                            title="Preview without saving"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                        )}

                        {/* Compare Diff Action */}
                        <button
                          onClick={() => onCompareVersion(ver)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                          title="Compare with current code"
                        >
                          <GitCompare className="w-3 h-3" />
                          <span>Compare</span>
                        </button>

                        {/* Restore Action */}
                        <button
                          onClick={() => {
                            if (window.confirm(`Restore project to "${ver.label}"? A safety backup will be made.`)) {
                              onRestoreVersion(ver);
                            }
                          }}
                          className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                          title="Restore this version"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
