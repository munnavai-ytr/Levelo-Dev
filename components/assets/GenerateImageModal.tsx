'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Wand2, 
  Layers, 
  Scissors, 
  Loader2, 
  RotateCw, 
  Save, 
  Check, 
  AlertCircle,
  Eye
} from 'lucide-react';
import { removeImageBackground } from '@/lib/chroma-key';
import { processAndCompressImage, sanitizeAssetFileName, formatBytes } from '@/lib/asset-utils';
import { useAppStore } from '@/lib/store';
import type { AssetType, AssetStyle, ProjectAsset } from '@/lib/types';

interface GenerateImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsset: (asset: Omit<ProjectAsset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function GenerateImageModal({ isOpen, onClose, onSaveAsset }: GenerateImageModalProps) {
  const { geminiApiKey, geminiModel } = useAppStore();

  const [prompt, setPrompt] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('sprite');
  const [style, setStyle] = useState<AssetStyle>('pixel_art');
  const [size, setSize] = useState<'256x256' | '512x512' | '1024x1024'>('512x512');
  const [assetName, setAssetName] = useState('hero_sprite.webp');

  // Transparency / Chroma-Key State
  const [makeTransparent, setMakeTransparent] = useState(true);
  const [chromaTolerance, setChromaTolerance] = useState(35);
  const [chromaColor, setChromaColor] = useState<'green' | 'magenta' | 'corner' | 'white'>('green');

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [rawGeneratedImage, setRawGeneratedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Auto-suggest filename based on prompt and type
  useEffect(() => {
    if (prompt) {
      const sanitized = prompt.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 18);
      const prefix = assetType === 'sprite' ? 'sprite_' : assetType === 'background' ? 'bg_' : assetType === 'tileset' ? 'tile_' : 'icon_';
      setAssetName(`${prefix}${sanitized}.webp`);
    }
  }, [prompt, assetType]);

  // Turn transparent mode on by default for sprites/icons, off for backgrounds
  useEffect(() => {
    if (assetType === 'background' || assetType === 'tileset') {
      setMakeTransparent(false);
    } else {
      setMakeTransparent(true);
    }
  }, [assetType]);

  // Re-process chroma-key transparency when tolerance or image changes
  useEffect(() => {
    if (!rawGeneratedImage) {
      setPreviewImage(null);
      return;
    }

    if (!makeTransparent) {
      setPreviewImage(rawGeneratedImage);
      return;
    }

    let active = true;
    const applyChroma = async () => {
      try {
        let targetColor = { r: 0, g: 255, b: 0 };
        let autoCorner = false;

        if (chromaColor === 'magenta') targetColor = { r: 255, g: 0, b: 255 };
        else if (chromaColor === 'white') targetColor = { r: 255, g: 255, b: 255 };
        else if (chromaColor === 'corner') autoCorner = true;

        const result = await removeImageBackground(rawGeneratedImage, {
          targetColor,
          tolerance: chromaTolerance,
          smoothness: 8,
          autoSampleCorner: autoCorner,
        });

        if (active) {
          setPreviewImage(result.dataUrl);
        }
      } catch (err) {
        console.warn('Chroma key error:', err);
        if (active) setPreviewImage(rawGeneratedImage);
      }
    };

    applyChroma();
    return () => {
      active = false;
    };
  }, [rawGeneratedImage, makeTransparent, chromaTolerance, chromaColor]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate an image.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setIsRateLimited(false);

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-key': geminiApiKey || '',
        },
        body: JSON.stringify({
          prompt,
          type: assetType,
          style,
          size,
          model: geminiModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 || data.code === 'RATE_LIMIT') {
          setIsRateLimited(true);
          throw new Error('Image generation quota exceeded. Please wait a few seconds and click Retry.');
        }
        throw new Error(data.error || 'Failed to generate image');
      }

      setRawGeneratedImage(data.image);
    } catch (err: any) {
      setError(err.message || 'Image generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToProject = async () => {
    if (!previewImage) return;

    setIsSaving(true);
    try {
      const processed = await processAndCompressImage(previewImage, assetName);
      const cleanName = sanitizeAssetFileName(assetName || 'game_asset.webp', 'webp');

      await onSaveAsset({
        projectId: '',
        name: cleanName,
        path: `assets/${cleanName}`,
        type: assetType,
        mimeType: processed.mimeType,
        size: processed.size,
        data: processed.dataUrl,
        thumbnail: processed.thumbnail,
        width: processed.width,
        height: processed.height,
      });

      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to compress and save asset.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">AI Image Asset Generator</h2>
              <p className="text-xs text-slate-400">Generate game sprites, backgrounds, tilesets & icons with Gemini</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split into Left Form & Right Live Preview */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-5 p-5 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Left Column: Generator Inputs */}
          <div className="space-y-4">
            {/* Prompt Input */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Asset Description Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Cyberpunk samurai robot hero with glowing blue katana"
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-slate-100 focus:outline-none resize-none placeholder:text-slate-600"
              />

              {/* Quick Prompt Ideas */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[
                  'Knight with shield',
                  'Space fighter jet',
                  'Gold treasure chest',
                  'Alien creature',
                  'Lava castle backdrop',
                  'Pixel dungeon tileset',
                ].map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setPrompt(idea)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    + {idea}
                  </button>
                ))}
              </div>
            </div>

            {/* Asset Type Tabs */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Asset Type</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'sprite', label: 'Sprite' },
                    { id: 'background', label: 'Backdrop' },
                    { id: 'tileset', label: 'Tileset' },
                    { id: 'ui_icon', label: 'UI Icon' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAssetType(t.id)}
                    className={`py-1.5 px-2 rounded-xl border text-xs font-medium transition-colors ${
                      assetType === t.id
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Art Style Chips */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Art Style</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'pixel_art', label: 'Pixel Art (16-bit)' },
                    { id: 'cartoon', label: 'Cartoon Vector' },
                    { id: 'flat_vector', label: 'Flat Modern' },
                    { id: 'realistic', label: 'Semi-Realistic' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    className={`py-1.5 px-2 rounded-xl border text-xs text-left transition-colors ${
                      style === s.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-medium'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Selector */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Dimensions</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['256x256', '512x512', '1024x1024'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSize(sz)}
                    className={`py-1 rounded-xl border text-xs font-mono transition-colors ${
                      size === sz
                        ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Transparency & Chroma-Key Extraction Controls */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-indigo-400" />
                  Make Background Transparent
                </span>
                <input
                  type="checkbox"
                  checked={makeTransparent}
                  onChange={(e) => setMakeTransparent(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
              </div>

              {makeTransparent && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Key Color</span>
                    <div className="flex gap-1.5">
                      {[
                        { id: 'green', bg: '#00FF00', title: 'Green Screen' },
                        { id: 'corner', bg: '#6366f1', title: 'Auto Corner' },
                        { id: 'magenta', bg: '#FF00FF', title: 'Magenta' },
                        { id: 'white', bg: '#FFFFFF', title: 'White' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setChromaColor(c.id as any)}
                          className={`w-5 h-5 rounded-full border transition-all ${
                            chromaColor === c.id ? 'ring-2 ring-indigo-400 scale-110' : 'border-slate-700'
                          }`}
                          style={{ backgroundColor: c.bg }}
                          title={c.title}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Cutout Tolerance</span>
                      <span className="font-mono text-indigo-400">{chromaTolerance}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="75"
                      value={chromaTolerance}
                      onChange={(e) => setChromaTolerance(Number(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Generate Action Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 active:scale-[0.99] cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Game Asset with AI...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Generate Asset</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Live Checkerboard Preview */}
          <div className="flex flex-col h-full space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                Asset Preview
              </span>
              {rawGeneratedImage && (
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  Regenerate
                </button>
              )}
            </div>

            {/* Checkerboard Preview Canvas */}
            <div className="flex-1 min-h-[260px] rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center relative shadow-inner">
              {/* Checkerboard Pattern */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, #334155 25%, transparent 25%), 
                    linear-gradient(-45deg, #334155 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, #334155 75%), 
                    linear-gradient(-45deg, transparent 75%, #334155 75%)
                  `,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              />

              {isGenerating ? (
                <div className="flex flex-col items-center gap-3 text-slate-400 text-xs z-10">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center animate-pulse">
                    <Sparkles className="w-6 h-6 text-indigo-400 animate-spin" />
                  </div>
                  <span className="font-mono">Rendering game graphics...</span>
                </div>
              ) : previewImage ? (
                <div className="relative max-w-full max-h-[300px] flex items-center justify-center p-3 z-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewImage}
                    alt="AI Generated Game Asset"
                    className="max-h-[280px] max-w-full object-contain rounded-lg shadow-lg filter drop-shadow-md"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500 text-xs p-6 text-center z-10">
                  <Layers className="w-8 h-8 stroke-[1.5] text-slate-600" />
                  <span>Enter a prompt and click Generate to preview your asset.</span>
                </div>
              )}
            </div>

            {/* Error / Rate Limit Banner */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1">
                  <p>{error}</p>
                  {isRateLimited && (
                    <button
                      onClick={handleGenerate}
                      className="mt-2 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      Retry Generation
                    </button>
                  )}
                </div>
              </div>
            )}
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
              placeholder="hero_sprite.webp"
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono w-48"
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
              onClick={handleSaveToProject}
              disabled={isSaving || isSaved || !previewImage}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Compressing WebP...</span>
                </>
              ) : isSaved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Saved to Assets!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save to Project</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
