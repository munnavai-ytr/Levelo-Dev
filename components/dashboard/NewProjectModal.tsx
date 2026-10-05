'use client';

import { useState } from 'react';
import { Sparkles, Gamepad2, X, Rocket, Zap, Crosshair } from 'lucide-react';
import { DEFAULT_PHASER_STARTER } from '@/lib/starter-game';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, customHtml?: string) => Promise<void>;
}

export function NewProjectModal({ isOpen, onClose, onCreate }: NewProjectModalProps) {
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<'platformer' | 'asteroids'>('platformer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreate(title.trim(), DEFAULT_PHASER_STARTER);
      setTitle('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-slate-100 animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Create New Game</h3>
            <p className="text-xs text-slate-400">Initialize a live Phaser 3 interactive project</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Game Title
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Cosmic Voyager, Pixel Runner, Cyber Jumper"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Starter Engine & Preset
            </label>
            <div className="grid grid-cols-1 gap-2">
              <div 
                className="p-3 rounded-xl border border-indigo-500/50 bg-indigo-950/20 flex items-start gap-3 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Rocket className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                    Cosmic Jumper (Phaser 3)
                    <span className="text-[10px] font-mono bg-indigo-600/40 text-indigo-300 px-1.5 py-0.2 rounded">Recommended</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Full playable platformer with physics, keyboard + mobile touch controls, star collection, and particle fx.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
