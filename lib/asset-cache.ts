/**
 * Levelo IndexedDB Asset Cache
 * Provides instant local caching of binary asset payloads and thumbnails.
 */

import type { ProjectAsset } from './types';

const DB_NAME = 'levelo_asset_cache_db';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available on server'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
            store.createIndex('projectId', 'projectId', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }
  return dbPromise;
}

export async function cacheAsset(asset: ProjectAsset): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const cacheKey = `${asset.projectId}:${asset.id}`;
    store.put({
      cacheKey,
      ...asset,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to cache asset in IndexedDB:', err);
  }
}

export async function cacheAssets(assets: ProjectAsset[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const asset of assets) {
      const cacheKey = `${asset.projectId}:${asset.id}`;
      store.put({
        cacheKey,
        ...asset,
      });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to bulk cache assets:', err);
  }
}

export async function getCachedAssetsForProject(projectId: string): Promise<ProjectAsset[]> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('projectId');
    const request = index.getAll(projectId);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results: ProjectAsset[] = (request.result || []).map((item: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { cacheKey, ...asset } = item;
          return asset as ProjectAsset;
        });
        resolve(results);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeCachedAsset(projectId: string, assetId: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const cacheKey = `${projectId}:${assetId}`;
    store.delete(cacheKey);
  } catch (err) {
    console.warn('Failed to delete cached asset:', err);
  }
}
