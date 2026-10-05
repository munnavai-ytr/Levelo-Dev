'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { X, GitCompare, RotateCcw, FileCode, Loader2 } from 'lucide-react';
import type { ProjectVersion } from '@/lib/types';

const MonacoDiff = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 h-full flex items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mr-2" />
        Loading Monaco Diff Engine...
      </div>
    )
  }
);

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: ProjectVersion | null;
  currentFiles: Record<string, string>;
  onRestore: (version: ProjectVersion) => Promise<void>;
}

export function DiffModal({
  isOpen,
  onClose,
  version,
  currentFiles,
  onRestore
}: DiffModalProps) {
  const [selectedFile, setSelectedFile] = useState<string>('index.html');
  const [isRestoring, setIsRestoring] = useState(false);

  if (!isOpen || !version) return null;

  // List all files available in either the snapshot or current files
  const allFiles = Array.from(
    new Set([...Object.keys(version.files), ...Object.keys(currentFiles)])
  );

  const originalContent = version.files[selectedFile] || '';
  const currentContent = currentFiles[selectedFile] || '';

  // Determine file language for Monaco
  const getLanguage = (fileName: string) => {
    if (fileName.endsWith('.js')) return 'javascript';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.json')) return 'json';
    return 'html';
  };

  const handleRestoreClick = async () => {
    if (window.confirm(`Restore project to version "${version.label}"? A safety backup will be created.`)) {
      setIsRestoring(true);
      try {
        await onRestore(version);
        onClose();
      } finally {
        setIsRestoring(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-slate-100">
        {/* Top Header */}
        <div className="h-14 border-b border-slate-800 bg-slate-950/80 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Compare Changes:</span>
                <span className="font-mono text-indigo-300 text-xs px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">
                  {version.label}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Left: Snapshot Version · Right: Current Project Files
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* File Switcher */}
            {allFiles.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <FileCode className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                <select
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none pr-2 cursor-pointer font-mono"
                >
                  {allFiles.map((f) => (
                    <option key={f} value={f} className="bg-slate-900 text-slate-200">
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleRestoreClick}
              disabled={isRestoring}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRestoring ? 'Restoring...' : 'Restore This Version'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close diff modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diff Canvas Area */}
        <div className="flex-1 relative overflow-hidden bg-slate-950">
          <MonacoDiff
            original={originalContent}
            modified={currentContent}
            language={getLanguage(selectedFile)}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: true,
              fontSize: 12,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}
