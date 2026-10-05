import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  type Auth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { 
  getFirestore, 
  type Firestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  FieldPath,
  deleteField,
  Timestamp 
} from 'firebase/firestore';
import type { GameProject, ProjectVersion, ProjectFiles } from './types';
import { DEFAULT_PHASER_STARTER } from './starter-game';
import { STORAGE_KEYS, runStorageMigration } from './storage-migration';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if all needed env vars are present and non-placeholder
export const missingFirebaseEnvVars: string[] = [];
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('your-')) missingFirebaseEnvVars.push('NEXT_PUBLIC_FIREBASE_API_KEY');
if (!firebaseConfig.authDomain || firebaseConfig.authDomain.includes('your-')) missingFirebaseEnvVars.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
if (!firebaseConfig.projectId || firebaseConfig.projectId.includes('your-')) missingFirebaseEnvVars.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
if (!firebaseConfig.appId || firebaseConfig.appId.includes('your-')) missingFirebaseEnvVars.push('NEXT_PUBLIC_FIREBASE_APP_ID');

export const isFirebaseConfigured = missingFirebaseEnvVars.length === 0;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured && typeof window !== 'undefined') {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    console.error('Failed to initialize Firebase SDK:', err);
  }
}

export { app, auth, db, googleProvider };

// ==========================================
// LOCAL STORAGE FALLBACK FOR DEV/DEMO
// Allows testing full functionality if Firebase credentials are not yet configured
// ==========================================
const LOCAL_STORAGE_KEY = STORAGE_KEYS.LOCAL_PROJECTS;
const LOCAL_USER_KEY = STORAGE_KEYS.DEMO_USER;

export interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export const localAuth = {
  getUser: (): LocalUser | null => {
    if (typeof window === 'undefined') return null;
    runStorageMigration();
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  loginDemo: (name = 'Game Developer', email = 'developer@levelo.ai'): LocalUser => {
    const user: LocalUser = {
      uid: 'demo_user_local_123',
      displayName: name,
      email: email,
      photoURL: null
    };
    if (typeof window !== 'undefined') {
      runStorageMigration();
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    }
    return user;
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
  }
};

export const localProjects = {
  getAll: (ownerId: string): GameProject[] => {
    if (typeof window === 'undefined') return [];
    runStorageMigration();
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    try {
      const list: GameProject[] = JSON.parse(raw);
      return list.filter(p => p.ownerId === ownerId);
    } catch {
      return [];
    }
  },
  getById: (id: string): GameProject | null => {
    if (typeof window === 'undefined') return null;
    runStorageMigration();
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    try {
      const list: GameProject[] = JSON.parse(raw);
      return list.find(p => p.id === id) || null;
    } catch {
      return null;
    }
  },
  save: (project: GameProject) => {
    if (typeof window === 'undefined') return;
    runStorageMigration();
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    let list: GameProject[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {}
    }
    const idx = list.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      list[idx] = project;
    } else {
      list.unshift(project);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  },
  delete: (id: string) => {
    if (typeof window === 'undefined') return;
    runStorageMigration();
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    try {
      const list: GameProject[] = JSON.parse(raw);
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    } catch {}
  }
};

// ==========================================
// UNIFIED PROJECT OPERATIONS (FIRESTORE + LOCAL FALLBACK)
// ==========================================

export async function fetchUserProjects(ownerId: string): Promise<GameProject[]> {
  if (isFirebaseConfigured && db) {
    try {
      const projectsRef = collection(db, 'projects');
      const q = query(
        projectsRef,
        where('ownerId', '==', ownerId),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const results: GameProject[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        results.push({
          id: docSnap.id,
          ownerId: data.ownerId,
          title: data.title || 'Untitled Game',
          files: data.files || { 'index.html': DEFAULT_PHASER_STARTER },
          chatMessages: data.chatMessages || [],
          thumbnail: data.thumbnail || undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString()
        });
      });
      return results;
    } catch (err) {
      console.warn('Firestore fetch failed, checking local storage fallback:', err);
    }
  }
  return localProjects.getAll(ownerId);
}

export const fetchProjects = fetchUserProjects;

export async function fetchProjectById(id: string): Promise<GameProject | null> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'projects', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: snap.id,
          ownerId: data.ownerId,
          title: data.title || 'Untitled Game',
          files: data.files || { 'index.html': DEFAULT_PHASER_STARTER },
          chatMessages: data.chatMessages || [],
          thumbnail: data.thumbnail || undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString()
        };
      }
    } catch (err) {
      console.warn('Firestore getDoc failed, fallback to local storage:', err);
    }
  }
  return localProjects.getById(id);
}

export async function createNewProject(
  ownerId: string, 
  title: string, 
  customHtmlOrFiles?: string | Record<string, string>
): Promise<GameProject> {
  let projectFiles: ProjectFiles;

  if (typeof customHtmlOrFiles === 'string') {
    projectFiles = { 'index.html': customHtmlOrFiles || DEFAULT_PHASER_STARTER };
  } else if (customHtmlOrFiles && typeof customHtmlOrFiles === 'object') {
    projectFiles = {
      'index.html': customHtmlOrFiles['index.html'] || DEFAULT_PHASER_STARTER,
      ...customHtmlOrFiles
    };
  } else {
    projectFiles = { 'index.html': DEFAULT_PHASER_STARTER };
  }

  const newProject: GameProject = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'proj_' + Date.now(),
    ownerId,
    title: title.trim() || 'New Phaser Game',
    files: projectFiles,
    chatMessages: [
      {
        id: 'welcome_' + Date.now(),
        role: 'assistant',
        content: 'Welcome to Levelo! Describe any game mechanic, visual theme, or complete new game you want to build. I will write the code, synthesize audio SFX, and update your game live!',
        timestamp: Date.now(),
        tags: ['Levelo Engine', 'Ready']
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'projects', newProject.id);
      await setDoc(docRef, {
        ownerId: newProject.ownerId,
        title: newProject.title,
        files: newProject.files,
        chatMessages: newProject.chatMessages,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return newProject;
    } catch (err) {
      console.error('Failed to create project in Firestore:', err);
    }
  }

  localProjects.save(newProject);
  return newProject;
}

export async function updateProjectChat(id: string, chatMessages: any[]): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'projects', id);
      await updateDoc(docRef, {
        chatMessages,
        updatedAt: serverTimestamp()
      });
      return;
    } catch (err) {
      console.warn('Firestore updateProjectChat failed, persisting locally:', err);
    }
  }

  const existing = localProjects.getById(id);
  if (existing) {
    existing.chatMessages = chatMessages;
    existing.updatedAt = new Date().toISOString();
    localProjects.save(existing);
  }
}

export async function updateProjectFiles(
  id: string, 
  filesToUpdate: Record<string, string | null | undefined>,
  deletedFiles?: string[]
): Promise<void> {
  const now = new Date().toISOString();
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'projects', id);
      const updates: any = {
        updatedAt: serverTimestamp()
      };

      for (const [fileName, content] of Object.entries(filesToUpdate)) {
        const fp = new FieldPath('files', fileName);
        if (content === null || content === undefined) {
          updates[fp as any] = deleteField();
        } else {
          updates[fp as any] = content;
        }
      }

      if (deletedFiles && deletedFiles.length > 0) {
        for (const fileName of deletedFiles) {
          updates[new FieldPath('files', fileName) as any] = deleteField();
        }
      }

      await updateDoc(docRef, updates);
      return;
    } catch (err) {
      console.warn('Firestore updateDoc failed, persisting locally:', err);
    }
  }

  const existing = localProjects.getById(id);
  if (existing) {
    const updatedFiles = { ...existing.files };
    for (const [fileName, content] of Object.entries(filesToUpdate)) {
      if (content === null || content === undefined) {
        delete updatedFiles[fileName];
      } else {
        updatedFiles[fileName] = content;
      }
    }
    if (deletedFiles) {
      for (const fileName of deletedFiles) {
        delete updatedFiles[fileName];
      }
    }
    existing.files = updatedFiles;
    existing.updatedAt = now;
    localProjects.save(existing);
  }
}

export async function renameProject(id: string, newTitle: string): Promise<void> {
  const now = new Date().toISOString();
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'projects', id);
      await updateDoc(docRef, {
        title: newTitle,
        updatedAt: serverTimestamp()
      });
      return;
    } catch (err) {
      console.warn('Firestore rename failed, persisting locally:', err);
    }
  }

  const existing = localProjects.getById(id);
  if (existing) {
    existing.title = newTitle;
    existing.updatedAt = now;
    localProjects.save(existing);
  }
}

export async function deleteProject(id: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'projects', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Firestore delete failed, deleting locally:', err);
    }
  }
  localProjects.delete(id);
}

// Calculate JSON payload size of files to handle 1MB Firestore limit gracefully
export function getFilesPayloadSize(files: Record<string, string>): number {
  try {
    return new Blob([JSON.stringify(files)]).size;
  } catch {
    return 0;
  }
}

// Version History Management
const LOCAL_VERSIONS_PREFIX = 'levelo_versions_';

export async function createProjectVersion(
  projectId: string,
  files: Record<string, string>,
  label: string,
  source: 'ai' | 'manual' | 'restore',
  prompt?: string
): Promise<ProjectVersion> {
  const version: ProjectVersion = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'ver_' + Date.now(),
    projectId,
    files: { ...files } as ProjectFiles,
    label: label.trim() || 'Snapshot',
    source,
    prompt: prompt || undefined,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    try {
      const versionDocRef = doc(db, 'projects', projectId, 'versions', version.id);
      await setDoc(versionDocRef, {
        files: version.files,
        label: version.label,
        source: version.source,
        prompt: version.prompt || null,
        createdAt: serverTimestamp()
      });
      // Automatically keep the latest 50 versions per project
      pruneOldVersions(projectId).catch(console.warn);
      return version;
    } catch (err) {
      console.warn('Firestore createProjectVersion failed, saving locally:', err);
    }
  }

  // Local storage fallback
  if (typeof window !== 'undefined') {
    const key = LOCAL_VERSIONS_PREFIX + projectId;
    const raw = localStorage.getItem(key);
    let list: ProjectVersion[] = raw ? JSON.parse(raw) : [];
    list.unshift(version);
    if (list.length > 50) list = list.slice(0, 50);
    localStorage.setItem(key, JSON.stringify(list));
  }

  return version;
}

export async function fetchProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  if (isFirebaseConfigured && db) {
    try {
      const versionsCol = collection(db, 'projects', projectId, 'versions');
      const q = query(versionsCol, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const results: ProjectVersion[] = [];
      snap.forEach((d) => {
        const data = d.data();
        results.push({
          id: d.id,
          projectId,
          files: data.files,
          label: data.label || 'Snapshot',
          source: data.source || 'manual',
          prompt: data.prompt || undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString()
        });
      });
      return results;
    } catch (err) {
      console.warn('Firestore fetchProjectVersions failed, fallback to local:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_VERSIONS_PREFIX + projectId);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }
  return [];
}

export async function pruneOldVersions(projectId: string): Promise<void> {
  const MAX_VERSIONS = 50;
  if (isFirebaseConfigured && db) {
    try {
      const versionsCol = collection(db, 'projects', projectId, 'versions');
      const q = query(versionsCol, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (snap.size > MAX_VERSIONS) {
        const docsToDelete = snap.docs.slice(MAX_VERSIONS);
        for (const d of docsToDelete) {
          await deleteDoc(d.ref);
        }
      }
    } catch (err) {
      console.warn('Failed to prune Firestore versions:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const key = LOCAL_VERSIONS_PREFIX + projectId;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        let list: ProjectVersion[] = JSON.parse(raw);
        if (list.length > MAX_VERSIONS) {
          localStorage.setItem(key, JSON.stringify(list.slice(0, MAX_VERSIONS)));
        }
      } catch {}
    }
  }
}

export async function updateProjectThumbnail(id: string, thumbnail: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'projects', id);
      await updateDoc(docRef, {
        thumbnail,
        updatedAt: serverTimestamp()
      });
      return;
    } catch (err) {
      console.warn('Firestore updateProjectThumbnail failed, updating locally:', err);
    }
  }

  const existing = localProjects.getById(id);
  if (existing) {
    existing.thumbnail = thumbnail;
    localProjects.save(existing);
  }
}

export async function duplicateProject(
  sourceId: string, 
  ownerId: string, 
  newTitle: string
): Promise<GameProject> {
  const source = await fetchProjectById(sourceId);
  const filesToCopy = source ? source.files : { 'index.html': DEFAULT_PHASER_STARTER };
  return createNewProject(ownerId, newTitle, filesToCopy);
}

export async function bulkDeleteProjects(projectIds: string[]): Promise<void> {
  for (const id of projectIds) {
    await deleteProject(id);
  }
}
