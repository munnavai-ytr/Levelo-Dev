'use client';

import { useState } from 'react';
import { 
  Sparkles, 
  Gamepad2, 
  X, 
  Layers, 
  ArrowRight, 
  Check, 
  Wand2, 
  Tag, 
  Play
} from 'lucide-react';
import { TEMPLATES, bundleGameFiles } from '@/lib/templates';
import type { GameTemplate } from '@/lib/types';
import { DEFAULT_PHASER_STARTER } from '@/lib/starter-game';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    title: string, 
    customFiles?: Record<string, string>, 
    initialPrompt?: string
  ) => Promise<void>;
}

export function NewProjectModal({ isOpen, onClose, onCreate }: NewProjectModalProps) {
  const [mode, setMode] = useState<'prompt' | 'template'>('prompt');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<GameTemplate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      if (mode === 'template' && selectedTemplate) {
        await onCreate(title.trim(), selectedTemplate.files);
      } else {
        await onCreate(title.trim(), { 'index.html': DEFAULT_PHASER_STARTER }, prompt.trim() || undefined);
      }
      setTitle('');
      setPrompt('');
      setSelectedTemplate(null);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTemplate = (tmpl: GameTemplate) => {
    setSelectedTemplate(tmpl);
    if (!title.trim() || title === 'My New Game') {
      setTitle(tmpl.name);
    }
  };

  const PROMPT_SUGGESTIONS = [
    'Vertical space shooter with incoming alien waves and laser cannons',
    'Cyberpunk neon runner with jumping obstacles and double jump',
    'Retro brick breaker with bouncing ball and multi-color powerups',
    'Classic asteroids arcade game with inertia physics and floating rocks'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative text-slate-100 animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Create New Game</h3>
              <p className="text-xs text-slate-400">Launch an interactive game with AI or start from templates</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle: Start from AI Prompt vs Start from Template */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMode('prompt')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              mode === 'prompt'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Start from AI Prompt</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('template')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              mode === 'template'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Start from Template ({TEMPLATES.length})</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Project Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Neon Jumper, Pixel Defender, Cyber Maze"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {mode === 'prompt' ? (
            /* Mode 1: AI Prompt */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Describe the game you want to build (Optional)</span>
                  <span className="text-[10px] text-indigo-400 flex items-center gap-1 font-mono">
                    <Sparkles className="w-3 h-3" />
                    AI Engine
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe mechanics, theme, obstacles, and controls. The AI will immediately start building your vision..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Or pick a starter idea:
                </span>
                <div className="flex flex-col gap-1.5">
                  {PROMPT_SUGGESTIONS.map((idea, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setPrompt(idea)}
                      className="text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-indigo-300 transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{idea}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Real Templates Grid with Live Mini Preview */
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Select a Template ({TEMPLATES.length} fully playable games)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplate?.id === tmpl.id;
                  const bundledCode = bundleGameFiles(tmpl.files);

                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`rounded-xl border p-3 cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500/50 shadow-md'
                          : 'border-slate-800 bg-slate-950/60 hover:bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      {/* Live Mini Preview Iframe - only runs when selected */}
                      <div className="relative w-full h-32 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 mb-2.5 flex items-center justify-center">
                        {isSelected ? (
                          <iframe
                            title={tmpl.name}
                            srcDoc={bundledCode}
                            sandbox="allow-scripts"
                            className="w-full h-full pointer-events-none border-0 scale-90 origin-top"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 text-slate-500">
                            <Gamepad2 className="w-5 h-5 text-slate-600" />
                            <span className="text-[10px] text-slate-500 font-mono">Click to preview</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] text-indigo-300 font-mono">
                          {tmpl.genre}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            {tmpl.name}
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                <Check className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-500">
                            {Object.keys(tmpl.files).length} files
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                          {tmpl.description}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {tmpl.tags.map((t, tidx) => (
                            <span
                              key={tidx}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || (mode === 'template' && !selectedTemplate)}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : mode === 'template' ? 'Launch Template' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
