'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FolderPlus, 
  UploadCloud, 
  Wand2, 
  Music, 
  Trash2, 
  Download, 
  Edit2, 
  Copy, 
  Check, 
  Play, 
  Pause, 
  Volume2, 
  AlertTriangle, 
  Search, 
  Layers, 
  Loader2,
  HardDrive,
  FileCode2,
  Send,
  X
} from 'lucide-react';
import { 
  fetchProjectAssets, 
  saveProjectAsset, 
  renameProjectAsset, 
  deleteProjectAsset 
} from '@/lib/firebase';
import { 
  processAndCompressImage, 
  processAudioFile, 
  formatBytes, 
  downloadDataUrl, 
  PROJECT_TOTAL_BUDGET_BYTES, 
  BUDGET_WARNING_THRESHOLD_BYTES,
  detectAssetType,
  sanitizeAssetFileName
} from '@/lib/asset-utils';
import { GenerateImageModal } from './GenerateImageModal';
import { SfxMakerModal } from './SfxMakerModal';
import { useToast } from '@/components/Toast';
import type { ProjectAsset, AssetType } from '@/lib/types';

interface AssetsPanelProps {
  projectId: string;
  onUseInGame?: (prompt: string) => void;
}

export function AssetsPanel({ projectId, onUseInGame }: AssetsPanelProps) {
  const { showToast } = useToast();

  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | AssetType>('all');

  // Modals state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isSfxModalOpen, setIsSfxModalOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<ProjectAsset | null>(null);
  const [assetToRename, setAssetToRename] = useState<ProjectAsset | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio Playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Copied State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load project assets
  useEffect(() => {
    let active = true;
    async function load() {
      if (!projectId) return;
      try {
        setLoading(true);
        const list = await fetchProjectAssets(projectId);
        if (active) {
          setAssets(list);
        }
      } catch (err) {
        console.error('Failed to load project assets:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, [projectId]);

  // Calculate total storage budget
  const totalSizeBytes = useMemo(() => {
    return assets.reduce((acc, a) => acc + (a.size || 0), 0);
  }, [assets]);

  const storageUsageRatio = totalSizeBytes / PROJECT_TOTAL_BUDGET_BYTES;
  const isBudgetWarning = totalSizeBytes >= BUDGET_WARNING_THRESHOLD_BYTES;

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchesSearch =
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedTypeFilter === 'all' || a.type === selectedTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [assets, searchQuery, selectedTypeFilter]);

  // Save new asset handler (from modals or upload)
  const handleSaveAsset = async (assetData: Omit<ProjectAsset, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (totalSizeBytes + assetData.size > PROJECT_TOTAL_BUDGET_BYTES) {
      showToast('Cannot save asset: project storage budget (8MB) would be exceeded.', 'error');
      throw new Error('Project storage budget exceeded (8MB).');
    }

    try {
      const saved = await saveProjectAsset(projectId, assetData);
      setAssets((prev) => {
        const idx = prev.findIndex((a) => a.id === saved.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [saved, ...prev];
      });
      showToast(`Asset "${saved.name}" saved!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save asset', 'error');
      throw err;
    }
  };

  // Upload handler for files
  const handleProcessUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgressText(`Processing ${file.name} (${i + 1}/${files.length})...`);

      try {
        const detectedType = detectAssetType(file.name, file.type);

        if (detectedType === 'audio') {
          const processedAudio = await processAudioFile(file);
          const cleanName = sanitizeAssetFileName(file.name, 'wav');
          await handleSaveAsset({
            projectId,
            name: cleanName,
            path: `assets/${cleanName}`,
            type: 'audio',
            mimeType: processedAudio.mimeType,
            size: processedAudio.size,
            data: processedAudio.dataUrl,
            duration: processedAudio.duration,
          });
          successCount++;
        } else {
          const processedImg = await processAndCompressImage(file, file.name);
          const cleanName = sanitizeAssetFileName(file.name, 'webp');
          await handleSaveAsset({
            projectId,
            name: cleanName,
            path: `assets/${cleanName}`,
            type: detectedType,
            mimeType: processedImg.mimeType,
            size: processedImg.size,
            data: processedImg.dataUrl,
            thumbnail: processedImg.thumbnail,
            width: processedImg.width,
            height: processedImg.height,
          });
          successCount++;
        }
      } catch (err: any) {
        showToast(err?.message || `Failed to upload ${file.name}`, 'error');
      }
    }

    setIsUploading(false);
    setUploadProgressText(null);
    if (successCount > 0) {
      showToast(`Uploaded ${successCount} asset(s) successfully.`, 'success');
    }
  };

  // Copy Path action
  const handleCopyPath = (path: string, id: string) => {
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    showToast(`Copied "${path}" to clipboard`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Audio preview play/pause
  const handleTogglePlayAudio = (asset: ProjectAsset) => {
    if (playingAudioId === asset.id) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setPlayingAudioId(null);
    } else {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      const audio = new Audio(asset.data);
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => {
        setPlayingAudioId(null);
        showToast('Failed to play audio preview', 'error');
      };
      audio.play().catch(() => {});
      currentAudioRef.current = audio;
      setPlayingAudioId(asset.id);
    }
  };

  // Rename Confirm
  const handleConfirmRename = async () => {
    if (!assetToRename || !renameInput.trim()) return;
    const clean = sanitizeAssetFileName(renameInput.trim(), assetToRename.name.split('.').pop() || 'webp');
    const newPath = `assets/${clean}`;

    try {
      await renameProjectAsset(projectId, assetToRename.id, clean, newPath);
      setAssets((prev) =>
        prev.map((a) => (a.id === assetToRename.id ? { ...a, name: clean, path: newPath } : a))
      );
      showToast(`Renamed to "${clean}"`, 'success');
      setAssetToRename(null);
    } catch {
      showToast('Failed to rename asset', 'error');
    }
  };

  // Delete Confirm
  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;
    try {
      await deleteProjectAsset(projectId, assetToDelete.id);
      setAssets((prev) => prev.filter((a) => a.id !== assetToDelete.id));
      showToast(`Deleted "${assetToDelete.name}"`, 'info');
      setAssetToDelete(null);
    } catch {
      showToast('Failed to delete asset', 'error');
    }
  };

  // Use in Game trigger
  const handleUseInGame = (asset: ProjectAsset) => {
    const promptText =
      asset.type === 'audio'
        ? `Use the sound asset "${asset.path}" as the sound effect for game actions in the game.`
        : `Use the asset "${asset.path}" as the ${asset.type === 'sprite' ? 'player sprite / character' : asset.type === 'background' ? 'background backdrop' : 'game asset'} in the game.`;

    if (onUseInGame) {
      onUseInGame(promptText);
      showToast(`Prompt added: "Use ${asset.path} in game"`, 'info');
    } else {
      handleCopyPath(asset.path, asset.id);
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
          handleProcessUploadFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/svg+xml,audio/mp3,audio/wav,audio/ogg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleProcessUploadFiles(e.target.files);
          }
        }}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-indigo-950/80 border-2 border-dashed border-indigo-400 backdrop-blur-sm flex flex-col items-center justify-center text-indigo-200 pointer-events-none animate-in fade-in">
          <UploadCloud className="w-12 h-12 mb-2 animate-bounce text-indigo-400" />
          <p className="text-sm font-semibold">Drop game images or sound files to upload</p>
          <p className="text-xs text-indigo-300/80 mt-1">Compressed to WebP / optimized WAV automatically</p>
        </div>
      )}

      {/* Top Header & Storage Budget Bar */}
      <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-sm shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left: Storage Budget Progress */}
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-200">Project Assets</span>
            <span className="text-[11px] font-mono text-slate-400">
              ({assets.length} items • {formatBytes(totalSizeBytes)} / 8 MB)
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full sm:w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isBudgetWarning ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, storageUsageRatio * 100)}%` }}
            />
          </div>

          {isBudgetWarning && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Storage limit warning (80% used)</span>
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700/80 shrink-0 cursor-pointer"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span>Upload</span>
          </button>

          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-sm shadow-indigo-600/20 shrink-0 cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Generate AI</span>
          </button>

          <button
            onClick={() => setIsSfxModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700/80 shrink-0 cursor-pointer"
          >
            <Music className="w-3.5 h-3.5 text-amber-400" />
            <span>SFX Maker</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="px-3 sm:px-4 py-2 border-b border-slate-800/60 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="w-full pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'sprite', label: 'Sprites' },
              { id: 'background', label: 'Backdrops' },
              { id: 'tileset', label: 'Tilesets' },
              { id: 'audio', label: 'Audio' },
              { id: 'ui_icon', label: 'Icons' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedTypeFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                selectedTypeFilter === f.id
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Progress Bar (if active) */}
      {uploadProgressText && (
        <div className="px-4 py-1.5 bg-indigo-950/60 border-b border-indigo-800/40 text-xs text-indigo-300 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{uploadProgressText}</span>
        </div>
      )}

      {/* Main Asset Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-thin scrollbar-thumb-slate-800">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-xs text-slate-400 font-mono">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span>Loading project assets...</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800/80 rounded-2xl bg-slate-900/20">
            <Layers className="w-10 h-10 text-slate-600 mb-2 stroke-[1.5]" />
            <h3 className="text-sm font-semibold text-slate-300">
              {assets.length === 0 ? 'No assets in this project yet' : 'No matching assets found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
              Upload your own sprites and sounds, generate sprites with AI, or synthesize retro SFX.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
              >
                Upload Files
              </button>
              <button
                onClick={() => setIsGenerateModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
              >
                Generate with AI
              </button>
              <button
                onClick={() => setIsSfxModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
              >
                Create SFX
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filteredAssets.map((asset) => {
              const isAudio = asset.type === 'audio' || asset.mimeType.startsWith('audio/');
              const isPlaying = playingAudioId === asset.id;

              return (
                <div
                  key={asset.id}
                  className="group bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-2.5 flex flex-col justify-between transition-all hover:shadow-lg hover:shadow-indigo-950/20"
                >
                  {/* Thumbnail / Media Container */}
                  <div className="w-full aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center relative select-none">
                    {/* Checkerboard Pattern for transparent sprites */}
                    {!isAudio && (
                      <div
                        className="absolute inset-0 opacity-15 pointer-events-none"
                        style={{
                          backgroundImage: `
                            linear-gradient(45deg, #475569 25%, transparent 25%), 
                            linear-gradient(-45deg, #475569 25%, transparent 25%), 
                            linear-gradient(45deg, transparent 75%, #475569 75%), 
                            linear-gradient(-45deg, transparent 75%, #475569 75%)
                          `,
                          backgroundSize: '12px 12px',
                          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                        }}
                      />
                    )}

                    {isAudio ? (
                      <div className="flex flex-col items-center justify-center gap-2 p-3 text-center">
                        <button
                          onClick={() => handleTogglePlayAudio(asset)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isPlaying
                              ? 'bg-amber-500 text-slate-950 scale-110 shadow-md shadow-amber-500/30'
                              : 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30'
                          }`}
                          title={isPlaying ? 'Pause Audio' : 'Play Audio Preview'}
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                        <span className="text-[10px] font-mono text-slate-400">
                          {asset.duration ? `${asset.duration}s` : 'Audio'}
                        </span>
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={asset.thumbnail || asset.data}
                        alt={asset.name}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain p-1 z-10 transition-transform group-hover:scale-105"
                      />
                    )}

                    {/* Quick Badge (Type) */}
                    <div className="absolute top-1.5 left-1.5 z-20">
                      <span className="text-[9px] font-medium uppercase px-1.5 py-0.5 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300 backdrop-blur-sm">
                        {asset.type}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="mt-2.5 px-0.5">
                    <p className="text-xs font-semibold text-slate-200 truncate" title={asset.name}>
                      {asset.name}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                      <span>{formatBytes(asset.size)}</span>
                      {asset.width && asset.height && (
                        <span>
                          {asset.width}x{asset.height}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                    {/* Copy Path */}
                    <button
                      onClick={() => handleCopyPath(asset.path, asset.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      title="Copy asset path"
                    >
                      {copiedId === asset.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Use in Game */}
                    <button
                      onClick={() => handleUseInGame(asset)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 hover:text-indigo-200 border border-indigo-500/20 text-[10px] font-medium transition-colors"
                      title="Send prompt to AI to use this asset"
                    >
                      <Send className="w-2.5 h-2.5" />
                      <span>Use</span>
                    </button>

                    {/* Rename */}
                    <button
                      onClick={() => {
                        setAssetToRename(asset);
                        setRenameInput(asset.name);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      title="Rename asset"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Download */}
                    <button
                      onClick={() => downloadDataUrl(asset.data, asset.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      title="Download asset"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setAssetToDelete(asset)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Generate Image Modal */}
      <GenerateImageModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onSaveAsset={handleSaveAsset}
      />

      {/* SFX Maker Modal */}
      <SfxMakerModal
        isOpen={isSfxModalOpen}
        onClose={() => setIsSfxModalOpen(false)}
        onSaveAsset={handleSaveAsset}
      />

      {/* Rename Dialog */}
      {assetToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-4 shadow-2xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">Rename Asset</h3>
            <input
              type="text"
              autoFocus
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAssetToRename(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRename}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-4 shadow-2xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">Delete Asset?</h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to delete <span className="text-slate-200 font-semibold font-mono">{assetToDelete.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAssetToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
