'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Volume2, 
  Play, 
  Save, 
  Sparkles, 
  RotateCcw, 
  Sliders, 
  Loader2, 
  Check, 
  Music 
} from 'lucide-react';
import { 
  playSfx, 
  renderSfxToWavDataUrl, 
  SFX_PRESETS, 
  type SfxParams 
} from '@/lib/sfx-synth';
import { formatBytes, sanitizeAssetFileName } from '@/lib/asset-utils';
import type { ProjectAsset } from '@/lib/types';

interface SfxMakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsset: (asset: Omit<ProjectAsset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function SfxMakerModal({ isOpen, onClose, onSaveAsset }: SfxMakerModalProps) {
  const [params, setParams] = useState<SfxParams>(SFX_PRESETS.jump.params);
  const [activePreset, setActivePreset] = useState<string>('jump');
  const [assetName, setAssetName] = useState('sfx_jump.wav');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Update canvas oscilloscope animation when playing
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw synth waveform preview
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#6366f1';
    ctx.beginPath();

    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    for (let x = 0; x < w; x++) {
      const t = x / w;
      let y = mid;
      const freq = params.startFreq + (params.endFreq - params.startFreq) * t;
      const amp = (params.volume * (1 - t * 0.5)) * (mid - 8);

      if (params.waveform === 'sine') {
        y = mid + Math.sin(t * freq * 0.05) * amp;
      } else if (params.waveform === 'square') {
        y = mid + (Math.sin(t * freq * 0.05) > 0 ? 1 : -1) * amp;
      } else if (params.waveform === 'sawtooth') {
        y = mid + (((t * freq * 0.05) % 1) * 2 - 1) * amp;
      } else if (params.waveform === 'triangle') {
        y = mid + (Math.abs(((t * freq * 0.05) % 1) * 2 - 1) * 2 - 1) * amp;
      } else {
        // Noise
        y = mid + (Math.random() * 2 - 1) * amp;
      }

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [params]);

  if (!isOpen) return null;

  const handleSelectPreset = (key: string) => {
    setActivePreset(key);
    const preset = SFX_PRESETS[key];
    if (preset) {
      setParams({ ...preset.params });
      setAssetName(`sfx_${key}.wav`);
      playSfx(preset.params);
    }
  };

  const handleTestPlay = () => {
    setIsPlaying(true);
    playSfx(params);
    setTimeout(() => setIsPlaying(false), (params.attack + params.decay + params.release + params.slideTime) * 1000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const rendered = await renderSfxToWavDataUrl(params);
      const cleanName = sanitizeAssetFileName(assetName || `sfx_${activePreset}`, 'wav');
      
      await onSaveAsset({
        projectId: '',
        name: cleanName,
        path: `assets/${cleanName}`,
        type: 'audio',
        mimeType: 'audio/wav',
        size: rendered.size,
        data: rendered.dataUrl,
        duration: rendered.duration,
      });

      setLastSaved(true);
      setTimeout(() => {
        setLastSaved(false);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to save SFX asset:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">SFX Maker</h2>
              <p className="text-xs text-slate-400">Synthesize arcade audio effects & render clean WAV assets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Presets Chips */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-2 block flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Sound Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(SFX_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleSelectPreset(key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left ${
                    activePreset === key
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="text-base">{preset.icon}</span>
                  <span className="truncate">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Waveform Visualizer & Test Play Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                Waveform Preview
              </span>
              <button
                onClick={handleTestPlay}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Test Play</span>
              </button>
            </div>
            <div className="h-16 w-full rounded-lg overflow-hidden border border-slate-800/80 bg-slate-950 relative">
              <canvas ref={canvasRef} width={500} height={64} className="w-full h-full block" />
            </div>
          </div>

          {/* Parametric Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Synthesizer Parameters
              </span>
              <button
                onClick={() => handleSelectPreset(activePreset)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                title="Reset to preset defaults"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* Waveform Type */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Waveform Oscillator</label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['square', 'sawtooth', 'triangle', 'sine', 'noise'] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      setParams({ ...params, waveform: w });
                      playSfx({ ...params, waveform: w });
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-xs capitalize text-center transition-colors ${
                      params.waveform === w
                        ? 'bg-indigo-600 border-indigo-500 text-white font-medium'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency Sweep Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Start Frequency</span>
                  <span className="font-mono text-indigo-400">{Math.round(params.startFreq)} Hz</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="2500"
                  step="10"
                  value={params.startFreq}
                  onChange={(e) => setParams({ ...params, startFreq: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>End Frequency</span>
                  <span className="font-mono text-indigo-400">{Math.round(params.endFreq)} Hz</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="2500"
                  step="10"
                  value={params.endFreq}
                  onChange={(e) => setParams({ ...params, endFreq: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Envelope Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Attack</span>
                  <span className="font-mono text-slate-300">{(params.attack * 1000).toFixed(0)} ms</span>
                </div>
                <input
                  type="range"
                  min="0.001"
                  max="0.2"
                  step="0.005"
                  value={params.attack}
                  onChange={(e) => setParams({ ...params, attack: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Decay / Slide</span>
                  <span className="font-mono text-slate-300">{(params.slideTime * 1000).toFixed(0)} ms</span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="1.0"
                  step="0.02"
                  value={params.slideTime}
                  onChange={(e) => setParams({ ...params, slideTime: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Release</span>
                  <span className="font-mono text-slate-300">{(params.release * 1000).toFixed(0)} ms</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.8"
                  step="0.02"
                  value={params.release}
                  onChange={(e) => setParams({ ...params, release: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Vibrato & Bitcrush */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Vibrato Depth</span>
                  <span className="font-mono text-slate-300">{params.vibratoDepth}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={params.vibratoDepth}
                  onChange={(e) => setParams({ ...params, vibratoDepth: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Master Volume</span>
                  <span className="font-mono text-slate-300">{Math.round(params.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={params.volume}
                  onChange={(e) => setParams({ ...params, volume: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Filename & Save Asset Action */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Save as:</span>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="sfx_jump.wav"
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono w-44"
            />
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || lastSaved}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Encoding WAV...</span>
                </>
              ) : lastSaved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save as Asset</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
