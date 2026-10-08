import { NextRequest, NextResponse } from 'next/server';
import { probeModel, type AIProviderId } from '@/lib/providers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const userApiKey = req.headers.get('x-ai-key')?.trim();
    const customBaseUrl = req.headers.get('x-ai-base-url')?.trim();

    const body = await req.json().catch(() => ({}));
    const provider = (body.provider || req.headers.get('x-ai-provider') || 'gemini') as AIProviderId;
    const model = (body.model || '').trim();

    if (!model) {
      return NextResponse.json(
        { status: 'not_available', label: 'Not available', error: 'Model name is required' },
        { status: 400 }
      );
    }

    const isProd = process.env.NODE_ENV === 'production';
    const apiKey = provider === 'gemini' 
      ? (userApiKey || (!isProd ? process.env.GEMINI_API_KEY?.trim() : ''))
      : userApiKey;

    if (!apiKey && provider !== 'custom') {
      return NextResponse.json({
        provider,
        model,
        status: 'not_available',
        label: 'Not available',
        error: 'API key not configured'
      });
    }

    const result = await probeModel(provider, apiKey || '', model, body.baseUrl || customBaseUrl);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({
      status: 'not_available',
      label: 'Not available',
      error: err?.message || 'Probe error'
    });
  }
}
