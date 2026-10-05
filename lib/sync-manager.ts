/**
 * Levelo Cloud Sync Manager
 * Manages pending Firestore write queue with exponential backoff retry (max 5 tries).
 * Flushes on 'online' window event and exposes sync status for persistent UI warning banner.
 */

export interface PendingWrite {
  id: string;
  type: 'files' | 'chat' | 'title' | 'thumbnail' | 'version';
  projectId: string;
  payload: any;
  attempts: number;
  maxAttempts: number;
  nextRetry: number;
  createdAt: number;
  lastError?: string;
}

export type SyncState = 'synced' | 'saving' | 'retrying' | 'error';

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  lastError: string | null;
  attempts: number;
}

const STORAGE_KEY = 'levelo_pending_writes';
const MAX_ATTEMPTS = 5;

type Listener = (status: SyncStatus) => void;
const listeners = new Set<Listener>();

let currentStatus: SyncStatus = {
  state: 'synced',
  pendingCount: 0,
  lastError: null,
  attempts: 0
};

function notify() {
  listeners.forEach((l) => l(currentStatus));
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

function loadQueue(): PendingWrite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingWrite[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    const active = queue.filter(q => q.attempts < q.maxAttempts);
    if (active.length === 0) {
      currentStatus = {
        state: 'synced',
        pendingCount: 0,
        lastError: null,
        attempts: 0
      };
    } else {
      const highestAttempt = Math.max(...active.map(a => a.attempts));
      currentStatus = {
        state: 'retrying',
        pendingCount: active.length,
        lastError: active[0]?.lastError || 'Network connection issue',
        attempts: highestAttempt
      };
    }
    notify();
  } catch {}
}

export function enqueuePendingWrite(
  type: PendingWrite['type'],
  projectId: string,
  payload: any,
  error?: string
) {
  const queue = loadQueue();
  // Deduplicate for same project and type if applicable
  const existingIdx = queue.findIndex(q => q.projectId === projectId && q.type === type);
  
  const item: PendingWrite = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'write_' + Date.now(),
    type,
    projectId,
    payload,
    attempts: existingIdx >= 0 ? queue[existingIdx].attempts + 1 : 1,
    maxAttempts: MAX_ATTEMPTS,
    nextRetry: Date.now() + 1000,
    createdAt: existingIdx >= 0 ? queue[existingIdx].createdAt : Date.now(),
    lastError: error || 'Failed to save to cloud'
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = item;
  } else {
    queue.push(item);
  }

  saveQueue(queue);
  scheduleRetry();
}

let retryTimeout: NodeJS.Timeout | null = null;
let isFlushing = false;

// Executor callback registered by lib/firebase.ts to execute actual Firestore writes
type WriteExecutor = (item: PendingWrite) => Promise<boolean>;
let registeredExecutor: WriteExecutor | null = null;

export function registerWriteExecutor(executor: WriteExecutor) {
  registeredExecutor = executor;
  if (typeof window !== 'undefined') {
    // Check initial queue on load
    const queue = loadQueue();
    if (queue.length > 0) {
      currentStatus = {
        state: 'retrying',
        pendingCount: queue.length,
        lastError: queue[0]?.lastError || 'Pending writes queued',
        attempts: 1
      };
      notify();
      scheduleRetry();
    }
  }
}

export async function flushPendingWrites(): Promise<void> {
  if (isFlushing || !registeredExecutor || typeof window === 'undefined') return;
  isFlushing = true;

  try {
    const queue = loadQueue();
    if (queue.length === 0) {
      currentStatus = { state: 'synced', pendingCount: 0, lastError: null, attempts: 0 };
      notify();
      return;
    }

    currentStatus = { ...currentStatus, state: 'saving' };
    notify();

    const remaining: PendingWrite[] = [];

    for (const item of queue) {
      if (item.attempts >= item.maxAttempts) {
        remaining.push(item);
        continue;
      }

      try {
        const success = await registeredExecutor(item);
        if (!success) {
          item.attempts += 1;
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s... up to 30s
          const backoff = Math.min(1000 * Math.pow(2, item.attempts), 30000);
          item.nextRetry = Date.now() + backoff;
          remaining.push(item);
        }
      } catch (err: any) {
        item.attempts += 1;
        item.lastError = err?.message || 'Firestore write failed';
        const backoff = Math.min(1000 * Math.pow(2, item.attempts), 30000);
        item.nextRetry = Date.now() + backoff;
        remaining.push(item);
      }
    }

    saveQueue(remaining);

    if (remaining.length > 0) {
      scheduleRetry();
    }
  } finally {
    isFlushing = false;
  }
}

function scheduleRetry() {
  if (retryTimeout) clearTimeout(retryTimeout);
  if (typeof window === 'undefined') return;

  const queue = loadQueue();
  const active = queue.filter(q => q.attempts < q.maxAttempts);
  if (active.length === 0) return;

  const now = Date.now();
  const nextRun = Math.min(...active.map(a => Math.max(0, a.nextRetry - now)));

  retryTimeout = setTimeout(() => {
    flushPendingWrites();
  }, Math.max(1000, nextRun));
}

// Listen to browser online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingWrites();
  });
}
