import { GoogleGenAI } from '@google/genai';
import type { ProviderModelInfo, ProviderProbeResult, StreamGenerateParams } from './types';
import { normalizeAIError } from './index';

export function sanitizeGeminiModel(m?: string): string {
  if (!m) return 'gemini-3.8-flash';
  const clean = m.trim().replace(/^models\//, '');
  if (
    clean === 'gemini-2.5-flash' ||
    clean.includes('2.5') ||
    clean.includes('2.0') ||
    clean.includes('1.5') ||
    clean === 'gemini-flash' ||
    clean === 'gemini-pro'
  ) {
    return 'gemini-3.8-flash';
  }
  return clean;
}

export async function listGeminiModels(
  apiKey: string
): Promise<{ valid: boolean; models: ProviderModelInfo[]; error?: string }> {
  if (!apiKey) {
    return { valid: false, models: [], error: 'Gemini API key is required' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const norm = normalizeAIError(data?.error || data, 'gemini');
      return { valid: false, models: [], error: norm.message };
    }

    const rawList = Array.isArray(data?.models) ? data.models : [];
    const models: ProviderModelInfo[] = rawList
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => {
        const id = m.name?.replace(/^models\//, '');
        return {
          id,
          name: m.displayName || id,
          description: m.description,
          contextLength: m.inputTokenLimit
        };
      })
      .sort((a, b) => {
        if (a.id.includes('flash') && !b.id.includes('flash')) return -1;
        if (!a.id.includes('flash') && b.id.includes('flash')) return 1;
        return a.name.localeCompare(b.name);
      });

    return { valid: true, models };
  } catch (err: any) {
    const norm = normalizeAIError(err, 'gemini');
    return { valid: false, models: [], error: norm.message };
  }
}

export async function probeGeminiModel(
  apiKey: string,
  modelName: string
): Promise<ProviderProbeResult> {
  const model = sanitizeGeminiModel(modelName);
  const start = Date.now();

  if (!apiKey) {
    return {
      provider: 'gemini',
      model,
      status: 'not_available',
      label: 'Not available',
      error: 'API key missing',
      latencyMs: 0
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: { 'User-Agent': 'levelo-builder' }
      }
    });

    await ai.models.generateContent({
      model,
      contents: 'hi',
      config: { maxOutputTokens: 2 }
    });

    return {
      provider: 'gemini',
      model,
      status: 'works',
      label: 'Works',
      latencyMs: Date.now() - start
    };
  } catch (err: any) {
    const norm = normalizeAIError(err, 'gemini');
    const latencyMs = Date.now() - start;

    if (norm.type === 'rate_limit') {
      return { provider: 'gemini', model, status: 'quota_used_up', label: 'Quota used up', latencyMs, error: norm.message };
    }
    if (norm.type === 'billing_required') {
      return { provider: 'gemini', model, status: 'paid_only', label: 'Paid only', latencyMs, error: norm.message };
    }
    if (norm.type === 'overloaded') {
      return { provider: 'gemini', model, status: 'busy', label: 'Busy', latencyMs, error: norm.message };
    }
    if (norm.type === 'model_not_found') {
      return { provider: 'gemini', model, status: 'not_available', label: 'Not available', latencyMs, error: norm.message };
    }

    return {
      provider: 'gemini',
      model,
      status: 'busy',
      label: 'Busy',
      latencyMs,
      error: norm.message
    };
  }
}

export async function* streamGemini(
  params: StreamGenerateParams,
  systemPrompt: string
): AsyncGenerator<string, void, unknown> {
  if (!params.apiKey) {
    throw new Error('Gemini API key is required');
  }

  const model = sanitizeGeminiModel(params.model);
  const ai = new GoogleGenAI({
    apiKey: params.apiKey.trim(),
    httpOptions: {
      headers: { 'User-Agent': 'levelo-builder' }
    }
  });

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
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (let i = 0; i < recentMessages.length - 1; i++) {
    const msg = recentMessages[i];
    if (msg.role === 'assistant') {
      const stripped = msg.content.replace(/```[\s\S]*?```/g, '[code omitted]');
      contents.push({ role: 'model', parts: [{ text: stripped }] });
    } else {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    }
  }

  const latestMsg = recentMessages[recentMessages.length - 1];
  let userPrompt = latestMsg ? latestMsg.content : 'Build a playable game';

  if (params.errorContext) {
    userPrompt = `[RUNTIME ERROR IN PREVIEW]\nError: ${params.errorContext.message || params.errorContext}\n${params.errorContext.stack ? 'Stack: ' + params.errorContext.stack : ''}\n\nPlease inspect the code, diagnose the bug, and provide the fixed code for the affected file(s).\n\nUser instructions: ${userPrompt}`;
  }

  const fullLatestText = `[CURRENT PROJECT FILES]${filesContext}${assetsContext}\n\n[USER REQUEST]\n${userPrompt}`;
  contents.push({ role: 'user', parts: [{ text: fullLatestText }] });

  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 8192
    }
  });

  for await (const chunk of stream) {
    if (params.signal?.aborted) break;
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
}
