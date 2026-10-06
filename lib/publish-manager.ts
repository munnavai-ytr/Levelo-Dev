/**
 * Levelo Publishing & Community Manager
 * Manages game snapshots in Firestore "published" collection, slug generation,
 * session play counter increments, Explore listings, and safety reports.
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  serverTimestamp, 
  increment,
  type DocumentSnapshot 
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { bundleProjectHtml } from './bundler';
import type { GameProject, ProjectAsset, PublishedGame, GameReport } from './types';

export const MAX_PUBLISHED_SIZE_BYTES = 900 * 1024; // 900 KB limit for Firestore doc safety
export const MAX_PUBLISH_PER_HOUR = 10;
const LOCAL_PUBLISHED_PREFIX = 'levelo_published_';
const LOCAL_RATE_LIMIT_PREFIX = 'levelo_publish_rl_';

/**
 * Generates a clean URL slug from project title + 4 random chars
 * e.g., "Neon Cyber Runner" -> "neon-cyber-runner-7k2x"
 */
export function generateSlug(title: string): string {
  const sanitized = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 32)
    .replace(/^-|-$/g, '') || 'game';

  const randomChars = Math.random().toString(36).substring(2, 6);
  return `${sanitized}-${randomChars}`;
}

/**
 * Enforces per-user publish rate limit (max 10 per hour).
 */
export async function checkAndRecordPublishRateLimit(userId: string): Promise<boolean> {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  if (isFirebaseConfigured && db) {
    try {
      const rlDocRef = doc(db, 'publish_ratelimits', userId);
      const snap = await getDoc(rlDocRef);
      let timestamps: number[] = [];

      if (snap.exists()) {
        const data = snap.data();
        timestamps = (data.timestamps || []).filter((t: number) => t > oneHourAgo);
      }

      if (timestamps.length >= MAX_PUBLISH_PER_HOUR) {
        return false;
      }

      timestamps.push(now);
      await setDoc(rlDocRef, { timestamps, updatedAt: serverTimestamp() });
      return true;
    } catch (err) {
      console.warn('Firestore rate limit check failed, falling back to local check:', err);
    }
  }

  // Local fallback rate limit
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_RATE_LIMIT_PREFIX + userId);
      let timestamps: number[] = raw ? JSON.parse(raw) : [];
      timestamps = timestamps.filter((t) => t > oneHourAgo);

      if (timestamps.length >= MAX_PUBLISH_PER_HOUR) {
        return false;
      }

      timestamps.push(now);
      localStorage.setItem(LOCAL_RATE_LIMIT_PREFIX + userId, JSON.stringify(timestamps));
      return true;
    } catch {}
  }

  return true;
}

/**
 * Publishes or republishes a game project snapshot to Firestore "published".
 */
export async function publishProject(
  project: GameProject,
  assets: ProjectAsset[],
  options: {
    description?: string;
    authorName?: string;
    isPublic?: boolean;
    existingSlug?: string;
  } = {}
): Promise<PublishedGame> {
  const isAllowed = await checkAndRecordPublishRateLimit(project.ownerId);
  if (!isAllowed) {
    throw new Error(
      `Publish rate limit reached (max ${MAX_PUBLISH_PER_HOUR} publishes per hour). Please try again later.`
    );
  }

  const slug = options.existingSlug || generateSlug(project.title);
  const bundledHtml = bundleProjectHtml(project.files, assets);
  const now = new Date().toISOString();

  const publishedGame: PublishedGame = {
    slug,
    projectId: project.id,
    ownerId: project.ownerId,
    title: project.title.trim() || 'Untitled Game',
    description: options.description?.trim() || `Play ${project.title} on Levelo!`,
    authorName: options.authorName?.trim() || 'Game Creator',
    thumbnail: project.thumbnail || undefined,
    files: project.files,
    bundledHtml,
    plays: 0,
    isPublic: options.isPublic !== undefined ? options.isPublic : true,
    size: new Blob([bundledHtml]).size,
    createdAt: now,
    updatedAt: now,
  };

  if (publishedGame.size > MAX_PUBLISHED_SIZE_BYTES) {
    throw new Error(
      `Game snapshot (${(publishedGame.size / 1024).toFixed(0)} KB) exceeds the 900 KB limit. Consider compressing sprites/audio in the Assets tab.`
    );
  }

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'published', slug);
      const existingSnap = await getDoc(docRef);
      const existingPlays = existingSnap.exists() ? existingSnap.data()?.plays || 0 : 0;
      const existingCreatedAt = existingSnap.exists() ? existingSnap.data()?.createdAt : serverTimestamp();

      await setDoc(docRef, {
        slug: publishedGame.slug,
        projectId: publishedGame.projectId,
        ownerId: publishedGame.ownerId,
        title: publishedGame.title,
        description: publishedGame.description,
        authorName: publishedGame.authorName,
        thumbnail: publishedGame.thumbnail || null,
        files: publishedGame.files,
        bundledHtml: publishedGame.bundledHtml,
        plays: existingPlays,
        isPublic: publishedGame.isPublic,
        size: publishedGame.size,
        createdAt: existingCreatedAt,
        updatedAt: serverTimestamp(),
      });

      publishedGame.plays = existingPlays;
      return publishedGame;
    } catch (err: any) {
      console.warn('Firestore publish failed, saving locally:', err);
      throw new Error(err.message || 'Failed to publish game to cloud.');
    }
  }

  // Local storage fallback for dev / offline
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_PUBLISHED_PREFIX + slug, JSON.stringify(publishedGame));
      localStorage.setItem(`levelo_proj_slug_${project.id}`, slug);
    } catch (storageErr) {
      console.warn('LocalStorage full for published game:', storageErr);
    }
  }

  return publishedGame;
}

/**
 * Unpublishes a game (removes from published collection).
 */
export async function unpublishGame(slug: string, ownerId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'published', slug);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data()?.ownerId === ownerId) {
        await deleteDoc(docRef);
      }
    } catch (err) {
      console.warn('Firestore unpublish failed:', err);
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_PUBLISHED_PREFIX + slug);
  }
}

/**
 * Fetches published game snapshot by slug.
 */
export async function fetchPublishedGame(slug: string): Promise<PublishedGame | null> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'published', slug);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          slug: snap.id,
          projectId: data.projectId,
          ownerId: data.ownerId,
          title: data.title || 'Untitled Game',
          description: data.description || '',
          authorName: data.authorName || 'Game Creator',
          thumbnail: data.thumbnail || undefined,
          files: data.files || { 'index.html': '' },
          bundledHtml: data.bundledHtml || '',
          plays: data.plays || 0,
          isPublic: data.isPublic !== false,
          size: data.size || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Firestore fetchPublishedGame failed, checking local:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_PUBLISHED_PREFIX + slug);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }

  return null;
}

/**
 * Finds if a project has an existing published slug.
 */
export async function fetchPublishedSlugByProjectId(projectId: string): Promise<PublishedGame | null> {
  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'published');
      const q = query(colRef, where('projectId', '==', projectId), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        return {
          slug: d.id,
          projectId: data.projectId,
          ownerId: data.ownerId,
          title: data.title,
          description: data.description,
          authorName: data.authorName,
          thumbnail: data.thumbnail || undefined,
          files: data.files,
          bundledHtml: data.bundledHtml,
          plays: data.plays || 0,
          isPublic: data.isPublic !== false,
          size: data.size || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };
      }
    } catch (err) {
      console.warn('Firestore fetchPublishedSlugByProjectId error:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const slug = localStorage.getItem(`levelo_proj_slug_${projectId}`);
    if (slug) {
      return fetchPublishedGame(slug);
    }
  }

  return null;
}

/**
 * Increments play count for a game once per browser session.
 */
export async function recordGamePlay(slug: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const sessionKey = `levelo_played_${slug}`;
  if (sessionStorage.getItem(sessionKey)) {
    return; // Already counted in this browser session
  }

  sessionStorage.setItem(sessionKey, '1');

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'published', slug);
      await updateDoc(docRef, {
        plays: increment(1),
      });
    } catch (err) {
      console.warn('Failed to increment play count:', err);
    }
  }
}

/**
 * Fetches public games for the /explore page with sorting and pagination.
 */
export async function fetchExploreGames(
  sortBy: 'newest' | 'popular' = 'newest',
  pageSize = 12,
  cursor?: DocumentSnapshot
): Promise<{ games: PublishedGame[]; lastDoc?: DocumentSnapshot; hasMore: boolean }> {
  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'published');
      let q = query(
        colRef,
        where('isPublic', '==', true),
        orderBy(sortBy === 'popular' ? 'plays' : 'createdAt', 'desc'),
        limit(pageSize)
      );

      if (cursor) {
        q = query(
          colRef,
          where('isPublic', '==', true),
          orderBy(sortBy === 'popular' ? 'plays' : 'createdAt', 'desc'),
          startAfter(cursor),
          limit(pageSize)
        );
      }

      const snap = await getDocs(q);
      const results: PublishedGame[] = [];
      snap.forEach((d) => {
        const data = d.data();
        results.push({
          slug: d.id,
          projectId: data.projectId,
          ownerId: data.ownerId,
          title: data.title || 'Untitled Game',
          description: data.description || '',
          authorName: data.authorName || 'Creator',
          thumbnail: data.thumbnail || undefined,
          files: data.files || { 'index.html': '' },
          bundledHtml: data.bundledHtml || '',
          plays: data.plays || 0,
          isPublic: true,
          size: data.size || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
        });
      });

      const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : undefined;
      return {
        games: results,
        lastDoc,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (err) {
      console.warn('Firestore fetchExploreGames error:', err);
    }
  }

  // Local fallback for dev
  if (typeof window !== 'undefined') {
    const list: PublishedGame[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_PUBLISHED_PREFIX)) {
        try {
          const item: PublishedGame = JSON.parse(localStorage.getItem(k) || '');
          if (item && item.isPublic) {
            list.push(item);
          }
        } catch {}
      }
    }
    list.sort((a, b) => (sortBy === 'popular' ? b.plays - a.plays : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    return {
      games: list.slice(0, pageSize),
      hasMore: list.length > pageSize,
    };
  }

  return { games: [], hasMore: false };
}

/**
 * Submits a safety report for a published game.
 */
export async function submitGameReport(report: Omit<GameReport, 'id' | 'createdAt'>): Promise<void> {
  const reportId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'rep_' + Date.now();

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'reports', reportId);
      await setDoc(docRef, {
        slug: report.slug,
        gameTitle: report.gameTitle || null,
        reason: report.reason,
        details: report.details || null,
        reporterId: report.reporterId || null,
        createdAt: serverTimestamp(),
      });
      return;
    } catch (err) {
      console.warn('Firestore submitGameReport error:', err);
    }
  }

  console.info('Game report logged:', { reportId, ...report });
}
