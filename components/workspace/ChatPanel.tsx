'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/components/Toast';
import { parseAiResponse } from '@/lib/parse-ai-response';
import { updateProjectChat } from '@/lib/firebase';
import { STORAGE_KEYS, runStorageMigration } from '@/lib/storage-migration';
import type { ChatMessage } from '@/lib/types';
import { 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  Trash2, 
  Square, 
  AlertTriangle, 
  RotateCcw, 
  Key, 
  CheckCircle2, 
  Loader2, 
  Zap, 
  ArrowRight,
  ExternalLink,
  Code2
} from 'lucide-react';

export const PROMPT_IDEAS = [
  { label: '🚀 Space Shooter', prompt: 'Build a vertical scrolling space shooter with player laser cannons, incoming alien waves, starfield parallax, and explosion effects.' },
  { label: '🐦 Flappy Bird', prompt: 'Create a Flappy-style bird game where tapping/space flaps upwards through moving pipe obstacles, tracking high scores.' },
  { label: '🧱 Brick Breaker', prompt: 'Make an arcade brick breaker game with bouncing ball, responsive paddle, multicolor bricks, and power-up drops.' },
  { label: '🏃 Endless Jumper', prompt: 'Build an endless vertical jumping game where platforms scroll down and the camera follows the player upwards.' },
  { label: '👾 Asteroids Arena', prompt: 'Create a classic Asteroids arcade game with rotating ship, thrust inertia, splitting floating space rocks, and wrap-around screen boundaries.' },
  { label: '⚡ Cyberpunk Runner', prompt: 'Transform this into a fast-paced neon cyberpunk runner with dashing, neon glow effects, and hazard obstacles.' },
];

let msgSeq = 0;
function createMessageItem(
  role: 'user' | 'assistant' | 'system',
  content: string,
  extra?: Partial<ChatMessage>
): ChatMessage {
  msgSeq += 1;
  return {
    id: `msg_${Date.now()}_${msgSeq}`,
    role,
    content,
    timestamp: Date.now(),
    ...extra
  };
}

interface ChatPanelProps {
  projectId: string;
  projectFiles: Record<string, string>;
  onApplyFiles: (newFiles: Record<string, string>) => Promise<void>;
  onBuildFinished?: () => void;
  externalPromptTrigger?: { prompt: string; timestamp: number; errorContext?: any } | null;
}

export function ChatPanel({
  projectId,
  projectFiles,
  onApplyFiles,
  onBuildFinished,
  externalPromptTrigger
}: ChatPanelProps) {
  const { chatMessages, addChatMessage, clearChat, geminiModel, setMobileTab } = useAppStore();
  const { showToast } = useToast();

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [buildStep, setBuildStep] = useState<'idle' | 'planning' | 'writing' | 'applying'>('idle');
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastHandledTriggerRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isGenerating, buildStep]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setBuildStep('idle');
      showToast('Generation stopped by user', 'info');
    }
  };

  const handleSendMessage = useCallback(async (textToSend?: string, errorContext?: any) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || isGenerating) return;

    // Get API key from localStorage or store
    runStorageMigration();
    const storedKey = typeof window !== 'undefined' 
      ? localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || localStorage.getItem('gameforge_gemini_api_key') || '' 
      : '';

    // If API key is completely missing
    if (!storedKey) {
      const userMsg = createMessageItem('user', promptText);
      addChatMessage(userMsg);
      if (!textToSend) setInput('');

      const errorMsg = createMessageItem(
        'assistant',
        'Gemini API key is required to build or modify games. Please configure your free API key in Settings to activate the real AI generation engine.',
        {
          status: 'error',
          errorType: 'missing_key',
          tags: ['Action Required']
        }
      );
      addChatMessage(errorMsg);
      return;
    }

    // Add user message
    const userMsg = createMessageItem('user', promptText);
    addChatMessage(userMsg);
    if (!textToSend) setInput('');
    setLastFailedPrompt(null);

    // Prepare assistant placeholder message
    const assistantMsgId = `asst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'planning',
      tags: ['Gemini Engine', geminiModel || 'gemini-2.5-flash']
    };
    addChatMessage(initialAssistantMsg);

    setIsGenerating(true);
    setBuildStep('planning');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let accumulatedText = '';

    try {
      // Stream call to /api/generate
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-key': storedKey,
        },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          files: projectFiles,
          model: geminiModel || 'gemini-2.5-flash',
          errorContext
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const status = response.status;
        const isRateLimit = status === 429 || errorData.code === 'RATE_LIMIT';
        const isInvalidKey = status === 401 || errorData.code === 'INVALID_KEY';

        let errText = errorData.error || 'Failed to generate game code with Gemini';
        if (isRateLimit) {
          errText = 'Gemini API rate limit reached (429). Please wait a few moments or switch to a different model in Settings, then click Retry.';
        } else if (isInvalidKey) {
          errText = 'Invalid Gemini API key. Please check and re-validate your API key in Settings.';
        }

        // Update assistant message to error state
        useAppStore.setState((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: errText,
                  status: 'error',
                  errorType: isRateLimit ? 'rate_limit' : isInvalidKey ? 'invalid_key' : 'generic'
                }
              : m
          )
        }));

        setLastFailedPrompt(promptText);
        setIsGenerating(false);
        setBuildStep('idle');
        return;
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No readable response stream available');
      }

      setBuildStep('writing');

      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) {
          done = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'chunk' && data.text) {
              accumulatedText += data.text;
              // Update live content in store
              useAppStore.setState((state) => ({
                chatMessages: state.chatMessages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: accumulatedText, status: 'writing' }
                    : m
                )
              }));
            } else if (data.type === 'error') {
              const isRateLimit = data.status === 429 || data.code === 'RATE_LIMIT';
              const isInvalidKey = data.status === 401 || data.code === 'INVALID_KEY';

              useAppStore.setState((state) => ({
                chatMessages: state.chatMessages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: data.error || 'Generation error',
                        status: 'error',
                        errorType: isRateLimit ? 'rate_limit' : isInvalidKey ? 'invalid_key' : 'generic'
                      }
                    : m
                )
              }));
              setIsGenerating(false);
              setBuildStep('idle');
              return;
            } else if (data.type === 'done') {
              done = true;
            }
          } catch {}
        }
      }

      // Step 3: Applying code changes
      setBuildStep('applying');

      // Parse code blocks from accumulatedText
      const parsed = parseAiResponse(accumulatedText);

      if (parsed.hasFiles && parsed.files['index.html']) {
        await onApplyFiles(parsed.files);

        // Update assistant message with parsed status and clean display
        useAppStore.setState((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: parsed.explanation,
                  status: 'done',
                  appliedFiles: Object.keys(parsed.files)
                }
              : m
          )
        }));

        showToast('Game updated and reloaded!', 'success');

        // On mobile, auto-switch to Preview tab so user sees the game immediately!
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          setMobileTab('preview');
        }
        if (onBuildFinished) {
          onBuildFinished();
        }
      } else {
        // No code block parsed; show the full explanation
        useAppStore.setState((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === assistantMsgId ? { ...m, status: 'done' } : m
          )
        }));
      }

      // Persist chat history to project document
      const currentAllMessages = useAppStore.getState().chatMessages;
      updateProjectChat(projectId, currentAllMessages).catch((e) =>
        console.warn('Failed to persist chat messages:', e)
      );

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Stopped by user
        useAppStore.setState((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: accumulatedText ? accumulatedText + '\n\n*(Generation stopped by user)*' : 'Generation stopped.',
                  status: 'done'
                }
              : m
          )
        }));
      } else {
        const errMsg = err?.message || 'Error communicating with generation engine';
        useAppStore.setState((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: errMsg,
                  status: 'error',
                  errorType: 'generic'
                }
              : m
          )
        }));
        setLastFailedPrompt(promptText);
        showToast('Generation failed', 'error');
      }
    } finally {
      setIsGenerating(false);
      setBuildStep('idle');
      abortControllerRef.current = null;
    }
  }, [
    input, 
    isGenerating, 
    addChatMessage, 
    geminiModel, 
    chatMessages, 
    projectFiles, 
    onApplyFiles, 
    showToast, 
    setMobileTab, 
    onBuildFinished, 
    projectId
  ]);

  // Handle external prompt trigger (e.g. from "Fix with AI" in Preview error banner)
  useEffect(() => {
    if (
      externalPromptTrigger &&
      externalPromptTrigger.timestamp > lastHandledTriggerRef.current
    ) {
      lastHandledTriggerRef.current = externalPromptTrigger.timestamp;
      handleSendMessage(externalPromptTrigger.prompt, externalPromptTrigger.errorContext);
    }
  }, [externalPromptTrigger, handleSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFillPrompt = (promptText: string) => {
    setInput(promptText);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80 text-slate-100 select-none overflow-hidden">
      {/* Chat Top Bar */}
      <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm px-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-slate-200">Levelo Assistant</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-indigo-400/90 bg-indigo-950/60 border border-indigo-800/50 px-2 py-0.5 rounded">
            {geminiModel || 'gemini-2.5-flash'}
          </span>
          {chatMessages.length > 1 && !isGenerating && (
            <button
              onClick={() => {
                if (window.confirm('Clear chat history for this project?')) {
                  clearChat();
                  updateProjectChat(projectId, []).catch(console.error);
                }
              }}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Clear chat history"
              aria-label="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Building Status Progression Indicator */}
      {isGenerating && (
        <div className="bg-indigo-950/60 border-b border-indigo-500/30 px-3.5 py-2 text-xs flex items-center justify-between z-10 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <span className="text-indigo-200">Building:</span>
              <span className={buildStep === 'planning' ? 'text-indigo-400 font-bold' : 'text-slate-400'}>
                1. Planning
              </span>
              <span className="text-slate-600">→</span>
              <span className={buildStep === 'writing' ? 'text-indigo-400 font-bold' : 'text-slate-400'}>
                2. Writing code
              </span>
              <span className="text-slate-600">→</span>
              <span className={buildStep === 'applying' ? 'text-indigo-400 font-bold' : 'text-slate-400'}>
                3. Applying
              </span>
            </div>
          </div>

          <button
            onClick={handleStop}
            className="px-2 py-0.5 rounded bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-4 text-xs">
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role !== 'user' && (
              <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-xl p-3 border leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white border-indigo-500 rounded-br-none shadow-md'
                  : msg.status === 'error'
                  ? 'bg-rose-950/40 text-rose-200 border-rose-500/40 rounded-bl-none shadow-sm'
                  : 'bg-slate-900/90 text-slate-200 border-slate-800/90 rounded-bl-none shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Applied files pill */}
              {msg.appliedFiles && msg.appliedFiles.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Applied changes to {msg.appliedFiles.join(', ')}</span>
                </div>
              )}

              {/* Action helpers for errors */}
              {msg.status === 'error' && (
                <div className="mt-3 pt-2.5 border-t border-rose-500/30 flex items-center gap-2">
                  {msg.errorType === 'missing_key' || msg.errorType === 'invalid_key' ? (
                    <Link
                      href="/settings"
                      className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Key className="w-3 h-3" />
                      <span>Open Settings</span>
                    </Link>
                  ) : null}

                  {lastFailedPrompt && (
                    <button
                      onClick={() => handleSendMessage(lastFailedPrompt)}
                      className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] inline-flex items-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              )}

              {msg.tags && msg.tags.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                  {msg.tags.map((t, idx) => (
                    <span key={idx}>
                      {idx > 0 && <span className="mr-1.5 text-slate-600">·</span>}
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* "Prompt Ideas" Row of Chips */}
      <div className="px-3 pt-2 pb-1 border-t border-slate-800/60 bg-slate-900/40">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Prompt Ideas</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          {PROMPT_IDEAS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleFillPrompt(item.prompt)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 whitespace-nowrap flex items-center gap-1 transition-colors hover:text-indigo-300 hover:border-indigo-500/40 cursor-pointer"
              title="Click to fill input"
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Form with Stop / Send Controls */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/50">
        <div className="relative rounded-xl border border-slate-800 bg-slate-950 focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/40 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            placeholder={
              isGenerating
                ? 'Levelo is building your game...'
                : 'Describe what to build or change (e.g., "Add double jump and coin sound effects")...'
            }
            rows={2}
            className="w-full bg-transparent p-2.5 pr-10 text-xs text-slate-100 placeholder-slate-500 resize-none focus:outline-none disabled:opacity-50"
          />

          {isGenerating ? (
            <button
              onClick={handleStop}
              className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              title="Stop Generation"
              aria-label="Stop generation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim()}
              className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white transition-colors cursor-pointer"
              title="Send prompt"
              aria-label="Send prompt"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 text-center">
          Press Enter to send · Generates complete working Phaser 3 games
        </p>
      </div>
    </div>
  );
}
