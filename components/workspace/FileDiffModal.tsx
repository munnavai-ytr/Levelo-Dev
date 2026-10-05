'use client';

import dynamic from 'next/dynamic';
import { X, GitCompare, FileCode, Loader2 } from 'lucide-react';

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

interface FileDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  originalContent: string;
  updatedContent: string;
  changeType?: 'created' | 'modified' | 'deleted';
}

export function FileDiffModal({
  isOpen,
  onClose,
  fileName,
  originalContent,
  updatedContent,
  changeType = 'modified'
}: FileDiffModalProps) {
  if (!isOpen) return null;

  const getLanguage = (name: string) => {
    if (name.endsWith('.js') || name.endsWith('.jsx')) return 'javascript';
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'typescript';
    if (name.endsWith('.css')) return 'css';
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.md')) return 'markdown';
    return 'html';
  };

  const badgeColor =
    changeType === 'created'
      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
      : changeType === 'deleted'
      ? 'bg-rose-950/80 text-rose-300 border-rose-800'
      : 'bg-indigo-950/80 text-indigo-300 border-indigo-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 font-mono">
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{fileName}</span>
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border uppercase ${badgeColor}`}>
                  {changeType}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Left: Original · Right: AI Update
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close diff modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diff Editor Container */}
        <div className="flex-1 w-full h-full overflow-hidden bg-slate-950">
          <MonacoDiff
            original={originalContent}
            modified={updatedContent}
            language={getLanguage(fileName)}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: true,
              fontSize: 12,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              padding: { top: 12, bottom: 12 }
            }}
          />
        </div>
      </div>
    </div>
  );
}
