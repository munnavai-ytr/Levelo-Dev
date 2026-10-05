'use client';

import React, { useState, useMemo } from 'react';
import { useToast } from '@/components/Toast';
import { 
  FileCode, 
  Folder, 
  FolderOpen,
  Plus, 
  Trash2, 
  Edit2, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  ChevronRight, 
  ChevronDown,
  Layers,
  Sparkles,
  FilePlus,
  FolderPlus,
  AlertTriangle,
  Code2
} from 'lucide-react';

interface FilesPanelProps {
  files: Record<string, string>;
  projectTitle: string;
  onOpenFile?: (fileName: string) => void;
  onCreateFile?: (fileName: string, content?: string) => Promise<void>;
  onRenameFile?: (oldName: string, newName: string) => Promise<void>;
  onDeleteFile?: (fileName: string) => Promise<void>;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
}

export function FilesPanel({
  files,
  projectTitle,
  onOpenFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile
}: FilesPanelProps) {
  const { showToast } = useToast();
  const [selectedFilePath, setSelectedFilePath] = useState<string>('index.html');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '': true,
    'src': true
  });

  // Modal / Inline input states
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [targetParentFolder, setTargetParentFolder] = useState('');

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  // Build hierarchical tree from flat files map
  const fileTree = useMemo(() => {
    const root: TreeNode = { name: 'root', path: '', isFolder: true, children: [] };

    const filePaths = Object.keys(files).sort();

    for (const filePath of filePaths) {
      const parts = filePath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isLast) {
          // File node
          current.children.push({
            name: part,
            path: currentPath,
            isFolder: false,
            children: []
          });
        } else {
          // Folder node
          let folderNode = current.children.find((c) => c.isFolder && c.name === part);
          if (!folderNode) {
            folderNode = {
              name: part,
              path: currentPath,
              isFolder: true,
              children: []
            };
            current.children.push(folderNode);
          }
          current = folderNode;
        }
      }
    }

    // Sort folders first, then alphabetically
    const sortTree = (node: TreeNode) => {
      node.children.sort((a, b) => {
        if (a.isFolder === b.isFolder) {
          return a.name.localeCompare(b.name);
        }
        return a.isFolder ? -1 : 1;
      });
      node.children.forEach(sortTree);
    };

    sortTree(root);
    return root;
  }, [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.html')) return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    if (fileName.endsWith('.css')) return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    if (fileName.endsWith('.json')) return <Code2 className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (fileName.endsWith('.md')) return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  // Actions
  const handleCreateFileSubmit = async () => {
    let name = newItemName.trim().replace(/^\.?\//, '');
    if (!name) return;
    const fullPath = targetParentFolder ? `${targetParentFolder}/${name}` : name;

    if (files[fullPath] !== undefined) {
      showToast('File already exists', 'error');
      return;
    }

    let defaultContent = '';
    if (name.endsWith('.js')) {
      defaultContent = '// ' + name + '\n';
    } else if (name.endsWith('.css')) {
      defaultContent = '/* ' + name + ' */\n';
    } else if (name.endsWith('.html')) {
      defaultContent = '<!DOCTYPE html>\n<html>\n<head></head>\n<body>\n</body>\n</html>';
    }

    if (onCreateFile) {
      await onCreateFile(fullPath, defaultContent);
    }
    setSelectedFilePath(fullPath);
    setIsCreatingFile(false);
    setNewItemName('');
    showToast(`Created ${fullPath}`, 'success');
  };

  const handleCreateFolderSubmit = async () => {
    let folderName = newItemName.trim().replace(/^\.?\//, '');
    if (!folderName) return;
    const fullPath = targetParentFolder ? `${targetParentFolder}/${folderName}` : folderName;
    const dummyFile = `${fullPath}/.gitkeep`;

    if (onCreateFile) {
      await onCreateFile(dummyFile, '');
    }
    setExpandedFolders((prev) => ({ ...prev, [fullPath]: true }));
    setIsCreatingFolder(false);
    setNewItemName('');
    showToast(`Created folder ${fullPath}`, 'success');
  };

  const handleRenameSubmit = async () => {
    if (!renamingPath || !renameInput.trim()) return;
    const newName = renameInput.trim().replace(/^\.?\//, '');
    if (newName === renamingPath) {
      setRenamingPath(null);
      return;
    }

    if (onRenameFile) {
      await onRenameFile(renamingPath, newName);
      showToast(`Renamed to ${newName}`, 'success');
    }
    if (selectedFilePath === renamingPath) {
      setSelectedFilePath(newName);
    }
    setRenamingPath(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPath) return;
    if (deletingPath === 'index.html') {
      showToast('index.html is required and cannot be deleted', 'error');
      setDeletingPath(null);
      return;
    }

    if (onDeleteFile) {
      await onDeleteFile(deletingPath);
      showToast(`Deleted ${deletingPath}`, 'info');
    }
    if (selectedFilePath === deletingPath) {
      setSelectedFilePath('index.html');
    }
    setDeletingPath(null);
  };

  const renderTree = (node: TreeNode, depth = 0) => {
    if (node.name === 'root') {
      return <div>{node.children.map((child) => renderTree(child, depth))}</div>;
    }

    const isExpanded = expandedFolders[node.path] ?? false;

    if (node.isFolder) {
      return (
        <div key={node.path} className="select-none">
          <div
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-900 rounded-lg group text-xs text-slate-300 font-medium cursor-pointer"
            onClick={() => toggleFolder(node.path)}
          >
            <div className="flex items-center gap-1.5 truncate">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-400/90 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-400/80 shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetParentFolder(node.path);
                  setIsCreatingFile(true);
                  setNewItemName('');
                }}
                className="p-1 text-slate-400 hover:text-indigo-300 transition-colors"
                title="Add file inside folder"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isExpanded && (
            <div>{node.children.map((child) => renderTree(child, depth + 1))}</div>
          )}
        </div>
      );
    }

    const isSelected = selectedFilePath === node.path;
    const isGitkeep = node.name === '.gitkeep';
    if (isGitkeep) return null;

    return (
      <div
        key={node.path}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        onClick={() => {
          setSelectedFilePath(node.path);
          if (onOpenFile) {
            onOpenFile(node.path);
          }
        }}
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg group text-xs font-mono cursor-pointer transition-colors ${
          isSelected
            ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30'
            : 'text-slate-300 hover:bg-slate-900/80 hover:text-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {getFileIcon(node.name)}
          <span className="truncate">{node.name}</span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRenamingPath(node.path);
              setRenameInput(node.path);
            }}
            className="p-1 text-slate-400 hover:text-indigo-300 transition-colors"
            title="Rename file"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {node.path !== 'index.html' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeletingPath(node.path);
              }}
              className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
              title="Delete file"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const selectedContent = files[selectedFilePath] || '';
  const linesCount = selectedContent.split('\n').length;
  const bytesSize = new Blob([selectedContent]).size;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Files Top Bar */}
      <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-200">Project File Tree</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
            {Object.keys(files).length} files
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setTargetParentFolder('');
              setIsCreatingFile(true);
              setNewItemName('');
            }}
            className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Create new file"
          >
            <FilePlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>New File</span>
          </button>

          <button
            onClick={() => {
              setTargetParentFolder('');
              setIsCreatingFolder(true);
              setNewItemName('');
            }}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            title="Create new folder"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Main Split: Left File Tree, Right File Preview / Stats */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Tree Explorer */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800/80 p-2 overflow-y-auto shrink-0 bg-slate-950/60">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>Explorer</span>
          </div>

          <div className="mt-1 space-y-0.5">{renderTree(fileTree)}</div>
        </div>

        {/* Right Active File Quick Info & Code Peek */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/30">
          <div className="h-10 border-b border-slate-800/80 bg-slate-950/40 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
              {getFileIcon(selectedFilePath)}
              <span>{selectedFilePath}</span>
              <span className="text-slate-500 font-sans text-[11px]">({linesCount} lines · {bytesSize} B)</span>
            </div>

            {onOpenFile && (
              <button
                onClick={() => onOpenFile(selectedFilePath)}
                className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Edit in Code Tab</span>
              </button>
            )}
          </div>

          <div className="flex-1 p-4 overflow-auto">
            <pre className="text-xs font-mono text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800/80 max-h-full overflow-auto">
              {selectedContent || '// (Empty file)'}
            </pre>
          </div>
        </div>
      </div>

      {/* Create File Modal */}
      {isCreatingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3">
              <FilePlus className="w-4 h-4 text-indigo-400" />
              <span>Create New File</span>
            </h4>
            {targetParentFolder && (
              <p className="text-xs text-slate-400 mb-2 font-mono">Inside: /{targetParentFolder}</p>
            )}
            <input
              type="text"
              autoFocus
              placeholder="e.g. game.js, style.css, src/player.js"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFileSubmit()}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 mb-4 font-mono"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsCreatingFile(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFileSubmit}
                disabled={!newItemName.trim()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {isCreatingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3">
              <FolderPlus className="w-4 h-4 text-amber-400" />
              <span>Create New Folder</span>
            </h4>
            <input
              type="text"
              autoFocus
              placeholder="e.g. src, assets, levels"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolderSubmit()}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 mb-4 font-mono"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolderSubmit}
                disabled={!newItemName.trim()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {renamingPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3">
              <Edit2 className="w-4 h-4 text-indigo-400" />
              <span>Rename File</span>
            </h4>
            <input
              type="text"
              autoFocus
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 mb-4 font-mono"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRenamingPath(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={!renameInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-900/60 rounded-2xl p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-rose-200 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Delete File?</span>
            </h4>
            <p className="text-xs text-slate-300 mb-4 font-mono">
              Are you sure you want to permanently delete <strong className="text-white">{deletingPath}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingPath(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors"
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
