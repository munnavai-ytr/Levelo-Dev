'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  CheckCircle2, 
  Loader2, 
  Sparkles,
  FileCode
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
  initialCode: string;
  onCodeChange: (code: string) => void;
}

export function CodeEditor({ projectId, initialCode, onCodeChange }: CodeEditorProps) {
  const { theme, isSaving, setIsSaving, setLastSavedAt } = useAppStore();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({
    lines: initialCode.split('\n').length,
    chars: initialCode.length
  });

  const editorRef = useRef<any>(null);
  const valueRef = useRef<string>(initialCode);
  const savedValueRef = useRef<string>(initialCode);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync external code updates (e.g. from AI apply or project load)
  useEffect(() => {
    valueRef.current = initialCode;
    savedValueRef.current = initialCode;
    setStats({
      lines: initialCode.split('\n').length,
      chars: initialCode.length
    });
    if (editorRef.current && editorRef.current.getValue() !== initialCode) {
      editorRef.current.setValue(initialCode);
    }
  }, [initialCode]);

  // Flush pending changes to cloud/local storage
  const flushSave = useCallback(async () => {
    const currentCode = valueRef.current;
    if (currentCode === savedValueRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setIsSaving(true);
    try {
      // Write only changed files
      await updateProjectFiles(projectId, { 'index.html': currentCode });
      savedValueRef.current = currentCode;
      setIsSaving(false);
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to autosave file:', err);
      setIsSaving(false);
    }
  }, [projectId, setIsSaving, setLastSavedAt]);

  // Lifecycle listeners: visibilitychange, beforeunload, unmount
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
      }
    };

    const handleBeforeUnload = () => {
      flushSave();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushSave();
    };
  }, [flushSave]);

  // Handle Monaco mount
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    // Attach blur listener to flush immediately
    editor.onDidBlurEditorText(() => {
      flushSave();
    });
  };

  // Editor change handler:
  // - Keeps value in a ref (no full component re-render on each stroke)
  // - Debounces store/preview update to 400ms
  // - Debounces autosave to 1500ms
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newCode = value ?? '';
      valueRef.current = newCode;

      // Update light stats
      setStats({
        lines: newCode.split('\n').length,
        chars: newCode.length
      });

      // 400ms debounce for preview & parent state update
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
      previewTimerRef.current = setTimeout(() => {
        onCodeChange(newCode);
      }, 400);

      // 1500ms debounce for autosave
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      setIsSaving(true);
      autosaveTimerRef.current = setTimeout(() => {
        flushSave();
      }, 1500);
    },
    [onCodeChange, setIsSaving, flushSave]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(valueRef.current);
    setCopied(true);
    showToast('Code copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
      showToast('Document formatted', 'info');
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('Reset this game to the clean Phaser 3 starter template? Your unsaved edits will be replaced.')) {
      if (editorRef.current) {
        editorRef.current.setValue(DEFAULT_PHASER_STARTER);
      }
      handleEditorChange(DEFAULT_PHASER_STARTER);
      showToast('Reset to default Phaser 3 template', 'info');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Editor Top Bar */}
      <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-xs font-mono text-indigo-300">
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>index.html</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-slate-400 ml-2">
            <span>{stats.lines} lines</span>
            <span>·</span>
            <span>{stats.chars} chars</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleFormat}
            className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Format Document"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span className="hidden sm:inline">Format</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copy Code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleResetToDefault}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Reset to Phaser 3 Starter Template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Monaco Container */}
      <div className="flex-1 w-full h-full overflow-hidden">
        <Editor
          height="100%"
          language="html"
          defaultValue={initialCode}
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
    </div>
  );
}
