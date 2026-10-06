'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Globe2, 
  Share2, 
  Trash2, 
  Loader2, 
  Check, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Sparkles,
  Lock,
  Eye
} from 'lucide-react';
import { 
  publishProject, 
  unpublishGame, 
  fetchPublishedSlugByProjectId, 
  MAX_PUBLISHED_SIZE_BYTES 
} from '@/lib/publish-manager';
import { formatBytes } from '@/lib/asset-utils';
import { useToast } from '@/components/Toast';
import type { GameProject, ProjectAsset, PublishedGame } from '@/lib/types';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: GameProject;
  assets: ProjectAsset[];
  authorName?: string;
  onOpenShare?: (published: PublishedGame) => void;
}

export function PublishModal({
  isOpen,
  onClose,
  project,
  assets,
  authorName = 'Game Creator',
  onOpenShare,
}: PublishModalProps) {
  const { showToast } = useToast();

  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState(authorName);
  const [isPublic, setIsPublic] = useState(true);
  const [publishedGame, setPublishedGame] = useState<PublishedGame | null>(null);

  const [isChecking, setIsChecking] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if project already has a published slug
  useEffect(() => {
    let active = true;
    if (isOpen && project.id) {
      setIsChecking(true);
      setError(null);
      fetchPublishedSlugByProjectId(project.id)
        .then((pub) => {
          if (active) {
            if (pub) {
              setPublishedGame(pub);
              setDescription(pub.description);
              setAuthor(pub.authorName);
              setIsPublic(pub.isPublic);
            }
          }
        })
        .catch(console.warn)
        .finally(() => {
          if (active) setIsChecking(false);
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, project.id]);

  if (!isOpen) return null;

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);

    try {
      const pub = await publishProject(project, assets, {
        description: description.trim() || `Play ${project.title} on Levelo!`,
        authorName: author.trim() || 'Game Creator',
        isPublic,
        existingSlug: publishedGame?.slug,
      });

      setPublishedGame(pub);
      showToast(publishedGame ? 'Game updated in cloud!' : 'Game published successfully!', 'success');
      
      if (onOpenShare) {
        onClose();
        onOpenShare(pub);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to publish game.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!publishedGame) return;
    if (!window.confirm('Are you sure you want to unpublish this game? The public play link will stop working.')) {
      return;
    }

    setIsUnpublishing(true);
    try {
      await unpublishGame(publishedGame.slug, project.ownerId);
      setPublishedGame(null);
      showToast('Game unpublished.', 'info');
    } catch {
      showToast('Failed to unpublish game.', 'error');
    } finally {
      setIsUnpublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">
                {publishedGame ? 'Update Published Game' : 'Publish Game to Cloud'}
              </h2>
              <p className="text-xs text-slate-400">
                {publishedGame ? `Live at /play/${publishedGame.slug}` : 'Generate public playable web snapshot'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {isChecking ? (
            <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-400 font-mono gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span>Checking publish status...</span>
            </div>
          ) : (
            <>
              {/* Published Status Banner if currently active */}
              {publishedGame && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                    <div className="truncate">
                      <span className="font-semibold block">Game is currently published!</span>
                      <span className="text-[11px] text-emerald-400/80 font-mono truncate">
                        Plays: {publishedGame.plays} • {publishedGame.isPublic ? 'Public in Explore' : 'Unlisted Link'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`/play/${publishedGame.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 transition-colors"
                      title="Open Play Page"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Game Title */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Game Title</label>
                <input
                  type="text"
                  disabled
                  value={project.title}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-semibold cursor-not-allowed"
                />
              </div>

              {/* Author Name */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Author Name / Studio</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. PixelForge Studios"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your game, controls, instructions or lore..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none placeholder:text-slate-600"
                />
              </div>

              {/* Explore Visibility Toggle */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {isPublic ? (
                    <Eye className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">
                      {isPublic ? 'Public in Explore' : 'Unlisted Game'}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {isPublic
                        ? 'Listed publicly on the /explore page for everyone to discover.'
                        : 'Only accessible to people with the direct link.'}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Safety & Limits Notice */}
              <div className="text-[11px] text-slate-500 flex items-center justify-between px-1 font-mono">
                <span>Max snapshot size: 900 KB</span>
                <span>Rate limit: 10 / hour</span>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2 shrink-0">
          <div>
            {publishedGame && (
              <button
                onClick={handleUnpublish}
                disabled={isUnpublishing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-medium transition-colors cursor-pointer"
              >
                {isUnpublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Unpublish</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing || isChecking}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Snapshot...</span>
                </>
              ) : (
                <>
                  <Globe2 className="w-4 h-4" />
                  <span>{publishedGame ? 'Republish / Update' : 'Publish Game'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
