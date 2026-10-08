import type { AIProviderId } from './providers/types';

export type ModelHealthStatus = 'works' | 'paid_only' | 'quota_used_up' | 'busy' | 'not_available';

export interface ModelStatusInfo {
  provider: AIProviderId;
  model: string;
  status: ModelHealthStatus;
  label: 'Works' | 'Paid only' | 'Quota used up' | 'Busy' | 'Not available';
  latencyMs?: number;
  lastChecked: number;
  error?: string;
}

export const STATUS_LABELS: Record<ModelHealthStatus, ModelStatusInfo['label']> = {
  works: 'Works',
  paid_only: 'Paid only',
  quota_used_up: 'Quota used up',
  busy: 'Busy',
  not_available: 'Not available'
};

export const STATUS_COLORS: Record<ModelHealthStatus, { bg: string; text: string; border: string }> = {
  works: { bg: 'bg-emerald-950/50', text: 'text-emerald-400', border: 'border-emerald-700/60' },
  paid_only: { bg: 'bg-amber-950/50', text: 'text-amber-400', border: 'border-amber-700/60' },
  quota_used_up: { bg: 'bg-rose-950/50', text: 'text-rose-400', border: 'border-rose-700/60' },
  busy: { bg: 'bg-orange-950/50', text: 'text-orange-400', border: 'border-orange-700/60' },
  not_available: { bg: 'bg-slate-900', text: 'text-slate-400', border: 'border-slate-800' }
};

const STORAGE_KEY = 'levelo_model_statuses_v2';
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function getStatusCacheKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}

export function getAllCachedModelStatuses(): Record<string, ModelStatusInfo> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getCachedModelStatus(provider: string, model: string): ModelStatusInfo | null {
  const all = getAllCachedModelStatuses();
  return all[getStatusCacheKey(provider, model)] || all[model] || null;
}

export function saveModelStatus(info: ModelStatusInfo): void {
  if (typeof window === 'undefined') return;
  try {
    const cached = getAllCachedModelStatuses();
    const key = getStatusCacheKey(info.provider, info.model);
    cached[key] = info;
    // Also save under bare model name for backward compatibility
    cached[info.model] = info;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {}
}

export function isModelStatusStale(lastChecked?: number): boolean {
  if (!lastChecked) return true;
  return Date.now() - lastChecked > REFRESH_INTERVAL_MS;
}

export async function probeModelStatus(
  provider: AIProviderId,
  model: string,
  apiKey?: string,
  baseUrl?: string
): Promise<ModelStatusInfo> {
  const start = Date.now();
  try {
    const res = await fetch('/api/ai/probe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-provider': provider,
        ...(apiKey ? { 'x-ai-key': apiKey } : {}),
        ...(baseUrl ? { 'x-ai-base-url': baseUrl } : {})
      },
      body: JSON.stringify({ provider, model, baseUrl })
    });

    const data = await res.json().catch(() => ({}));
    const latencyMs = Date.now() - start;

    const info: ModelStatusInfo = {
      provider,
      model,
      status: (data.status as ModelHealthStatus) || 'not_available',
      label: (data.label as ModelStatusInfo['label']) || STATUS_LABELS[data.status as ModelHealthStatus] || 'Not available',
      latencyMs,
      lastChecked: Date.now(),
      error: data.error
    };

    saveModelStatus(info);
    return info;
  } catch (err: any) {
    const info: ModelStatusInfo = {
      provider,
      model,
      status: 'not_available',
      label: 'Not available',
      latencyMs: Date.now() - start,
      lastChecked: Date.now(),
      error: err?.message
    };
    saveModelStatus(info);
    return info;
  }
}

export async function checkProviderModels(
  provider: AIProviderId,
  models: string[],
  apiKey?: string,
  baseUrl?: string,
  force = false
): Promise<Record<string, ModelStatusInfo>> {
  const cached = getAllCachedModelStatuses();
  const results: Record<string, ModelStatusInfo> = { ...cached };

  const toCheck = models.filter((m) => {
    const key = getStatusCacheKey(provider, m);
    return force || !cached[key] || isModelStatusStale(cached[key]?.lastChecked);
  });

  await Promise.allSettled(
    toCheck.map(async (m) => {
      const res = await probeModelStatus(provider, m, apiKey, baseUrl);
      results[getStatusCacheKey(provider, m)] = res;
    })
  );

  return results;
}

/**
 * Re-sort models with real probe results:
 * Group Works / healthy free-tier models first, then paid, then busy, then not available.
 */
export function sortModelsByHealth(
  models: Array<{ id: string; name: string; isFree?: boolean }>,
  provider: string,
  statuses: Record<string, ModelStatusInfo>
) {
  const scoreMap: Record<ModelHealthStatus, number> = {
    works: 0,
    paid_only: 1,
    busy: 2,
    quota_used_up: 3,
    not_available: 4
  };

  return [...models].sort((a, b) => {
    const keyA = getStatusCacheKey(provider, a.id);
    const keyB = getStatusCacheKey(provider, b.id);
    const statusA = statuses[keyA]?.status || statuses[a.id]?.status;
    const statusB = statuses[keyB]?.status || statuses[b.id]?.status;

    const scoreA = statusA ? scoreMap[statusA] : (a.isFree ? 0 : 1);
    const scoreB = statusB ? scoreMap[statusB] : (b.isFree ? 0 : 1);

    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    return a.name.localeCompare(b.name);
  });
}
