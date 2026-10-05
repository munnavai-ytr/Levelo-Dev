'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/components/Toast';
import { parseAiResponse } from '@/lib/parse-ai-response';
import { updateProjectChat, createProjectVersion } from '@/lib/firebase';
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
  ChevronDown,
  ChevronRight,
  Code2,
  FileCode
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

interface ChatMessageItemProps {
  msg: ChatMessage;
  lastFailedPrompt: string | null;
  onRetry: (prompt: string) => void;
}

// Memoized Chat Message Component for high render performance
export const ChatMessageItem = React.memo(function ChatMessageItem({
  msg,
  lastFailedPrompt,
  onRetry
}: ChatMessageItemProps) {
  const [showCode, setShowCode] = useState(false);

  // During streaming, inspect if code is being written
  const isStreamingWriting = msg.status === 'writing';

  const { displayText, isWritingCode, targetFilename, codeLines, extractedCode } = useMemo(() => {
    const raw = msg.content;
    const codeBlockRegex = /```(?:html|javascript|css)?\s*([^\n]*)\n([\s\S]*)/;
    const match = raw.match(codeBlockRegex);

    if (match) {
      const textBefore = raw.substring(0, match.index).trim();
      const filenameMatch = match[1]?.trim() || 'index.html';
      const codePart = match[2];
      const lines = codePart.split('\n').length;
      return {
        displayText: textBefore,
        isWritingCode: true,
        targetFilename: filenameMatch.includes('.') ? filenameMatch : 'index.html',
        codeLines: lines,
        extractedCode: codePart.replace(/```$/, '').trim()
      };
    }

    return {
      displayText: raw,
      isWritingCode: false,
      targetFilename: 'index.html',
      codeLines: 0,
      extractedCode: ''
    };
  }, [msg.content]);

  return (
    <div className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
        {/* Text explanation */}
        {displayText && (
          <div className="whitespace-pre-wrap">{displayText}</div>
        )}

        {/* While streaming: do NOT render code; show progress shimmer */}
        {isStreamingWriting && isWritingCode && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950 border border-indigo-500/40 space-y-2">
            <div className="flex items-center justify-between text-indigo-300 font-mono text-[11px]">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>Writing {targetFilename}...</span>
              </div>
              <span className="text-slate-400">{codeLines} lines</span>
            </div>
            {/* Shimmer bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-[shimmer_1.5s_infinite] w-full" />
            </div>
          </div>
        )}

        {/* After completion: collapsible code view */}
        {msg.status === 'done' && isWritingCode && extractedCode && (
          <div className="mt-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => setShowCode(!showCode)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {showCode ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <Code2 className="w-3.5 h-3.5" />
              <span>{showCode ? 'Hide generated code' : `View generated code (${codeLines} lines)`}</span>
            </button>
            {showCode && (
              <pre className="mt-2 p-2 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-48 scrollbar-thin">
                {extractedCode}
              </pre>
            )}
          </div>
        )}

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
                onClick={() => onRetry(lastFailedPrompt)}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] inline-flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
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
  );
});

interface ChatPanelProps {
  projectId: string;
  projectFiles: Record<string, string>;
  onApplyFiles: (newFiles: Record<string, string>) => Promise<void>;
  onBuildFinished?: () => void;
  onVersionCreated?: () => void;
  externalPromptTrigger?: { prompt: string; timestamp: number; errorContext?: any } | null;
}

export function ChatPanel({
  projectId,
  projectFiles,
  onApplyFiles,
  onBuildFinished,
  onVersionCreated,
  externalPromptTrigger
}: ChatPanelProps) {
  const { chatMessages, addChatMessage, clearChat, geminiModel, setMobileTab } = useAppStore();
  const { showToast } = useToast();

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [buildStep, setBuildStep] = useState<'idle' | 'planning' | 'writing' | 'applying'>('idle');
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastHandledTriggerRef = useRef<number>(0);

  // Performance-optimized scrolling:
  // Instant scroll if streaming and near bottom; smooth scroll if not streaming
  const handleAutoScroll = useCallback((instant = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (isNearBottom || !instant) {
      if (instant) {
        el.scrollTop = el.scrollHeight; // Instant scroll
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
  }, []);

  useEffect(() => {
    handleAutoScroll(isGenerating);
  }, [chatMessages, isGenerating, buildStep, handleAutoScroll]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setBuildStep('idle');
      showToast('Generation stopped by user', 'info');
    }
  };

  const handleSendMessage = useCallback(
    async (textOverride?: string, errorContextOverride?: any) => {
      const promptText = (textOverride || input).trim();
      if (!promptText || isGenerating) return;

      if (!textOverride) {
        setInput('');
      }

      runStorageMigration();
      const apiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || '';

      const userMessage = createMessageItem('user', promptText);
      addChatMessage(userMessage);

      // Pre-build snapshot
      createProjectVersion(
        projectId,
        projectFiles,
        `Before: ${promptText.substring(0, 24)}${promptText.length > 24 ? '...' : ''}`,
        'ai',
        promptText
      ).then(() => onVersionCreated?.()).catch(console.warn);

      const assistantMsgId = `asst_${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'planning',
        tags: [geminiModel || 'gemini-2.5-flash']
      };
      addChatMessage(assistantMessage);

      setIsGenerating(true);
      setBuildStep('planning');
      setLastFailedPrompt(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const conversationHistory = [...chatMessages, userMessage].map((m) => ({
          role: m.role,
          content: m.content
        }));

        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'x-gemini-key': apiKey } : {})
          },
          body: JSON.stringify({
            messages: conversationHistory,
            files: projectFiles,
            model: geminiModel || 'gemini-2.5-flash',
            errorContext: errorContextOverride || undefined
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error || `Server responded with status ${response.status}`;
          const isInvalidKey = response.status === 401 || errData.code === 'API_KEY_MISSING' || errData.code === 'INVALID_KEY';
          const isRateLimit = response.status === 429 || errData.code === 'RATE_LIMIT';

          useAppStore.setState((state) => ({
            chatMessages: state.chatMessages.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: isInvalidKey
                      ? 'Gemini API Key missing or invalid. Please configure your key in Settings.'
                      : isRateLimit
                      ? 'Gemini API quota exceeded. Please wait a moment and try again.'
                      : errMsg,
                    status: 'error',
                    errorType: isInvalidKey ? 'missing_key' : isRateLimit ? 'rate_limit' : 'generic'
                  }
                : m
            )
          }));
          setLastFailedPrompt(promptText);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Unable to read streaming response from server');
        }

        setBuildStep('writing');

        const decoder = new TextDecoder();
        let accumulatedText = '';
        let buffer = '';
        let done = false;

        // 80ms throttle buffer for store updates (Item 12)
        let lastFlushTime = performance.now();
        let throttleTimer: NodeJS.Timeout | null = null;

        const flushStoreUpdate = (immediate = false) => {
          const now = performance.now();
          if (immediate || now - lastFlushTime >= 80) {
            lastFlushTime = now;
            if (throttleTimer) {
              clearTimeout(throttleTimer);
              throttleTimer = null;
            }
            useAppStore.setState((state) => ({
              chatMessages: state.chatMessages.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: accumulatedText, status: 'writing' }
                  : m
              )
            }));
            handleAutoScroll(true); // Instant scroll during streaming
          } else if (!throttleTimer) {
            throttleTimer = setTimeout(() => {
              flushStoreUpdate(true);
            }, 80);
          }
        };

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
                flushStoreUpdate();
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

        // Final store update flush
        if (throttleTimer) clearTimeout(throttleTimer);
        flushStoreUpdate(true);

        // Step 3: Applying code changes
        setBuildStep('applying');

        const parsed = parseAiResponse(accumulatedText);

        if (parsed.hasFiles && parsed.files['index.html']) {
          await onApplyFiles(parsed.files);

          // Post-build snapshot
          createProjectVersion(
            projectId,
            parsed.files,
            `AI: ${promptText.substring(0, 32)}${promptText.length > 32 ? '...' : ''}`,
            'ai',
            promptText
          ).then(() => onVersionCreated?.()).catch(console.warn);

          useAppStore.setState((state) => ({
            chatMessages: state.chatMessages.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: accumulatedText,
                    status: 'done',
                    appliedFiles: Object.keys(parsed.files)
                  }
                : m
            )
          }));

          showToast('Game updated and reloaded!', 'success');

          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setMobileTab('preview');
          }
          if (onBuildFinished) {
            onBuildFinished();
          }
        } else {
          useAppStore.setState((state) => ({
            chatMessages: state.chatMessages.map((m) =>
              m.id === assistantMsgId ? { ...m, status: 'done' } : m
            )
          }));
        }

        // Persist chat messages
        const currentAllMessages = useAppStore.getState().chatMessages;
        updateProjectChat(projectId, currentAllMessages).catch(console.warn);

      } catch (err: any) {
        if (err.name === 'AbortError') {
          useAppStore.setState((state) => ({
            chatMessages: state.chatMessages.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: m.content ? m.content + '\n\n*(Generation stopped by user)*' : 'Generation stopped.',
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
    },
    [
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
      onVersionCreated,
      projectId,
      handleAutoScroll
    ]
  );

  // Handle external prompt trigger (e.g. from "Fix with AI")
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

  const handleFillPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80 select-none overflow-hidden">
      {/* Chat Header */}
      <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-200">Levelo AI Assistant</span>
          <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950/60 border border-indigo-800/60 text-indigo-300">
            {geminiModel || 'gemini-2.5-flash'}
          </span>
        </div>

        <button
          onClick={clearChat}
          className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-300 hover:bg-slate-900 transition-colors"
          title="Clear chat history"
          aria-label="Clear chat history"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Building Progress Status Banner */}
      {isGenerating && (
        <div className="bg-indigo-950/40 border-b border-indigo-500/30 px-3 py-2 flex items-center justify-between text-xs text-indigo-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span className="font-medium capitalize">
              {buildStep === 'planning' && 'Thinking and designing game loop...'}
              {buildStep === 'writing' && 'Streaming game code...'}
              {buildStep === 'applying' && 'Applying changes to live sandbox...'}
            </span>
          </div>

          <button
            onClick={handleStop}
            className="px-2 py-0.5 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 p-3.5 overflow-y-auto space-y-4 text-xs scrollbar-thin"
      >
        {chatMessages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            msg={msg}
            lastFailedPrompt={lastFailedPrompt}
            onRetry={handleSendMessage}
          />
        ))}
      </div>

      {/* Prompt Ideas */}
      <div className="px-3 pt-2 pb-1 border-t border-slate-800/60 bg-slate-900/40 shrink-0">
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
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input Bar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-sm shrink-0">
        <div className="relative flex items-end bg-slate-950/80 rounded-xl border border-slate-800 focus-within:border-indigo-500/60 transition-colors p-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isGenerating ? 'Levelo is building your game...' : 'Describe a game mechanic, boss fight, or new game...'}
            disabled={isGenerating}
            rows={1}
            className="flex-1 bg-transparent resize-none border-0 text-slate-100 text-xs px-2.5 py-1.5 focus:outline-none placeholder:text-slate-500 max-h-24 scrollbar-none"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isGenerating}
            className={`p-2 rounded-lg transition-all ${
              input.trim() && !isGenerating
                ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-500 cursor-pointer'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Send prompt (Enter)"
            aria-label="Send prompt"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-slate-500 font-mono">
          <span>Press Enter to send, Shift+Enter for newline</span>
          <Link href="/settings" className="hover:text-indigo-400 transition-colors">
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
