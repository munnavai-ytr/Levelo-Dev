/**
 * Levelo Storage Key Migration Utility
 * Migrates old legacy storage keys to "levelo_*" keys
 * Ensures existing users seamlessly retain their saved Gemini API keys, models, projects, and themes.
 */

export const STORAGE_KEYS = {
  THEME: 'levelo_theme',
  GEMINI_API_KEY: 'levelo_gemini_api_key',
  GEMINI_MODEL: 'levelo_gemini_model',
  CACHED_MODELS: 'levelo_cached_models',
  LOCAL_PROJECTS: 'levelo_local_projects_v1',
  DEMO_USER: 'levelo_demo_user',
  MIGRATION_DONE: 'levelo_keys_migrated_v1',
  ACTIVE_PROVIDER: 'levelo_active_provider',
  CUSTOM_BASE_URL: 'levelo_custom_base_url',
} as const;

export function getProviderKeyStorageName(provider: string): string {
  return `levelo_key_${provider}`;
}

export function getProviderModelStorageName(provider: string): string {
  return `levelo_model_${provider}`;
}

const LEGACY_KEY_MAPPING: Record<string, string> = {
  'gameforge_theme': STORAGE_KEYS.THEME,
  'gameforge_gemini_api_key': STORAGE_KEYS.GEMINI_API_KEY,
  'gameforge_gemini_model': STORAGE_KEYS.GEMINI_MODEL,
  'gameforge_cached_models': STORAGE_KEYS.CACHED_MODELS,
  'gameforge_local_projects_v1': STORAGE_KEYS.LOCAL_PROJECTS,
  'gameforge_demo_user': STORAGE_KEYS.DEMO_USER,
};

export function runStorageMigration(): void {
  if (typeof window === 'undefined') return;

  try {
    for (const [legacyKey, newKey] of Object.entries(LEGACY_KEY_MAPPING)) {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue !== null) {
        if (localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, legacyValue);
        }
      }
    }

    // Sync legacy gemini key to provider-specific key
    const geminiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY);
    if (geminiKey && !localStorage.getItem(getProviderKeyStorageName('gemini'))) {
      localStorage.setItem(getProviderKeyStorageName('gemini'), geminiKey);
    }
    const geminiKeyFromProvider = localStorage.getItem(getProviderKeyStorageName('gemini'));
    if (geminiKeyFromProvider && !localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY)) {
      localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, geminiKeyFromProvider);
    }

    // Migrate any deprecated Gemini models
    const currentModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL);
    if (!currentModel || currentModel.includes('2.5') || currentModel.includes('2.0') || currentModel.includes('1.5')) {
      localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, 'gemini-3.8-flash');
      localStorage.setItem(getProviderModelStorageName('gemini'), 'gemini-3.8-flash');
    }

    localStorage.setItem(STORAGE_KEYS.MIGRATION_DONE, 'true');
  } catch (err) {
    // Ignore localStorage access errors
  }
}
