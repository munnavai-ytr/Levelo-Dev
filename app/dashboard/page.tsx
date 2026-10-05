'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { 
  fetchUserProjects, 
  createNewProject, 
  renameProject, 
  deleteProject 
} from '@/lib/firebase';
import type { GameProject } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { FirebaseNotice } from '@/components/FirebaseNotice';
import { NewProjectModal } from '@/components/dashboard/NewProjectModal';
import { RenameModal } from '@/components/dashboard/RenameModal';
import { DeleteConfirmModal } from '@/components/dashboard/DeleteConfirmModal';
import { useToast } from '@/components/Toast';
import { 
  Plus, 
  Gamepad2, 
  Search, 
  Calendar, 
  MoreVertical, 
  Play, 
  Edit3, 
  Trash2, 
  Copy, 
  Layers, 
  Sparkles,
  Loader2,
  FolderOpen
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthLoading } = useAuth();
  const { showToast } = useToast();

  const [projects, setProjects] = useState<GameProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [renameProjectTarget, setRenameProjectTarget] = useState<GameProject | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<GameProject | null>(null);

  // Protected route check
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);

  // Load user projects
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

  // Handle new project creation
  const handleCreateProject = async (title: string, customHtml?: string) => {
    if (!user) return;
    try {
      const created = await createNewProject(user.uid, title, customHtml);
      showToast(`Created "${created.title}"!`, 'success');
      // Navigate straight to the new project workspace
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

  // Handle delete
  const handleDelete = async () => {
    if (!deleteProjectTarget) return;
    try {
      await deleteProject(deleteProjectTarget.id);
      showToast('Project deleted', 'info');
      setProjects((prev) => prev.filter((p) => p.id !== deleteProjectTarget.id));
    } catch (err) {
      console.error('Error deleting:', err);
      showToast('Failed to delete project', 'error');
    }
  };

  // Handle duplicate
  const handleDuplicate = async (p: GameProject) => {
    if (!user) return;
    try {
      const copy = await createNewProject(user.uid, `${p.title} (Copy)`, p.files['index.html']);
      showToast(`Duplicated into "${copy.title}"`, 'success');
      loadProjects();
    } catch (err) {
      console.error('Error duplicating:', err);
      showToast('Failed to duplicate project', 'error');
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              Build, run, and modify Phaser 3 web games in real-time
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* New Game CTA */}
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Game</span>
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="mt-8">
          {loading ? (
            /* Skeleton Loading Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 animate-pulse"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-800" />
                  <div className="h-4 bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            /* Real Empty State */
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center max-w-lg mx-auto my-12">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
                <Gamepad2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">No games created yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Create your first game with a playable Phaser 3 starter template. You can preview it live, tweak physics in Monaco, and customize everything.
              </p>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Game</span>
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            /* Search Empty State */
            <div className="text-center py-12 text-slate-400 text-xs">
              No games found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            /* Real Projects Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="group rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-900 hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Gamepad2 className="w-5 h-5" />
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setRenameProjectTarget(project)}
                          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Rename game"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(project)}
                          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Duplicate game"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteProjectTarget(project)}
                          className="p-1.5 rounded-md hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete game"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <Link href={`/project/${project.id}`} className="block group-hover:text-indigo-300 transition-colors">
                      <h3 className="font-semibold text-sm text-slate-100 truncate">
                        {project.title}
                      </h3>
                    </Link>

                    <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                      <span>Phaser 3</span>
                      <span aria-hidden="true">·</span>
                      <span>Updated {formatDate(project.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="border-t border-slate-800/80 bg-slate-950/40 px-5 py-2.5 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-400" />
                      <span>index.html</span>
                    </span>

                    <Link
                      href={`/project/${project.id}`}
                      className="px-3 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Open Workspace</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateProject}
      />

      <RenameModal
        isOpen={!!renameProjectTarget}
        initialTitle={renameProjectTarget?.title || ''}
        onClose={() => setRenameProjectTarget(null)}
        onRename={handleRename}
      />

      <DeleteConfirmModal
        isOpen={!!deleteProjectTarget}
        projectTitle={deleteProjectTarget?.title || ''}
        onClose={() => setDeleteProjectTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
