export type AIProviderId = 'gemini' | 'groq' | 'openrouter' | 'mistral' | 'custom';

export interface ProviderModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  isFree?: boolean;
}

export interface AIProviderMeta {
  id: AIProviderId;
  name: string;
  description: string;
  defaultModel: string;
  defaultBaseUrl?: string;
  requiresBaseUrl?: boolean;
  websiteUrl: string;
  keyPlaceholder: string;
  presetModels: ProviderModelInfo[];
}

export interface StreamGenerateParams {
  model: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  files?: Record<string, string>;
  assets?: Array<{ name: string; path?: string; type: string; mimeType: string; width?: number; height?: number }>;
  errorContext?: any;
  signal?: AbortSignal;
  apiKey?: string;
  customBaseUrl?: string;
}

export interface ProviderProbeResult {
  provider: AIProviderId;
  model: string;
  status: 'works' | 'paid_only' | 'quota_used_up' | 'busy' | 'not_available';
  label: 'Works' | 'Paid only' | 'Quota used up' | 'Busy' | 'Not available';
  latencyMs?: number;
  error?: string;
}

export interface NormalizedAIError {
  type: 'invalid_key' | 'rate_limit' | 'billing_required' | 'overloaded' | 'model_not_found' | 'generic';
  message: string;
  statusCode: number;
}
