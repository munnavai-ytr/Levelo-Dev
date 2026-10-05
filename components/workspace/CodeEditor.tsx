'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { loader } from '@monaco-editor/react';
import { useAppStore } from '@/lib/store';
import { updateProjectFiles } from '@/lib/firebase';
import { useToast } from '@/components/Toast';
import { DEFAULT_PHASER_STARTER } from '@/lib/starter-game';
import { 
  Check, 
  Copy, 
  RotateCcw, 
  Code2, 
  Loader2, 
  Sparkles,
  FileCode,
  X,
  Plus,
  ChevronDown,
  Layers,
  FileText
} from 'lucide-react';

// Configure self-hosted Monaco Editor (/public/monaco/vs)
if (typeof window !== 'undefined') {
  loader.config({ paths: { vs: '/monaco/vs' } });
}

// Dynamically import Monaco Editor to avoid SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full flex items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
      <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mr-2" />
      Loading Monaco Code Engine...
    </div>
  )
});

interface CodeEditorProps {
  projectId: string;
  files: Record<string, string>;
  initialActiveFile?: string;
  onFilesChange: (updatedFiles: Record<string, string>, deletedFiles?: string[]) => void;
  onActiveFileChange?: (fileName: string) => void;
}

export function CodeEditor({
  projectId,
  files,
  initialActiveFile = 'index.html',
  onFilesChange,
  onActiveFileChange
}: CodeEditorProps) {
  const { theme, isSaving, setIsSaving, setLastSavedAt } = useAppStore();
  const { showToast } = useToast();

  const allFileKeys = useMemo(() => Object.keys(files), [files]);

  // Open tabs list
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    const initialList = allFileKeys.slice(0, 5);
    if (!initialList.includes(initialActiveFile) && files[initialActiveFile] !== undefined) {
      initialList.unshift(initialActiveFile);
    }
    return initialList.length > 0 ? initialList : ['index.html'];
  });

  const [activeFile, setActiveFile] = useState<string>(
    files[initialActiveFile] !== undefined ? initialActiveFile : allFileKeys[0] || 'index.html'
  );

  // Unsaved files tracking (file path -> dirty boolean)
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, boolean>>({});

  // Mobile bottom sheet file picker state
  const [isMobilePickerOpen, setIsMobilePickerOpen] = useState(false);

  const [copied, setCopied] = useState(false);
  const editorRef = useRef<any>(null);

  // Buffer of working contents per file
  const workingFilesRef = useRef<Record<string, string>>({ ...files });
  const savedFilesRef = useRef<Record<string, string>>({ ...files });

  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep working buffer in sync when external files change (e.g. AI updates)
  useEffect(() => {
    for (const [key, content] of Object.entries(files)) {
      if (!dirtyFiles[key]) {
        workingFilesRef.current[key] = content;
        savedFilesRef.current[key] = content;
      }
    }

    // Ensure activeFile exists
    if (files[activeFile] === undefined && allFileKeys.length > 0) {
      const fallback = allFileKeys.includes('index.html') ? 'index.html' : allFileKeys[0];
      setActiveFile(fallback);
      if (!openTabs.includes(fallback)) {
        setOpenTabs((prev) => [...prev, fallback]);
      }
    }
  }, [files, dirtyFiles, activeFile, allFileKeys, openTabs]);

  // Update editor value when activeFile changes
  useEffect(() => {
    if (editorRef.current) {
      const targetContent = workingFilesRef.current[activeFile] ?? files[activeFile] ?? '';
      if (editorRef.current.getValue() !== targetContent) {
        editorRef.current.setValue(targetContent);
      }
    }
    onActiveFileChange?.(activeFile);
  }, [activeFile, files, onActiveFileChange]);

  // Determine Monaco syntax highlighting language by extension
  const activeLanguage = useMemo(() => {
    if (activeFile.endsWith('.js') || activeFile.endsWith('.jsx')) return 'javascript';
    if (activeFile.endsWith('.ts') || activeFile.endsWith('.tsx')) return 'typescript';
    if (activeFile.endsWith('.css')) return 'css';
    if (activeFile.endsWith('.json')) return 'json';
    if (activeFile.endsWith('.md')) return 'markdown';
    return 'html';
  }, [activeFile]);

  // Flush pending changes
  const flushSave = useCallback(async () => {
    const dirtyList = Object.keys(dirtyFiles).filter((f) => dirtyFiles[f]);
    if (dirtyList.length === 0) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setIsSaving(true);
    const updates: Record<string, string> = {};
    for (const file of dirtyList) {
      updates[file] = workingFilesRef.current[file] ?? '';
    }

    try {
      await updateProjectFiles(projectId, updates);
      // Mark as saved
      for (const file of dirtyList) {
        savedFilesRef.current[file] = updates[file];
      }
      setDirtyFiles({});
      setIsSaving(false);
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to autosave files:', err);
      setIsSaving(false);
    }
  }, [projectId, dirtyFiles, setIsSaving, setLastSavedAt]);

  // Lifecycle listeners
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
      }
    };
    const handleBeforeUnload = () => {
      flushSave();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushSave();
    };
  }, [flushSave]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    editor.onDidBlurEditorText(() => {
      flushSave();
    });
  };

  // Editor typing change handler
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newCode = value ?? '';
      workingFilesRef.current[activeFile] = newCode;

      // Mark file dirty if different from saved
      const isDirty = newCode !== savedFilesRef.current[activeFile];
      setDirtyFiles((prev) => ({ ...prev, [activeFile]: isDirty }));

      // 400ms preview debounce
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
      previewTimerRef.current = setTimeout(() => {
        onFilesChange({ ...workingFilesRef.current });
      }, 400);

      // 1500ms autosave debounce
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      setIsSaving(true);
      autosaveTimerRef.current = setTimeout(() => {
        flushSave();
      }, 1500);
    },
    [activeFile, onFilesChange, setIsSaving, flushSave]
  );

  const handleOpenTab = (fileName: string) => {
    if (!openTabs.includes(fileName)) {
      setOpenTabs((prev) => [...prev, fileName]);
    }
    setActiveFile(fileName);
    setIsMobilePickerOpen(false);
  };

  const handleCloseTab = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = openTabs.filter((t) => t !== fileName);
    if (remaining.length === 0) {
      const fallback = allFileKeys.find((k) => k !== fileName) || 'index.html';
      setOpenTabs([fallback]);
      setActiveFile(fallback);
    } else {
      setOpenTabs(remaining);
      if (activeFile === fileName) {
        setActiveFile(remaining[remaining.length - 1]);
      }
    }
  };

  const handleCopy = () => {
    const content = workingFilesRef.current[activeFile] || '';
    navigator.clipboard.writeText(content);
    setCopied(true);
    showToast(`Copied ${activeFile}`, 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
      showToast('Document formatted', 'info');
    }
  };

  const handleResetStarter = () => {
    if (activeFile !== 'index.html') {
      showToast('Reset template only applies to index.html', 'info');
      return;
    }
    if (window.confirm('Reset index.html to default starter template?')) {
      if (editorRef.current) {
        editorRef.current.setValue(DEFAULT_PHASER_STARTER);
      }
      handleEditorChange(DEFAULT_PHASER_STARTER);
      showToast('Reset to starter template', 'info');
    }
  };

  const currentContent = workingFilesRef.current[activeFile] || '';
  const currentLines = currentContent.split('\n').length;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none relative">
      {/* ======================================================== */}
      {/* DESKTOP & TABLET OPEN FILE TABS BAR                      */}
      {/* ======================================================== */}
      <div className="hidden sm:flex h-10 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-sm items-center justify-between px-2 shrink-0 overflow-x-auto scrollbar-none">
        {/* Tab Items */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {openTabs.map((tab) => {
            const isActive = tab === activeFile;
            const isDirty = dirtyFiles[tab];

            return (
              <button
                key={tab}
                onClick={() => setActiveFile(tab)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-950 text-indigo-300 border border-slate-800 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{tab}</span>

                {/* Unsaved Dot */}
                {isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
                )}

                {/* Close Tab Button */}
                {openTabs.length > 1 && (
                  <span
                    onClick={(e) => handleCloseTab(tab, e)}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors ml-1"
                    title="Close tab"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}

          {/* Quick Add Tab Dropdown / Plus */}
          <div className="relative group">
            <button
              onClick={() => setIsMobilePickerOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
              title="Open other files"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-[11px] font-mono text-slate-500 mr-2">{currentLines} lines</span>

          <button
            onClick={handleFormat}
            className="px-2 py-1 rounded-md border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
            title="Format Document"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span className="hidden md:inline">Format</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-2 py-1 rounded-md border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
            title="Copy Code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden md:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {activeFile === 'index.html' && (
            <button
              onClick={handleResetStarter}
              className="p-1 rounded-md border border-slate-800 bg-slate-900/80 hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
              title="Reset index.html to Starter Template"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MOBILE TOP BAR (Full-width editor + Bottom sheet picker)  */}
      {/* ======================================================== */}
      <div className="sm:hidden h-11 border-b border-slate-800/80 bg-slate-900/80 px-3 flex items-center justify-between shrink-0">
        {/* Active file button -> opens bottom sheet */}
        <button
          onClick={() => setIsMobilePickerOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 font-semibold active:scale-95 transition-transform"
        >
          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
          <span className="truncate max-w-[150px]">{activeFile}</span>
          {dirtyFiles[activeFile] && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handleFormat}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 active:bg-slate-800"
            title="Format"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 active:bg-slate-800"
            title="Copy"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MONACO EDITOR CONTAINER                                  */}
      {/* ======================================================== */}
      <div className="flex-1 w-full h-full overflow-hidden">
        <Editor
          height="100%"
          language={activeLanguage}
          defaultValue={files[activeFile] || ''}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: 'none',
            folding: true,
            bracketPairColorization: { enabled: true },
            formatOnPaste: false,
            formatOnType: false,
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 }
          }}
        />
      </div>

      {/* ======================================================== */}
      {/* MOBILE FILE PICKER BOTTOM SHEET                          */}
      {/* ======================================================== */}
      {isMobilePickerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 max-h-[70vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Select Project File</span>
              </h4>
              <button
                onClick={() => setIsMobilePickerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Files List */}
            <div className="py-2 overflow-y-auto space-y-1">
              {allFileKeys.map((key) => {
                const isCurrent = key === activeFile;
                const isDirty = dirtyFiles[key];

                return (
                  <button
                    key={key}
                    onClick={() => handleOpenTab(key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-mono transition-colors ${
                      isCurrent
                        ? 'bg-indigo-600 text-white font-semibold shadow-md'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileCode className="w-4 h-4 shrink-0" />
                      <span className="truncate">{key}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDirty && (
                        <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved" />
                      )}
                      <span className="text-[10px] opacity-75 font-sans">
                        {files[key]?.split('\n').length || 0} lines
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
