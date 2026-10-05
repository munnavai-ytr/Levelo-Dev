'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
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
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync if initialCode changes externally (e.g. project load)
  useEffect(() => {
    const timer = setTimeout(() => {
      setCode(initialCode);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialCode]);

  // Handle Monaco mount
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  // Debounced auto-save to Firestore and parent
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newCode = value || '';
      setCode(newCode);
      onCodeChange(newCode);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setIsSaving(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await updateProjectFiles(projectId, { 'index.html': newCode });
          setIsSaving(false);
          setLastSavedAt(new Date().toLocaleTimeString());
        } catch (err) {
          console.error('Failed to autosave:', err);
          setIsSaving(false);
        }
      }, 750);
    },
    [projectId, onCodeChange, setIsSaving, setLastSavedAt]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
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
      setCode(DEFAULT_PHASER_STARTER);
      handleEditorChange(DEFAULT_PHASER_STARTER);
      showToast('Reset to default Phaser 3 template', 'info');
    }
  };

  const lineCount = code.split('\n').length;
  const charCount = code.length;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Editor Top Bar */}
      <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-xs font-mono text-indigo-300">
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>index.html</span>
          </div>

          {/* Save Status Indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-2">
            {isSaving ? (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Autosaved
              </span>
            )}
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleFormat}
            className="px-2.5 py-1 rounded-md border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1.5 transition-colors"
            title="Format Code"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Format</span>
          </button>

          <button
            onClick={handleResetToDefault}
            className="p-1.5 rounded-md border border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-300 hover:bg-rose-950/20 hover:border-rose-900/40 transition-colors"
            title="Reset to clean Phaser 3 starter"
            aria-label="Reset to default template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-md border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1.5 transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 w-full relative overflow-hidden bg-slate-950">
        <Editor
          height="100%"
          defaultLanguage="html"
          language="html"
          value={code}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 13,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            minimap: { enabled: false },
            lineNumbers: 'on',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            folding: true,
            cursorBlinking: 'smooth',
            smoothScrolling: true,
          }}
        />
      </div>

      {/* Editor Status Footer */}
      <div className="h-6 border-t border-slate-800/80 bg-slate-900/80 px-3 flex items-center justify-between text-[11px] font-mono text-slate-500 shrink-0">
        <div className="flex items-center gap-3">
          <span>HTML (Phaser 3)</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{lineCount} lines</span>
          <span>{charCount.toLocaleString()} chars</span>
        </div>
      </div>
    </div>
  );
}
