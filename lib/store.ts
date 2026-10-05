import { create } from 'zustand';
import type { GameProject, DeviceMode, ChatMessage } from './types';
import type { LocalUser } from './firebase';
import { STORAGE_KEYS, runStorageMigration } from './storage-migration';

interface AuthUserState {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AppStore {
  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // Auth State
  user: AuthUserState | null;
  isAuthLoading: boolean;
  setUser: (user: AuthUserState | null) => void;
  setIsAuthLoading: (loading: boolean) => void;

  // Workspace Tabs & Layout
  activeTab: 'preview' | 'code' | 'files';
  setActiveTab: (tab: 'preview' | 'code' | 'files') => void;
  mobileTab: 'chat' | 'preview' | 'code';
  setMobileTab: (tab: 'chat' | 'preview' | 'code') => void;
  
  // Preview Controls
  deviceMode: DeviceMode;
  setDeviceMode: (mode: DeviceMode) => void;
  isLandscape: boolean;
  setIsLandscape: (isLandscape: boolean) => void;
  toggleOrientation: () => void;

  // Current Project
  currentProject: GameProject | null;
  setCurrentProject: (proj: GameProject | null) => void;
  updateCurrentHtml: (newHtml: string) => void;

  // Save status
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  lastSavedAt: string | null;
  setLastSavedAt: (time: string | null) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;

  // Gemini Settings
  geminiApiKey: string;
  geminiModel: string;
  setGeminiApiKey: (key: string) => void;
  setGeminiModel: (model: string) => void;
}

const getCachedUser = (): AuthUserState | null => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('levelo_cached_auth_user');
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return null;
};

const initialCachedUser = typeof window !== 'undefined' ? getCachedUser() : null;

export const useAppStore = create<AppStore>((set, get) => ({
  // Theme defaults to dark as requested
  theme: 'dark',
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      runStorageMigration();
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    set({ theme });
  },
  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  // Auth - initialize with cached user for instant app shell
  user: initialCachedUser,
  isAuthLoading: initialCachedUser === null,
  setUser: (user) => {
    if (typeof window !== 'undefined') {
      try {
        if (user) {
          localStorage.setItem('levelo_cached_auth_user', JSON.stringify(user));
        } else {
          localStorage.removeItem('levelo_cached_auth_user');
        }
      } catch {}
    }
    set({ user, isAuthLoading: false });
  },
  setIsAuthLoading: (isAuthLoading) => set({ isAuthLoading }),

  // Tabs
  activeTab: 'preview',
  setActiveTab: (activeTab) => set({ activeTab }),
  mobileTab: 'preview',
  setMobileTab: (mobileTab) => set({ mobileTab }),

  // Device
  deviceMode: 'desktop',
  setDeviceMode: (deviceMode) => set({ deviceMode }),
  isLandscape: false,
  setIsLandscape: (isLandscape) => set({ isLandscape }),
  toggleOrientation: () => set((state) => ({ isLandscape: !state.isLandscape })),

  // Current Project
  currentProject: null,
  setCurrentProject: (currentProject) => set({ currentProject }),
  updateCurrentHtml: (newHtml) => {
    const current = get().currentProject;
    if (!current) return;
    const updated = {
      ...current,
      files: {
        ...current.files,
        'index.html': newHtml
      },
      updatedAt: new Date().toISOString()
    };
    set({ currentProject: updated });
  },

  // Saving
  isSaving: false,
  setIsSaving: (isSaving) => set({ isSaving }),
  lastSavedAt: null,
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),

  // Chat
  chatMessages: [
    {
      id: 'welcome_1',
      role: 'assistant',
      content: 'Welcome to Levelo! I am your game development assistant. Describe any mechanic, theme, or game you want to build and I will generate the complete, playable game in real-time.',
      timestamp: Date.now() - 60000,
      tags: ['Levelo Assistant', 'v1.0 Ready']
    }
  ],
  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  clearChat: () => set({ chatMessages: [] }),

  // Gemini Settings
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  setGeminiApiKey: (geminiApiKey) => {
    if (typeof window !== 'undefined') {
      runStorageMigration();
      localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, geminiApiKey);
    }
    set({ geminiApiKey });
  },
  setGeminiModel: (geminiModel) => {
    if (typeof window !== 'undefined') {
      runStorageMigration();
      localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, geminiModel);
    }
    set({ geminiModel });
  }
}));
