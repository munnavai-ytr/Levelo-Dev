/**
 * Levelo Cloud Sync Manager
 * Manages pending Firestore write queue with exponential backoff retry (max 5 tries).
 * Flushes on 'online' window event and exposes sync status for persistent UI warning banner.
 */

export interface PendingWrite {
  id: string;
  projectId: string;
  type: 'files' | 'chat' | 'title' | 'thumbnail';
  payload: any;
  retryCount: number;
  lastAttempt: number;
  error?: string;
}

export type SyncStatusState = 'synced' | 'retrying' | 'error' | 'offline';

export interface SyncStatus {
  state: SyncStatusState;
  pendingCount: number;
  lastError: string | null;
  retryAttempt: number;
}

const PENDING_QUEUE_KEY = 'levelo_pending_firestore_writes';
const listeners = new Set<(status: SyncStatus) => void>();

let currentStatus: SyncStatus = {
  state: 'synced',
  pendingCount: 0,
  lastError: null,
  retryAttempt: 0,
};

function notifyListeners() {
  listeners.forEach((listener) => listener(currentStatus));
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void) {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

export function getPendingWrites(): PendingWrite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingWrites(queue: PendingWrite[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    currentStatus = {
      ...currentStatus,
      pendingCount: queue.length,
      state: queue.length === 0 ? 'synced' : currentStatus.state,
    };
    notifyListeners();
  } catch (err) {
    console.warn('Failed to save pending write queue:', err);
  }
}

export function enqueuePendingWrite(write: Omit<PendingWrite, 'id' | 'retryCount' | 'lastAttempt'>) {
  const queue = getPendingWrites();
  const newEntry: PendingWrite = {
    ...write,
    id: `write_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    retryCount: 0,
    lastAttempt: Date.now(),
  };
  queue.push(newEntry);
  savePendingWrites(queue);

  currentStatus = {
    state: 'retrying',
    pendingCount: queue.length,
    lastError: write.error || 'Write failed, retrying in background...',
    retryAttempt: 1,
  };
  notifyListeners();

  scheduleRetry();
}

let retryTimeout: NodeJS.Timeout | null = null;

export function scheduleRetry(delayMs = 2000) {
  if (typeof window === 'undefined') return;
  if (retryTimeout) clearTimeout(retryTimeout);

  retryTimeout = setTimeout(() => {
    flushPendingWrites();
  }, delayMs);
}

export async function flushPendingWrites() {
  if (typeof window === 'undefined') return;
  const queue = getPendingWrites();
  if (queue.length === 0) {
    currentStatus = {
      state: 'synced',
      pendingCount: 0,
      lastError: null,
      retryAttempt: 0,
    };
    notifyListeners();
    return;
  }

  if (!navigator.onLine) {
    currentStatus = {
      state: 'offline',
      pendingCount: queue.length,
      lastError: 'No internet connection',
      retryAttempt: 0,
    };
    notifyListeners();
    return;
  }

  const remaining: PendingWrite[] = [];
  let hadFailure = false;

  for (const item of queue) {
    try {
      // Lazy import firebase to avoid circular dependencies
      const { updateProjectFiles, updateProjectChat, renameProject, updateProjectThumbnail } = await import(
        './firebase'
      );

      if (item.type === 'files') {
        await updateProjectFiles(item.projectId, item.payload.filesToUpdate, item.payload.deletedFiles);
      } else if (item.type === 'chat') {
        await updateProjectChat(item.projectId, item.payload.chatMessages);
      } else if (item.type === 'title') {
        await renameProject(item.projectId, item.payload.title);
      } else if (item.type === 'thumbnail') {
        await updateProjectThumbnail(item.projectId, item.payload.thumbnail);
      }
    } catch (err: any) {
      hadFailure = true;
      item.retryCount += 1;
      item.lastAttempt = Date.now();
      item.error = err?.message || 'Network sync error';

      if (item.retryCount <= 5) {
        remaining.push(item);
      } else {
        console.error('Pending write dropped after 5 failed retries:', item);
      }
    }
  }

  savePendingWrites(remaining);

  if (remaining.length > 0) {
    const nextDelay = Math.min(30000, Math.pow(2, remaining[0].retryCount) * 1500);
    currentStatus = {
      state: hadFailure ? 'retrying' : 'synced',
      pendingCount: remaining.length,
      lastError: remaining[0].error || 'Retrying cloud sync...',
      retryAttempt: remaining[0].retryCount,
    };
    notifyListeners();
    scheduleRetry(nextDelay);
  } else {
    currentStatus = {
      state: 'synced',
      pendingCount: 0,
      lastError: null,
      retryAttempt: 0,
    };
    notifyListeners();
  }
}

// Auto flush when browser comes online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingWrites();
  });
}
