import { create } from 'zustand';
import type { GameProject, DeviceMode, ChatMessage } from './types';
import type { LocalUser } from './firebase';
import type { AIProviderId } from './providers/types';
import { 
  STORAGE_KEYS, 
  getProviderKeyStorageName, 
  getProviderModelStorageName, 
  runStorageMigration 
} from './storage-migration';

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
  activeTab: 'preview' | 'code' | 'files' | 'assets';
  setActiveTab: (tab: 'preview' | 'code' | 'files' | 'assets') => void;
  mobileTab: 'chat' | 'preview' | 'code' | 'assets';
  setMobileTab: (tab: 'chat' | 'preview' | 'code' | 'assets') => void;
  
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

  // Multi-Provider AI Settings
  activeProvider: AIProviderId;
  setActiveProvider: (provider: AIProviderId) => void;
  providerKeys: Record<AIProviderId, string>;
  setProviderKey: (provider: AIProviderId, key: string) => void;
  providerModels: Record<AIProviderId, string>;
  setProviderModel: (provider: AIProviderId, model: string) => void;
  customBaseUrl: string;
  setCustomBaseUrl: (url: string) => void;

  // Backward-compatible Gemini getters/setters
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

// Initial state helpers from localStorage
const getInitialProvider = (): AIProviderId => {
  if (typeof window === 'undefined') return 'gemini';
  runStorageMigration();
  return (localStorage.getItem(STORAGE_KEYS.ACTIVE_PROVIDER) as AIProviderId) || 'gemini';
};

const getInitialKeys = (): Record<AIProviderId, string> => {
  if (typeof window === 'undefined') {
    return { gemini: '', groq: '', openrouter: '', mistral: '', custom: '' };
  }
  runStorageMigration();
  return {
    gemini: localStorage.getItem(getProviderKeyStorageName('gemini')) || localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || '',
    groq: localStorage.getItem(getProviderKeyStorageName('groq')) || '',
    openrouter: localStorage.getItem(getProviderKeyStorageName('openrouter')) || '',
    mistral: localStorage.getItem(getProviderKeyStorageName('mistral')) || '',
    custom: localStorage.getItem(getProviderKeyStorageName('custom')) || ''
  };
};

const getInitialModels = (): Record<AIProviderId, string> => {
  if (typeof window === 'undefined') {
    return {
      gemini: 'gemini-3.8-flash',
      groq: 'llama-3.3-70b-versatile',
      openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
      mistral: 'codestral-latest',
      custom: 'gpt-4o-mini'
    };
  }
  runStorageMigration();
  const rawGeminiModel = localStorage.getItem(getProviderModelStorageName('gemini')) || localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || 'gemini-3.8-flash';
  const cleanGemini = rawGeminiModel.includes('2.5') ? 'gemini-3.8-flash' : rawGeminiModel;

  return {
    gemini: cleanGemini,
    groq: localStorage.getItem(getProviderModelStorageName('groq')) || 'llama-3.3-70b-versatile',
    openrouter: localStorage.getItem(getProviderModelStorageName('openrouter')) || 'meta-llama/llama-3.3-70b-instruct:free',
    mistral: localStorage.getItem(getProviderModelStorageName('mistral')) || 'codestral-latest',
    custom: localStorage.getItem(getProviderModelStorageName('custom')) || 'gpt-4o-mini'
  };
};

const initialKeys = getInitialKeys();
const initialModels = getInitialModels();
const initialProvider = getInitialProvider();

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

  // Multi-Provider AI Settings
  activeProvider: initialProvider,
  setActiveProvider: (activeProvider) => {
    if (typeof window !== 'undefined') {
      runStorageMigration();
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROVIDER, activeProvider);
    }
    set({ activeProvider });
  },

  providerKeys: initialKeys,
  setProviderKey: (provider, key) => {
    const trimmed = key.trim();
    if (typeof window !== 'undefined') {
      runStorageMigration();
      localStorage.setItem(getProviderKeyStorageName(provider), trimmed);
      if (provider === 'gemini') {
        localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, trimmed);
      }
    }
    set((state) => ({
      providerKeys: { ...state.providerKeys, [provider]: trimmed },
      ...(provider === 'gemini' ? { geminiApiKey: trimmed } : {})
    }));
  },

  providerModels: initialModels,
  setProviderModel: (provider, model) => {
    const clean = provider === 'gemini' && model.includes('2.5') ? 'gemini-3.8-flash' : model;
    if (typeof window !== 'undefined') {
      runStorageMigration();
      localStorage.setItem(getProviderModelStorageName(provider), clean);
      if (provider === 'gemini') {
        localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, clean);
      }
    }
    set((state) => ({
      providerModels: { ...state.providerModels, [provider]: clean },
      ...(provider === 'gemini' ? { geminiModel: clean } : {})
    }));
  },

  customBaseUrl: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.CUSTOM_BASE_URL) || 'https://api.openai.com/v1' : 'https://api.openai.com/v1',
  setCustomBaseUrl: (customBaseUrl) => {
    const trimmed = customBaseUrl.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_BASE_URL, trimmed);
    }
    set({ customBaseUrl: trimmed });
  },

  // Backward-compatible Gemini getters/setters
  geminiApiKey: initialKeys.gemini,
  geminiModel: initialModels.gemini,
  setGeminiApiKey: (key) => get().setProviderKey('gemini', key),
  setGeminiModel: (model) => get().setProviderModel('gemini', model)
}));
