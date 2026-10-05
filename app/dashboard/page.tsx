'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { 
  fetchProjects as fetchUserProjects, 
  createNewProject, 
  renameProject, 
  deleteProject,
  duplicateProject,
  bulkDeleteProjects
} from '@/lib/firebase';
import type { GameProject } from '@/lib/types';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/Navbar';
import { FirebaseNotice } from '@/components/FirebaseNotice';
import { useToast } from '@/components/Toast';

// Dynamically import modals to lighten initial dashboard JS bundle
const NewProjectModal = dynamic(
  () => import('@/components/dashboard/NewProjectModal').then((m) => m.NewProjectModal),
  { ssr: false }
);
const RenameModal = dynamic(
  () => import('@/components/dashboard/RenameModal').then((m) => m.RenameModal),
  { ssr: false }
);
const DeleteConfirmModal = dynamic(
  () => import('@/components/dashboard/DeleteConfirmModal').then((m) => m.DeleteConfirmModal),
  { ssr: false }
);
import { 
  Plus, 
  Search, 
  Gamepad2, 
  Play, 
  MoreVertical, 
  Edit3, 
  Copy, 
  Trash2, 
  Clock, 
  ExternalLink,
  Loader2,
  Calendar,
  Grid3X3,
  List as ListIcon,
  ArrowUpDown,
  CheckSquare,
  Square,
  AlertTriangle,
  FolderCode
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthLoading } = useAuth();
  const { showToast } = useToast();

  const [projects, setProjects] = useState<GameProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Multi-select / Bulk Delete State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [renameProjectTarget, setRenameProjectTarget] = useState<GameProject | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<GameProject | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Redirect to login if user logs out
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);

  // Load projects
  const loadProjects = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const list = await fetchUserProjects(user.uid);
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects:', err);
      showToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    let active = true;
    if (user) {
      fetchUserProjects(user.uid)
        .then((list) => {
          if (active) {
            setProjects(list);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            console.error('Failed to load projects:', err);
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.project-menu-container')) {
        setOpenDropdownId(null);
      }
    }
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Handle new project creation
  const handleCreateProject = async (
    title: string, 
    customFiles?: Record<string, string>, 
    initialPrompt?: string
  ) => {
    if (!user) return;
    try {
      const created = await createNewProject(user.uid, title, customFiles);
      showToast(`Created "${created.title}"!`, 'success');

      // If initial prompt provided, store in sessionStorage so Workspace picks it up
      if (initialPrompt) {
        sessionStorage.setItem(`levelo_init_prompt_${created.id}`, initialPrompt);
      }
      router.push(`/project/${created.id}`);
    } catch (err) {
      console.error('Error creating project:', err);
      showToast('Error creating game project', 'error');
    }
  };

  // Handle rename
  const handleRename = async (newTitle: string) => {
    if (!renameProjectTarget) return;
    try {
      await renameProject(renameProjectTarget.id, newTitle);
      showToast('Game renamed', 'success');
      setProjects((prev) =>
        prev.map((p) => (p.id === renameProjectTarget.id ? { ...p, title: newTitle, updatedAt: new Date().toISOString() } : p))
      );
    } catch (err) {
      console.error('Error renaming:', err);
      showToast('Failed to rename project', 'error');
    }
  };

  // Handle single delete
  const handleDelete = async () => {
    if (!deleteProjectTarget) return;
    try {
      await deleteProject(deleteProjectTarget.id);
      showToast('Project deleted', 'info');
      setProjects((prev) => prev.filter((p) => p.id !== deleteProjectTarget.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteProjectTarget.id));
    } catch (err) {
      console.error('Error deleting:', err);
      showToast('Failed to delete project', 'error');
    }
  };

  // Handle duplicate
  const handleDuplicate = async (p: GameProject) => {
    if (!user) return;
    try {
      const copy = await duplicateProject(p.id, user.uid, `${p.title} (Copy)`);
      showToast(`Duplicated into "${copy.title}"`, 'success');
      loadProjects();
    } catch (err) {
      console.error('Error duplicating:', err);
      showToast('Failed to duplicate project', 'error');
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      await bulkDeleteProjects(selectedIds);
      showToast(`Deleted ${selectedIds.length} projects`, 'info');
      setProjects((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err) {
      console.error('Error in bulk delete:', err);
      showToast('Failed to delete selected projects', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedProjects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedProjects.map((p) => p.id));
    }
  };

  // Search & Sort Filter
  const q = searchQuery.toLowerCase().trim();
  const matchedProjects = q
    ? projects.filter((p) => p.title.toLowerCase().includes(q))
    : projects;

  const filteredAndSortedProjects = [...matchedProjects].sort((a, b) => {
    if (sortBy === 'name') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'created') {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    }
    // 'updated'
    const timeA = new Date(a.updatedAt || 0).getTime();
    const timeB = new Date(b.updatedAt || 0).getTime();
    return timeB - timeA;
  });

  const formatDate = (isoOrTimestamp: any) => {
    if (!isoOrTimestamp) return 'Recently';
    try {
      const d = new Date(isoOrTimestamp);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Recently';
    }
  };

  if (isAuthLoading || (!user && isAuthLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
        <span className="text-sm font-medium">Loading Levelo Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <FirebaseNotice />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>Your Games</span>
              <span className="text-xs font-mono font-normal text-slate-400 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
                {projects.length}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Build, run, and modify interactive web games in real-time
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="updated" className="bg-slate-900 text-slate-200">Recently Updated</option>
                <option value="created" className="bg-slate-900 text-slate-200">Newest Created</option>
                <option value="name" className="bg-slate-900 text-slate-200">A - Z</option>
              </select>
            </div>

            {/* View Mode Toggle: Grid vs List */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid View"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* New Game Button */}
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Game</span>
            </button>
          </div>
        </div>

        {/* Bulk Actions Floating Bar */}
        {selectedIds.length > 0 && (
          <div className="mt-4 p-3 bg-indigo-950/60 border border-indigo-500/30 rounded-xl flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-xs font-medium text-indigo-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <span>
                  {selectedIds.length === filteredAndSortedProjects.length
                    ? 'Deselect All'
                    : 'Select All'}
                </span>
              </button>
              <span className="text-xs text-indigo-200 font-mono">
                {selectedIds.length} {selectedIds.length === 1 ? 'game' : 'games'} selected
              </span>
            </div>

            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        )}

        {/* Content Section */}
        <div className="mt-6">
          {loading ? (
            /* Skeleton Loading State */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden animate-pulse"
                >
                  <div className="w-full h-40 bg-slate-800/60" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedProjects.length === 0 ? (
            /* Empty State */
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center max-w-lg mx-auto my-12">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
                <Gamepad2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                {searchQuery ? 'No matching games found' : 'No games created yet'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                {searchQuery 
                  ? `No games matching "${searchQuery}". Try a different search query.` 
                  : 'Create your first game with an AI prompt or launch from 6 fully playable templates.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Game</span>
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW WITH THUMBNAIL */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAndSortedProjects.map((p) => {
                const isSelected = selectedIds.includes(p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/project/${p.id}`)}
                    onMouseEnter={() => router.prefetch(`/project/${p.id}`)}
                    onTouchStart={() => router.prefetch(`/project/${p.id}`)}
                    className={`group rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col bg-slate-900/70 hover:bg-slate-900 shadow-lg cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-indigo-950/20'
                        : 'border-slate-800/90 hover:border-slate-700 hover:shadow-indigo-500/5'
                    }`}
                  >
                    {/* Thumbnail Card Banner */}
                    <div className="relative w-full h-40 bg-slate-950 border-b border-slate-800/80 overflow-hidden">
                      {p.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.thumbnail}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-900 text-slate-500">
                          <Gamepad2 className="w-10 h-10 text-indigo-400/60 mb-1 group-hover:scale-110 transition-transform duration-200" />
                          <span className="text-[10px] font-mono text-slate-400">Playable Game</span>
                        </div>
                      )}

                      {/* Select Checkbox */}
                      <button
                        onClick={(e) => toggleSelectProject(p.id, e)}
                        className={`absolute top-2.5 left-2.5 p-1 rounded-md backdrop-blur-md transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-700/60 opacity-0 group-hover:opacity-100'
                        }`}
                        title={isSelected ? 'Deselect' : 'Select'}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>

                      {/* File count badge */}
                      <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-300 backdrop-blur-sm">
                        {Object.keys(p.files || {}).length} files
                      </div>

                      {/* Quick Play Overlay */}
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                          {p.title}
                        </h3>

                        {/* Dropdown Menu */}
                        <div className="relative project-menu-container" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === p.id ? null : p.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                            aria-label="More actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openDropdownId === p.id && (
                            <div className="absolute right-0 top-7 w-40 rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-1 z-20 text-xs animate-in fade-in duration-100">
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  setRenameProjectTarget(p);
                                }}
                                className="w-full px-3 py-1.5 text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Rename</span>
                              </button>
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  handleDuplicate(p);
                                }}
                                className="w-full px-3 py-1.5 text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Duplicate</span>
                              </button>
                              <div className="h-px bg-slate-800 my-1" />
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  setDeleteProjectTarget(p);
                                }}
                                className="w-full px-3 py-1.5 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(p.updatedAt)}</span>
                        </span>
                        <span className="text-indigo-400/90 group-hover:text-indigo-300 font-sans font-medium flex items-center gap-1">
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
              {filteredAndSortedProjects.map((p) => {
                const isSelected = selectedIds.includes(p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/project/${p.id}`)}
                    onMouseEnter={() => router.prefetch(`/project/${p.id}`)}
                    onTouchStart={() => router.prefetch(`/project/${p.id}`)}
                    className={`p-3.5 sm:px-5 flex items-center justify-between gap-4 hover:bg-slate-900 transition-colors cursor-pointer ${
                      isSelected ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      <button
                        onClick={(e) => toggleSelectProject(p.id, e)}
                        className={`p-1 rounded-md transition-colors ${
                          isSelected ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>

                      {/* Small Thumbnail Icon */}
                      <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                        {p.thumbnail ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-indigo-400">
                            <Gamepad2 className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      <div className="truncate">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-100 hover:text-indigo-300 transition-colors truncate">
                          {p.title}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>Updated {formatDate(p.updatedAt)}</span>
                          <span>·</span>
                          <span>{Object.keys(p.files || {}).length} files</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => router.push(`/project/${p.id}`)}
                        className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-medium transition-colors hidden sm:flex items-center gap-1.5"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Launch</span>
                      </button>

                      {/* Dropdown */}
                      <div className="relative project-menu-container">
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === p.id ? null : p.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                          aria-label="Actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openDropdownId === p.id && (
                          <div className="absolute right-0 top-8 w-40 rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-1 z-20 text-xs">
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                setRenameProjectTarget(p);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Rename</span>
                            </button>
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleDuplicate(p);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Duplicate</span>
                            </button>
                            <div className="h-px bg-slate-800 my-1" />
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                setDeleteProjectTarget(p);
                              }}
                              className="w-full px-3 py-1.5 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* New Project Modal (Prompt & Template modes) */}
      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateProject}
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={Boolean(renameProjectTarget)}
        initialTitle={renameProjectTarget?.title || ''}
        onClose={() => setRenameProjectTarget(null)}
        onRename={handleRename}
      />

      {/* Single Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteProjectTarget)}
        projectTitle={deleteProjectTarget?.title || ''}
        onClose={() => setDeleteProjectTarget(null)}
        onConfirm={handleDelete}
      />

      {/* Bulk Delete Confirm Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Delete Multiple Games</h3>
                <p className="text-xs text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Are you sure you want to permanently delete{' '}
              <strong className="text-rose-300 font-bold">{selectedIds.length}</strong> selected games and all their version histories?
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedIds.length} Games`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
