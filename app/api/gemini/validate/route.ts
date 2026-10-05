import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = body?.apiKey?.trim();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Call real Google Gemini models.list endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || response.statusText || 'Invalid API Key';
      return NextResponse.json(
        { 
          valid: false, 
          error: errMsg,
          status: response.status 
        },
        { status: response.status >= 400 && response.status < 500 ? 400 : response.status }
      );
    }

    // Extract valid models
    const rawModels = data?.models || [];
    // Filter to generateContent compatible models
    const models = rawModels
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({
        name: m.name.replace('models/', ''),
        displayName: m.displayName || m.name.replace('models/', ''),
        description: m.description || '',
        supportedGenerationMethods: m.supportedGenerationMethods || []
      }))
      // Sort so popular models appear first
      .sort((a: any, b: any) => {
        if (a.name.includes('flash') && !b.name.includes('flash')) return -1;
        if (!a.name.includes('flash') && b.name.includes('flash')) return 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      valid: true,
      models,
      totalCount: models.length
    });
  } catch (err: any) {
    return NextResponse.json(
      { 
        valid: false, 
        error: err.message || 'Network error communicating with Google Gemini API' 
      },
      { status: 500 }
    );
  }
}
