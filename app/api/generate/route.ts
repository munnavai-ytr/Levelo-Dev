import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';

const SYSTEM_INSTRUCTION = `You are an expert game developer. Build complete, polished, playable browser games using Phaser 3 (2D) or Three.js (3D) via CDN. Return a short explanation, then the full updated files.

OUTPUT FORMAT:
First write a brief, friendly explanation (1-3 sentences) describing what you changed or built.
Then output the full updated files in fenced code blocks labeled with the file path, exactly like this:
\`\`\`html index.html
<!DOCTYPE html>
<html lang="en">
...
</html>
\`\`\`

CRITICAL GAME REQUIREMENTS:
1. Complete Game Loop: Fully working game state, physics, collisions, and win/loss conditions.
2. Dual Controls: Support BOTH keyboard (Arrow keys, WASD, Space) AND responsive on-screen touch controls (D-pad, jump/action buttons) so it is 100% playable on phones and tablets.
3. Scoring & State: Clear Score, High Score, Game Over screen, and instant Restart trigger (e.g. press Space or tap button to restart).
4. Responsive Canvas: Use Phaser Scale.FIT with autoCenter: Phaser.Scale.CENTER_BOTH, or Three.js window resize handlers, so it adapts to any screen or device aspect ratio.
5. Built-in Synthesized WebAudio SFX: Synthesize fun arcade sound effects (jump, pickup, hit, shoot, game over) using the browser WebAudio API (AudioContext) directly in code. DO NOT reference external .wav or .mp3 URLs that might fail to load.
6. Zero External Asset Dependencies: DO NOT load external sprite images or assets from external URLs that might 404 or fail CORS. Procedurally generate all textures, player sprites, and particles using Phaser canvas graphics (e.g. this.make.graphics().generateTexture()) or Three.js geometry/materials.
7. Complete Code: Always output the FULL, COMPLETE index.html. Never truncate with placeholders like "...rest of code unchanged...".`;

export async function POST(req: NextRequest) {
  try {
    // Read user's API key strictly from header (never stored or logged)
    const apiKey = req.headers.get('x-gemini-key')?.trim() || process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Gemini API Key is missing. Please add your API key in Settings.',
          code: 'API_KEY_MISSING' 
        }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { messages = [], files = {}, model = 'gemini-2.5-flash', errorContext } = body;

    // Initialize Google GenAI client
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const currentHtml = files?.['index.html'] || '';

    // Build conversation context from last N messages (up to 8)
    const recentMessages = messages.slice(-8);

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add prior conversation turns
    for (let i = 0; i < recentMessages.length - 1; i++) {
      const msg = recentMessages[i];
      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }]
        });
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
    }

    // Latest user request
    const latestMsg = recentMessages[recentMessages.length - 1];
    let userPrompt = latestMsg ? latestMsg.content : 'Build a playable game';

    // If an error is being fixed with AI, include the runtime error details
    if (errorContext) {
      userPrompt = `[RUNTIME ERROR IN PREVIEW]\nError: ${errorContext.message || errorContext}\n${errorContext.stack ? 'Stack: ' + errorContext.stack : ''}\n\nPlease inspect the code, diagnose the bug, and provide the complete fixed index.html.\n\nUser instructions: ${userPrompt}`;
    }

    // Embed current code into user turn so model can mutate existing code
    const fullLatestUserText = `[CURRENT PROJECT FILES]\nFile: index.html\n\`\`\`html\n${currentHtml}\n\`\`\`\n\n[USER REQUEST]\n${userPrompt}`;

    contents.push({
      role: 'user',
      parts: [{ text: fullLatestUserText }]
    });

    // Stream the response using generateContentStream
    const responseStream = await ai.models.generateContentStream({
      model: model || 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    // Create ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              const payload = `data: ${JSON.stringify({ type: 'chunk', text })}\n\n`;
              controller.enqueue(encoder.encode(payload));
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (streamErr: any) {
          const errMsg = streamErr?.message || 'Streaming failed';
          const isRateLimit = streamErr?.status === 429 || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
          const isInvalidKey = streamErr?.status === 400 || streamErr?.status === 403 || errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid');

          const errorPayload = {
            type: 'error',
            error: errMsg,
            code: isRateLimit ? 'RATE_LIMIT' : isInvalidKey ? 'INVALID_KEY' : 'GENERIC_ERROR',
            status: isRateLimit ? 429 : isInvalidKey ? 401 : 500
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorPayload)}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (err: any) {
    const errMsg = err?.message || 'Failed to initialize Gemini generation';
    const isRateLimit = err?.status === 429 || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
    const isInvalidKey = err?.status === 400 || err?.status === 403 || errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid');

    return new Response(
      JSON.stringify({
        error: errMsg,
        code: isRateLimit ? 'RATE_LIMIT' : isInvalidKey ? 'INVALID_KEY' : 'GENERIC_ERROR'
      }),
      { 
        status: isRateLimit ? 429 : isInvalidKey ? 401 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
