import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { PAID_MODELS } from '@/lib/model-status';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const userApiKey = req.headers.get('x-gemini-key')?.trim();
    const isProd = process.env.NODE_ENV === 'production';
    const apiKey = isProd ? userApiKey : (userApiKey || process.env.GEMINI_API_KEY?.trim());

    if (!apiKey) {
      return NextResponse.json({
        status: 'not_available',
        label: 'Not available',
        error: 'API key missing'
      });
    }

    const body = await req.json();
    let model = (body.model || 'gemini-3.8-flash').trim();

    // Check deprecated models immediately
    if (model.includes('2.5') || model.includes('2.0') || model.includes('1.5')) {
      return NextResponse.json({
        model,
        status: 'not_available',
        label: 'Not available',
        error: `Model ${model} is deprecated and no longer available.`
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    try {
      const response = await ai.models.generateContent({
        model,
        contents: 'hi',
        config: {
          maxOutputTokens: 2
        }
      });

      return NextResponse.json({
        model,
        status: 'works',
        label: 'Works',
        text: response.text || ''
      });
    } catch (apiErr: any) {
      const msg = String(apiErr?.message || '');
      const status = apiErr?.status || apiErr?.code || 500;

      if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        return NextResponse.json({
          model,
          status: 'quota_used_up',
          label: 'Quota used up',
          error: 'Rate limit or quota exhausted'
        });
      }

      if (status === 503 || msg.includes('503') || msg.includes('overloaded') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
        return NextResponse.json({
          model,
          status: 'busy',
          label: 'Busy',
          error: 'Model currently overloaded'
        });
      }

      if (status === 403 || msg.includes('BILLING') || msg.includes('billing') || PAID_MODELS.includes(model)) {
        return NextResponse.json({
          model,
          status: 'paid_only',
          label: 'Paid only',
          error: 'Requires paid tier'
        });
      }

      if (status === 404 || msg.includes('404') || msg.includes('not found') || msg.includes('NOT_FOUND') || msg.includes('no longer available')) {
        return NextResponse.json({
          model,
          status: 'not_available',
          label: 'Not available',
          error: 'Model not available'
        });
      }

      return NextResponse.json({
        model,
        status: 'busy',
        label: 'Busy',
        error: msg.slice(0, 100)
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      status: 'not_available',
      label: 'Not available',
      error: err?.message || 'Probe failed'
    });
  }
}
