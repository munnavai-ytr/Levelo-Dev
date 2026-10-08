import { NextRequest, NextResponse } from 'next/server';
import { listModels, type AIProviderId, AI_PROVIDERS_CONFIG } from '@/lib/providers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const provider = (req.headers.get('x-ai-provider') || 'gemini') as AIProviderId;
    const userApiKey = req.headers.get('x-ai-key')?.trim();
    const customBaseUrl = req.headers.get('x-ai-base-url')?.trim();

    // Fallback to server env var for Gemini if developing locally
    const isProd = process.env.NODE_ENV === 'production';
    const apiKey = provider === 'gemini' 
      ? (userApiKey || (!isProd ? process.env.GEMINI_API_KEY?.trim() : ''))
      : userApiKey;

    if (!apiKey && provider !== 'custom') {
      return NextResponse.json(
        { valid: false, models: [], error: `API key for ${AI_PROVIDERS_CONFIG[provider]?.name || provider} is required.` },
        { status: 400 }
      );
    }

    const result = await listModels(provider, apiKey || '', customBaseUrl);
    
    // If provider API failed or returned 0 models, supply known presets as fallback
    if (!result.valid || result.models.length === 0) {
      const presets = AI_PROVIDERS_CONFIG[provider]?.presetModels || [];
      if (presets.length > 0 && result.error && !result.error.toLowerCase().includes('invalid')) {
        return NextResponse.json({
          valid: true,
          models: presets,
          isPresetFallback: true,
          notice: result.error
        });
      }
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, models: [], error: err?.message || 'Failed to list models' },
      { status: 500 }
    );
  }
}
