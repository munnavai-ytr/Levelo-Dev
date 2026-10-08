import type { 
  AIProviderId, 
  ProviderModelInfo, 
  ProviderProbeResult, 
  StreamGenerateParams 
} from './types';
import { normalizeAIError } from './index';

export function getProviderBaseUrl(provider: AIProviderId, customUrl?: string): string {
  if (provider === 'groq') return 'https://api.groq.com/openai/v1';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (provider === 'mistral') return 'https://api.mistral.ai/v1';
  if (provider === 'custom') {
    const raw = (customUrl || '').trim();
    if (!raw) return 'https://api.openai.com/v1';
    return raw.replace(/\/+$/, '');
  }
  return '';
}

export async function listOpenAICompatibleModels(
  apiKey: string,
  provider: AIProviderId,
  customBaseUrl?: string
): Promise<{ valid: boolean; models: ProviderModelInfo[]; error?: string }> {
  const baseUrl = getProviderBaseUrl(provider, customBaseUrl);
  if (!baseUrl) {
    return { valid: false, models: [], error: 'Invalid or missing API endpoint URL' };
  }

  try {
    const url = `${baseUrl}/models`;
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://levelo.ai';
      headers['X-Title'] = 'Levelo Game Builder';
    }

    const res = await fetch(url, { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = normalizeAIError(data?.error || data, provider);
      return { valid: false, models: [], error: err.message };
    }

    const rawList = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    
    const models: ProviderModelInfo[] = rawList
      .filter((m: any) => typeof m?.id === 'string' && m.id.length > 0)
      .map((m: any) => {
        const id = m.id;
        const name = m.name || m.id;
        const isFree = id.includes(':free') || m.pricing?.prompt === 0;
        return {
          id,
          name,
          description: m.description || (isFree ? 'Free Tier Model' : undefined),
          contextLength: m.context_length || undefined,
          isFree
        };
      })
      // Free and popular models first
      .sort((a, b) => {
        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;
        return a.name.localeCompare(b.name);
      });

    return { valid: true, models };
  } catch (err: any) {
    const normalized = normalizeAIError(err, provider);
    return { valid: false, models: [], error: normalized.message };
  }
}

export async function probeOpenAICompatibleModel(
  apiKey: string,
  model: string,
  provider: AIProviderId,
  customBaseUrl?: string
): Promise<ProviderProbeResult> {
  const baseUrl = getProviderBaseUrl(provider, customBaseUrl);
  const start = Date.now();

  if (!baseUrl) {
    return {
      provider,
      model,
      status: 'not_available',
      label: 'Not available',
      error: 'Base URL not configured',
      latencyMs: 0
    };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://levelo.ai';
      headers['X-Title'] = 'Levelo Game Builder';
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1
      })
    });

    const latencyMs = Date.now() - start;
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      return {
        provider,
        model,
        status: 'works',
        label: 'Works',
        latencyMs
      };
    }

    const norm = normalizeAIError(data?.error || data, provider);

    if (norm.type === 'rate_limit') {
      return { provider, model, status: 'quota_used_up', label: 'Quota used up', latencyMs, error: norm.message };
    }
    if (norm.type === 'billing_required') {
      return { provider, model, status: 'paid_only', label: 'Paid only', latencyMs, error: norm.message };
    }
    if (norm.type === 'overloaded') {
      return { provider, model, status: 'busy', label: 'Busy', latencyMs, error: norm.message };
    }
    if (norm.type === 'model_not_found') {
      return { provider, model, status: 'not_available', label: 'Not available', latencyMs, error: norm.message };
    }

    return {
      provider,
      model,
      status: 'busy',
      label: 'Busy',
      latencyMs,
      error: norm.message
    };
  } catch (err: any) {
    return {
      provider,
      model,
      status: 'not_available',
      label: 'Not available',
      latencyMs: Date.now() - start,
      error: err?.message || 'Connection failed'
    };
  }
}

export async function* streamOpenAICompatible(
  params: StreamGenerateParams,
  provider: AIProviderId,
  systemPrompt: string
): AsyncGenerator<string, void, unknown> {
  const baseUrl = getProviderBaseUrl(provider, params.customBaseUrl);
  if (!baseUrl) {
    throw new Error(`Endpoint URL is not configured for provider ${provider}`);
  }

  // Format all project files into multi-file prompt context
  let filesContext = '';
  if (params.files && typeof params.files === 'object') {
    for (const [filePath, content] of Object.entries(params.files)) {
      const ext = filePath.split('.').pop() || 'txt';
      filesContext += `\nFile: ${filePath}\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
    }
  }
  if (!filesContext.trim()) {
    filesContext = '\n(Project is currently empty. Provide index.html and any companion scripts/styles.)\n';
  }

  let assetsContext = '';
  if (params.assets && Array.isArray(params.assets) && params.assets.length > 0) {
    assetsContext = '\n\n[AVAILABLE PROJECT ASSETS]\nThe following assets are stored in the project and can be loaded directly via their path:\n';
    for (const a of params.assets) {
      assetsContext += `- Path: "${a.path || 'assets/' + a.name}" | Type: ${a.type} | MIME: ${a.mimeType}${a.width ? ` | Dimensions: ${a.width}x${a.height}` : ''}\n`;
    }
    assetsContext += 'To use these in Phaser: this.load.image("assetKey", "assets/filename.webp") or this.load.audio("sfxKey", "assets/filename.wav") in preload(), then display or play them.\n';
  }

  const recentMessages = params.messages.slice(-6);
  const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt }
  ];

  for (let i = 0; i < recentMessages.length - 1; i++) {
    const msg = recentMessages[i];
    if (msg.role === 'assistant') {
      const stripped = msg.content.replace(/```[\s\S]*?```/g, '[code omitted]');
      formattedMessages.push({ role: 'assistant', content: stripped });
    } else {
      formattedMessages.push({ role: 'user', content: msg.content });
    }
  }

  const latestMsg = recentMessages[recentMessages.length - 1];
  let userPrompt = latestMsg ? latestMsg.content : 'Build a playable game';

  if (params.errorContext) {
    userPrompt = `[RUNTIME ERROR IN PREVIEW]\nError: ${params.errorContext.message || params.errorContext}\n${params.errorContext.stack ? 'Stack: ' + params.errorContext.stack : ''}\n\nPlease inspect the code, diagnose the bug, and provide the fixed code for the affected file(s).\n\nUser instructions: ${userPrompt}`;
  }

  const fullLatestText = `[CURRENT PROJECT FILES]${filesContext}${assetsContext}\n\n[USER REQUEST]\n${userPrompt}`;
  formattedMessages.push({ role: 'user', content: fullLatestText });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (params.apiKey) {
    headers['Authorization'] = `Bearer ${params.apiKey.trim()}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://levelo.ai';
    headers['X-Title'] = 'Levelo Game Builder';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: params.model,
      messages: formattedMessages,
      stream: true,
      max_tokens: 8192
    }),
    signal: params.signal
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const norm = normalizeAIError(errData?.error || errData, provider);
    throw new Error(norm.message);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Unable to read streaming body from AI provider');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue; // comments/heartbeats
      if (trimmed === 'data: [DONE]') return;
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) {
            yield chunk;
          }
        } catch {
          // ignore chunk parse errors
        }
      }
    }
  }
}
