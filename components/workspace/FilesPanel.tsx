'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/components/Toast';
import { 
  FileCode, 
  Folder, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  Info,
  Layers,
  Sparkles
} from 'lucide-react';

interface FilesPanelProps {
  files: Record<string, string>;
  projectTitle: string;
}

export function FilesPanel({ files, projectTitle }: FilesPanelProps) {
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<string>('index.html');
  const [copied, setCopied] = useState(false);

  const fileEntries = Object.entries(files);

  const handleDownload = () => {
    const content = files[selectedFile] || '';
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle.toLowerCase().replace(/\s+/g, '_')}_${selectedFile}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${selectedFile}`, 'success');
  };

  const handleCopyContent = () => {
    const content = files[selectedFile] || '';
    navigator.clipboard.writeText(content);
    setCopied(true);
    showToast('File content copied', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const currentContent = files[selectedFile] || '';
  const currentLines = currentContent.split('\n').length;
  const currentBytes = new Blob([currentContent]).size;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Files Top Bar */}
      <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-semibold text-slate-200">Project Files</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyContent}
            className="p-1.5 rounded-md border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
            title="Copy current file"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Copy</span>
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md border border-slate-800 bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center gap-1.5 transition-colors"
            title="Download file to computer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Main Files Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* File Tree List */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800/80 bg-slate-900/30 p-3 overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Source Files
          </div>
          <div className="space-y-1">
            {fileEntries.map(([filename, content]) => {
              const isSelected = selectedFile === filename;
              const lines = content.split('\n').length;
              return (
                <button
                  key={filename}
                  onClick={() => setSelectedFile(filename)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-mono transition-colors text-left ${
                    isSelected
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-medium'
                      : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate">{filename}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans tabular-nums ml-2">
                    {lines} lines
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 px-1 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-1.5 text-indigo-300 font-medium">
              <Layers className="w-3.5 h-3.5" />
              <span>Phaser 3 Architecture</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              The entire game is bundled self-contained inside <code className="text-slate-200">index.html</code>. It runs smoothly inside any standard web browser, iframe, or mobile webview.
            </p>
          </div>
        </div>

        {/* Selected File Details & Quick Preview */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-100 font-mono">{selectedFile}</h4>
                  <p className="text-xs text-slate-400">Primary Game Document</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                <span className="text-[11px] text-slate-400">File Size</span>
                <p className="text-sm font-semibold text-slate-100 mt-1 tabular-nums font-mono">
                  {(currentBytes / 1024).toFixed(1)} KB
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                <span className="text-[11px] text-slate-400">Lines of Code</span>
                <p className="text-sm font-semibold text-slate-100 mt-1 tabular-nums font-mono">
                  {currentLines}
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-400">Framework</span>
                <p className="text-sm font-semibold text-indigo-400 mt-1">
                  Phaser v3.80.1
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-200">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Zero External Asset Dependencies</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All sprites, platforms, particles, and star collectibles are procedurally generated in canvas memory. This guarantees your game loads immediately with zero 404 network errors or CORS restrictions!
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Project: <strong className="text-slate-200">{projectTitle}</strong></span>
            <span>Single-file executable bundle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
