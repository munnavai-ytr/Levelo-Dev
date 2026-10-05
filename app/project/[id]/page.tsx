'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { fetchProjectById, updateProjectFiles, renameProject, updateProjectThumbnail } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/components/Toast';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { PreviewPanel } from '@/components/workspace/PreviewPanel';
import { ChatPanel } from '@/components/workspace/ChatPanel';
import { Logo } from '@/components/Logo';
import { 
  Gamepad2, 
  ChevronRight, 
  Play, 
  Code2, 
  FolderTree, 
  MessageSquare, 
  Sun, 
  Moon, 
  ArrowLeft, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Loader2, 
  Edit2
} from 'lucide-react';

// Dynamic import heavy components to optimize initial bundle size (Item 7)
const CodeEditor = dynamic(
  () => import('@/components/workspace/CodeEditor').then((m) => m.CodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 h-full flex items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mr-2" />
        Loading Monaco Code Engine...
      </div>
    )
  }
);

const FilesPanel = dynamic(
  () => import('@/components/workspace/FilesPanel').then((m) => m.FilesPanel),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 text-xs text-slate-400 font-mono">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500 inline mr-2" />
        Loading project files...
      </div>
    )
  }
);

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const { user, isAuthLoading } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile(1024);

  const { 
    theme, 
    toggleTheme, 
    activeTab, 
    setActiveTab, 
    mobileTab, 
    setMobileTab,
    currentProject, 
    setCurrentProject,
    updateCurrentHtml,
    isSaving,
    lastSavedAt 
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(380); // Default desktop chat width in px
  const [isResizing, setIsResizing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  // Track if Code tab has been opened to defer Monaco initialization
  const [hasOpenedCode, setHasOpenedCode] = useState(false);

  // Live code state (synced with index.html)
  const [liveHtml, setLiveHtml] = useState<string>('');

  // Trigger from error banner ("Fix with AI")
  const [externalPromptTrigger, setExternalPromptTrigger] = useState<{
    prompt: string;
    timestamp: number;
    errorContext?: any;
  } | null>(null);

  // Prefetch Monaco in background via requestIdleCallback after workspace loads (Item 6)
  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      const prefetchMonaco = () => {
        import('@monaco-editor/react').then((m) => {
          m.loader.config({ paths: { vs: '/monaco/vs' } });
          m.loader.init().catch(() => {});
        }).catch(() => {});
      };

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(prefetchMonaco);
      } else {
        setTimeout(prefetchMonaco, 2000);
      }
    }
  }, [loading]);

  useEffect(() => {
    if (activeTab === 'code' || mobileTab === 'code') {
      setHasOpenedCode(true);
    }
  }, [activeTab, mobileTab]);

  // Redirect if signed out
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);

  // Load project by ID
  useEffect(() => {
    let active = true;
    async function load() {
      if (!projectId) return;
      try {
        const proj = await fetchProjectById(projectId);
        if (active) {
          if (proj) {
            setCurrentProject(proj);
            const initialCode = proj.files['index.html'] || '';
            setLiveHtml(initialCode);
            setTitleInput(proj.title);

            // Populate chat messages if stored
            if (proj.chatMessages && proj.chatMessages.length > 0) {
              useAppStore.setState({ chatMessages: proj.chatMessages });
            }
          } else {
            showToast('Project not found', 'error');
            router.push('/dashboard');
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load project:', err);
        if (active) {
          showToast('Failed to load project', 'error');
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [projectId, setCurrentProject, router, showToast]);

  // Handle Code Editor Live Changes
  const handleCodeChange = (newCode: string) => {
    setLiveHtml(newCode);
    updateCurrentHtml(newCode);
  };

  // Handle Applying AI Generated Files
  const handleApplyAiFiles = async (newFiles: Record<string, string>) => {
    if (!currentProject) return;
    const updatedHtml = newFiles['index.html'] || liveHtml;
    setLiveHtml(updatedHtml);
    updateCurrentHtml(updatedHtml);

    try {
      await updateProjectFiles(currentProject.id, newFiles);
    } catch (err) {
      console.warn('Failed to persist project files:', err);
    }
  };

  // "Fix with AI" handler from Preview runtime error banner
  const handleFixWithAi = (errorInfo: { message: string; stack?: string }) => {
    setExternalPromptTrigger({
      prompt: `Fix this runtime error in the game:\n"${errorInfo.message}"`,
      timestamp: Date.now(),
      errorContext: errorInfo
    });

    if (chatCollapsed) {
      setChatCollapsed(false);
    }
    setMobileTab('chat');
  };

  // Title renaming inline
  const handleSaveTitle = async () => {
    if (!titleInput.trim() || !currentProject) return;
    setIsEditingTitle(false);
    if (titleInput.trim() !== currentProject.title) {
      try {
        await renameProject(currentProject.id, titleInput.trim());
        setCurrentProject({ ...currentProject, title: titleInput.trim() });
        showToast('Title updated', 'success');
      } catch {
        showToast('Failed to update title', 'error');
      }
    }
  };

  const handleCaptureThumbnail = useCallback(
    (thumbnail: string) => {
      if (currentProject?.id) {
        updateProjectThumbnail(currentProject.id, thumbnail).catch(console.warn);
      }
    },
    [currentProject?.id]
  );

  // Resizable split view handlers for Desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX, 280), 650);
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (loading || isAuthLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
        <Logo size="lg" />
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          <span>Booting Levelo Engine...</span>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return null;
  }

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Top Workspace Header */}
      <header className="h-12 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left: Brand + Breadcrumbs + Project Title */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-slate-200 transition-colors">
              Projects
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          </div>

          {/* Editable Title */}
          {isEditingTitle ? (
            <input
              type="text"
              autoFocus
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              className="px-2 py-0.5 text-xs font-semibold bg-slate-900 border border-indigo-500 rounded text-slate-100 focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-100 hover:text-indigo-300 transition-colors truncate max-w-[180px] sm:max-w-xs group cursor-pointer"
              title="Click to rename"
            >
              <span className="truncate">{currentProject.title}</span>
              <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}

          {/* Saving Status */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono ml-2 pl-2 border-l border-slate-800">
            {isSaving ? (
              <span className="text-amber-400">Saving...</span>
            ) : (
              <span>Saved {lastSavedAt || 'ready'}</span>
            )}
          </div>
        </div>

        {/* Center / Right: Desktop Tabs (Preview | Code | Files) */}
        {!isMobile && (
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'preview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'code'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'files'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Files</span>
            </button>
          </div>
        )}

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {!isMobile && (
            <button
              onClick={() => setChatCollapsed(!chatCollapsed)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title={chatCollapsed ? 'Expand Chat Panel' : 'Collapse Chat Panel'}
              aria-label="Toggle chat panel"
            >
              {chatCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Area - ONLY mounts active layout (zero double mounting, Item 14) */}
      <div className="flex-1 flex overflow-hidden relative">
        {!isMobile ? (
          /* ======================================================== */
          /* DESKTOP (>= 1024px) RESIZABLE SPLIT VIEW                 */
          /* ======================================================== */
          <div className="flex w-full h-full overflow-hidden">
            {/* Left: Chat Panel */}
            {!chatCollapsed && (
              <div
                style={{ width: `${chatWidth}px` }}
                className="h-full shrink-0 flex flex-col relative"
              >
                <ChatPanel
                  projectId={currentProject.id}
                  projectFiles={currentProject.files}
                  onApplyFiles={handleApplyAiFiles}
                  externalPromptTrigger={externalPromptTrigger}
                />
              </div>
            )}

            {/* Resizer Handle */}
            {!chatCollapsed && (
              <div
                onMouseDown={handleMouseDown}
                className={`w-1 hover:w-1.5 bg-slate-800/80 hover:bg-indigo-500 cursor-col-resize transition-all shrink-0 z-20 ${
                  isResizing ? 'bg-indigo-500 w-1.5' : ''
                }`}
                title="Drag to resize panels"
              />
            )}

            {/* Right: Active Tab View (Preview | Code | Files) */}
            <div className="flex-1 h-full overflow-hidden bg-slate-950">
              {activeTab === 'preview' && (
                <PreviewPanel 
                  htmlCode={liveHtml} 
                  onFixWithAi={handleFixWithAi}
                  onCaptureThumbnail={handleCaptureThumbnail}
                />
              )}
              {activeTab === 'code' && hasOpenedCode && (
                <CodeEditor
                  projectId={currentProject.id}
                  initialCode={liveHtml}
                  onCodeChange={handleCodeChange}
                />
              )}
              {activeTab === 'files' && (
                <FilesPanel
                  files={currentProject.files}
                  projectTitle={currentProject.title}
                />
              )}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* MOBILE (< 1024px) FULL-SCREEN SINGLE ACTIVE VIEW         */
          /* ======================================================== */
          <div className="flex-1 flex flex-col w-full h-full overflow-hidden pb-14">
            <div className="flex-1 h-full overflow-hidden">
              {mobileTab === 'chat' && (
                <ChatPanel
                  projectId={currentProject.id}
                  projectFiles={currentProject.files}
                  onApplyFiles={handleApplyAiFiles}
                  onBuildFinished={() => setMobileTab('preview')}
                  externalPromptTrigger={externalPromptTrigger}
                />
              )}
              {mobileTab === 'preview' && (
                <PreviewPanel 
                  htmlCode={liveHtml} 
                  onFixWithAi={handleFixWithAi}
                  onCaptureThumbnail={handleCaptureThumbnail}
                />
              )}
              {mobileTab === 'code' && hasOpenedCode && (
                <CodeEditor
                  projectId={currentProject.id}
                  initialCode={liveHtml}
                  onCodeChange={handleCodeChange}
                />
              )}
            </div>

            {/* Mobile Bottom Tab Bar */}
            <div className="fixed bottom-0 left-0 right-0 h-14 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-lg flex items-center justify-around px-2 z-40 pb-[env(safe-area-inset-bottom)] select-none">
              <button
                onClick={() => setMobileTab('chat')}
                className={`flex-1 flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
                  mobileTab === 'chat' ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-[10px] mt-1">Chat</span>
              </button>

              <button
                onClick={() => setMobileTab('preview')}
                className={`flex-1 flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
                  mobileTab === 'preview' ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span className="text-[10px] mt-1">Preview</span>
              </button>

              <button
                onClick={() => setMobileTab('code')}
                className={`flex-1 flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
                  mobileTab === 'code' ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span className="text-[10px] mt-1">Code</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
