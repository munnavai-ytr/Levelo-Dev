import type { AIProviderId, AIProviderMeta, NormalizedAIError } from './types';

export * from './types';

export const AI_PROVIDERS_CONFIG: Record<AIProviderId, AIProviderMeta> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'High-speed reasoning and code synthesis by Google DeepMind with long-context windows.',
    defaultModel: 'gemini-3.8-flash',
    websiteUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIzaSy...',
    presetModels: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Next-gen workhorse model: ultra-fast and intelligent' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', description: 'Complex STEM, advanced coding and game logic reasoning' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', description: 'Lightweight, ultra-low latency model' },
    ]
  },
  groq: {
    id: 'groq',
    name: 'Groq LPU',
    description: 'Ultra-low latency inference engine powered by custom LPU hardware.',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    websiteUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    presetModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: 'State-of-the-art open model with 128k context on Groq LPU' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'Fastest generation speed (approx. 800+ tokens/sec)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B 32k', description: 'MoE architecture with broad general knowledge' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', description: 'Google high-performing open model running on Groq' },
    ]
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified gateway to hundreds of frontier and community open-source models.',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    websiteUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
    presetModels: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', isFree: true, description: 'High-capability 70B model free tier' },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp (Free)', isFree: true, description: 'Experimental multimodal flash model' },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', isFree: true, description: 'Lightweight instruction-tuned model' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 Chat', description: 'Powerful general purpose coding model' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Frontier code generation and spatial design' },
    ]
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'European frontier AI lab with dedicated Codestral models for programming.',
    defaultModel: 'codestral-latest',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    websiteUrl: 'https://console.mistral.ai/api-keys',
    keyPlaceholder: 'Secret key...',
    presetModels: [
      { id: 'codestral-latest', name: 'Codestral Latest', description: 'Mistral flagship model dedicated to code generation (256k context)' },
      { id: 'mistral-small-latest', name: 'Mistral Small Latest', description: 'High-performance cost-efficient reasoning model' },
      { id: 'mistral-large-latest', name: 'Mistral Large Latest', description: 'Top-tier frontier reasoning and instruction following' },
      { id: 'open-mistral-nemo', name: 'Mistral Nemo (12B)', description: 'Apache 2.0 licensed 12B model' },
    ]
  },
  custom: {
    id: 'custom',
    name: 'Custom Endpoint',
    description: 'Connect any OpenAI-compatible API (Ollama, Together AI, LM Studio, vLLM).',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresBaseUrl: true,
    websiteUrl: '',
    keyPlaceholder: 'API Key (or leave empty if local)...',
    presetModels: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast, lightweight OpenAI model' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Flagship multimodal omni model' },
      { id: 'qwen2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', description: 'Specialized programming model' },
    ]
  }
};

export const PROVIDER_IDS: AIProviderId[] = ['gemini', 'groq', 'openrouter', 'mistral', 'custom'];

export function normalizeAIError(error: any, provider?: AIProviderId): NormalizedAIError {
  const status = error?.status || error?.code || error?.statusCode || 500;
  const rawMsg = String(error?.message || error?.error?.message || error || '').trim();

  // Rate limit / Quota exceeded
  if (
    status === 429 ||
    rawMsg.includes('429') ||
    rawMsg.toLowerCase().includes('quota') ||
    rawMsg.includes('RESOURCE_EXHAUSTED') ||
    rawMsg.toLowerCase().includes('rate limit')
  ) {
    return {
      type: 'rate_limit',
      message: `Quota reached on ${provider ? AI_PROVIDERS_CONFIG[provider]?.name : 'AI provider'}. Please wait a moment or check your key limits.`,
      statusCode: 429
    };
  }

  // Invalid key / unauthorized
  if (
    status === 401 ||
    status === 403 ||
    rawMsg.includes('API_KEY_INVALID') ||
    rawMsg.includes('API key not valid') ||
    rawMsg.toLowerCase().includes('unauthorized') ||
    rawMsg.toLowerCase().includes('authentication')
  ) {
    return {
      type: 'invalid_key',
      message: `Invalid API key for ${provider ? AI_PROVIDERS_CONFIG[provider]?.name : 'provider'}. Check your settings.`,
      statusCode: 401
    };
  }

  // Billing required
  if (
    rawMsg.toLowerCase().includes('billing') ||
    rawMsg.toLowerCase().includes('credit') ||
    rawMsg.toLowerCase().includes('payment')
  ) {
    return {
      type: 'billing_required',
      message: `Billing/Credits required for this model on ${provider ? AI_PROVIDERS_CONFIG[provider]?.name : 'provider'}.`,
      statusCode: 402
    };
  }

  // Model not found / deprecated
  if (
    status === 404 ||
    rawMsg.includes('404') ||
    rawMsg.toLowerCase().includes('not found') ||
    rawMsg.toLowerCase().includes('does not exist') ||
    rawMsg.toLowerCase().includes('no longer available')
  ) {
    return {
      type: 'model_not_found',
      message: `Model is not available or has been retired by ${provider ? AI_PROVIDERS_CONFIG[provider]?.name : 'provider'}.`,
      statusCode: 404
    };
  }

  // Overloaded / 503
  if (
    status === 503 ||
    rawMsg.includes('503') ||
    rawMsg.toLowerCase().includes('overloaded') ||
    rawMsg.toLowerCase().includes('high demand') ||
    rawMsg.toLowerCase().includes('unavailable')
  ) {
    return {
      type: 'overloaded',
      message: `${provider ? AI_PROVIDERS_CONFIG[provider]?.name : 'Service'} is currently overloaded. Retrying or switching models...`,
      statusCode: 503
    };
  }

  // Short generic error message (never expose full raw stack trace)
  const shortMsg = rawMsg.length > 120 ? rawMsg.slice(0, 120) + '...' : rawMsg;
  return {
    type: 'generic',
    message: shortMsg || 'AI generation failed. Please try again.',
    statusCode: typeof status === 'number' && status >= 400 && status < 600 ? status : 500
  };
}

// Unified interface implementations
import { listGeminiModels, probeGeminiModel, streamGemini } from './gemini';
import { listOpenAICompatibleModels, probeOpenAICompatibleModel, streamOpenAICompatible } from './openai-compatible';
import type { ProviderModelInfo, ProviderProbeResult, StreamGenerateParams } from './types';

export async function listModels(
  provider: AIProviderId,
  apiKey: string,
  customBaseUrl?: string
): Promise<{ valid: boolean; models: ProviderModelInfo[]; error?: string }> {
  if (provider === 'gemini') {
    return listGeminiModels(apiKey);
  }
  return listOpenAICompatibleModels(apiKey, provider, customBaseUrl);
}

export async function probeModel(
  provider: AIProviderId,
  apiKey: string,
  model: string,
  customBaseUrl?: string
): Promise<ProviderProbeResult> {
  if (provider === 'gemini') {
    return probeGeminiModel(apiKey, model);
  }
  return probeOpenAICompatibleModel(apiKey, model, provider, customBaseUrl);
}

export async function* streamGenerate(
  params: StreamGenerateParams & { provider: AIProviderId },
  systemPrompt: string
): AsyncGenerator<string, void, unknown> {
  if (params.provider === 'gemini') {
    yield* streamGemini(params, systemPrompt);
  } else {
    yield* streamOpenAICompatible(params, params.provider, systemPrompt);
  }
}

