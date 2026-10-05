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
} as const;

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
        // Copy to new key if not already set
        if (localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, legacyValue);
        }
      }
    }
    localStorage.setItem(STORAGE_KEYS.MIGRATION_DONE, 'true');
  } catch (err) {
    // Ignore localStorage access errors (e.g. incognito restrictions)
  }
}
