import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';

const SYSTEM_INSTRUCTION = `You are an expert game developer. Build complete, polished, playable browser games using Phaser 3 (2D) or Three.js (3D) via CDN.
Levelo projects are multi-file web applications (e.g. index.html, game.js, style.css, or subfolders like src/player.js).

OUTPUT FORMAT:
1. First, write a brief, friendly explanation (1-3 sentences) describing what you changed, added, or fixed.
2. If any files should be deleted, write delete directives on their own lines:
[DELETE: filename.ext]
3. Output each created or modified file in a fenced code block with the language and exact relative filepath:
\`\`\`html index.html
<!DOCTYPE html>
<html>...</html>
\`\`\`
\`\`\`javascript game.js
// JavaScript game code
\`\`\`
\`\`\`css style.css
/* CSS code */
\`\`\`

CRITICAL MULTI-FILE RULES:
- You ONLY need to output the files that were CREATED or MODIFIED. Files that are unchanged do NOT need to be outputted.
- index.html can link local scripts with <script src="game.js"></script> and local styles with <link rel="stylesheet" href="style.css">.
- External libraries (Phaser, Three.js) must be loaded via standard CDN <script> tags in index.html.
- Always output the full content of any file you touch (no placeholders like "...rest of code unchanged...").

CRITICAL GAME REQUIREMENTS:
1. Complete Game Loop: Fully working game state, physics, collisions, and win/loss conditions.
2. Dual Controls: Support BOTH keyboard (Arrow keys, WASD, Space) AND responsive on-screen touch controls (D-pad, jump/action buttons) so it is 100% playable on phones and tablets.
3. Scoring & State: Clear Score, High Score, Game Over screen, and instant Restart trigger (e.g. press Space or tap button to restart).
4. Responsive Canvas: Use Phaser Scale.FIT with autoCenter: Phaser.Scale.CENTER_BOTH, or Three.js window resize handlers, so it adapts to any screen or device aspect ratio.
5. Built-in Synthesized WebAudio SFX: Synthesize fun arcade sound effects (jump, pickup, hit, shoot, game over) using the browser WebAudio API (AudioContext) directly in code or use available project audio assets (e.g. this.load.audio('sfx', 'assets/sfx.wav')).
6. Using Project Assets: When project assets are listed in [AVAILABLE PROJECT ASSETS], load and use them directly in the game (e.g., this.load.image('hero', 'assets/hero.webp'), this.load.audio('jump', 'assets/jump.wav')). When no matching asset exists, fall back to procedural graphics using Phaser canvas graphics (e.g. this.make.graphics().generateTexture()) or Three.js geometry/materials. DO NOT load untrusted external third-party image URLs.

CRITICAL PERFORMANCE RULES:
- NEVER use ctx.shadowBlur or expensive continuous canvas glow effects (causes massive frame rate drops).
- ALWAYS use a fixed 60Hz delta time / accumulator game loop so the game runs at the exact same speed on 60Hz, 120Hz, and high-refresh displays.
- Keep canvas textures lightweight and clean. Avoid unnecessary object creation inside the update loop to prevent garbage collection pauses.
- Target silky-smooth 60 FPS gameplay on all devices.`;

function sanitizeModel(m?: string): string {
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

export async function POST(req: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const userApiKey = req.headers.get('x-gemini-key')?.trim();
    // In production, only use user key from header. In development, allow fallback.
    const apiKey = isProd ? userApiKey : (userApiKey || process.env.GEMINI_API_KEY?.trim());

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
    const { 
      messages = [], 
      files = {}, 
      assets = [], 
      model = 'gemini-3.8-flash', 
      fallbackModels = [],
      errorContext 
    } = body;

    // Initialize Google GenAI client
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Format all project files into multi-file prompt context
    let filesContext = '';
    if (files && typeof files === 'object') {
      for (const [filePath, content] of Object.entries(files)) {
        const ext = filePath.split('.').pop() || 'txt';
        filesContext += `\nFile: ${filePath}\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
      }
    }
    if (!filesContext.trim()) {
      filesContext = '\n(Project is currently empty. Provide index.html and any companion scripts/styles.)\n';
    }

    // Format project assets manifest
    let assetsContext = '';
    if (assets && Array.isArray(assets) && assets.length > 0) {
      assetsContext = '\n\n[AVAILABLE PROJECT ASSETS]\nThe following assets are stored in the project and can be loaded directly via their path:\n';
      for (const a of assets) {
        assetsContext += `- Path: "${a.path || 'assets/' + a.name}" | Type: ${a.type} | MIME: ${a.mimeType}${a.width ? ` | Dimensions: ${a.width}x${a.height}` : ''}\n`;
      }
      assetsContext += 'To use these in Phaser: this.load.image("assetKey", "assets/filename.webp") or this.load.audio("sfxKey", "assets/filename.wav") in preload(), then display or play them.\n';
    }

    // Keep last 6 messages to reduce prompt latency while retaining context
    const recentMessages = messages.slice(-6);

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
        const strippedContent = msg.content.replace(/```[\s\S]*?```/g, '[code omitted]');
        contents.push({
          role: 'model',
          parts: [{ text: strippedContent }]
        });
      }
    }

    // Latest user request
    const latestMsg = recentMessages[recentMessages.length - 1];
    let userPrompt = latestMsg ? latestMsg.content : 'Build a playable game';

    // If an error is being fixed with AI, include the runtime error details
    if (errorContext) {
      userPrompt = `[RUNTIME ERROR IN PREVIEW]\nError: ${errorContext.message || errorContext}\n${errorContext.stack ? 'Stack: ' + errorContext.stack : ''}\n\nPlease inspect the code, diagnose the bug, and provide the fixed code for the affected file(s).\n\nUser instructions: ${userPrompt}`;
    }

    // Embed current code and asset manifest into user turn
    const fullLatestUserText = `[CURRENT PROJECT FILES]${filesContext}${assetsContext}\n\n[USER REQUEST]\n${userPrompt}`;

    contents.push({
      role: 'user',
      parts: [{ text: fullLatestUserText }]
    });

    const primaryModel = sanitizeModel(model);
    const sanitizedFallbacks = (Array.isArray(fallbackModels) ? fallbackModels : []).map(sanitizeModel);
    
    // Ordered candidate models to attempt
    const modelCandidates = Array.from(new Set([
      primaryModel,
      ...sanitizedFallbacks,
      'gemini-3.8-flash',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite'
    ])).filter(Boolean);

    // Create ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (obj: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        sendEvent({ type: 'status', status: 'connected', model: primaryModel });

        // Keep proxies alive with heartbeat comment every 15s
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 15000);

        let isAborted = false;
        const abortHandler = () => {
          isAborted = true;
          clearInterval(heartbeatInterval);
          try {
            controller.close();
          } catch {}
        };
        req.signal.addEventListener('abort', abortHandler);

        let responseStream: any = null;
        let successfulModel = primaryModel;

        // Try candidate models with retry on 503/overload
        for (let mIdx = 0; mIdx < modelCandidates.length; mIdx++) {
          if (isAborted || req.signal.aborted) break;
          const currentCandidate = modelCandidates[mIdx];

          if (mIdx > 0) {
            sendEvent({
              type: 'status',
              status: 'switching',
              message: `Switching to fallback model: ${currentCandidate}...`,
              model: currentCandidate
            });
          }

          let attempt = 0;
          const maxAttempts = 2;

          while (attempt < maxAttempts) {
            if (isAborted || req.signal.aborted) break;
            attempt++;

            try {
              responseStream = await ai.models.generateContentStream({
                model: currentCandidate,
                contents,
                config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  maxOutputTokens: 8192,
                }
              });
              successfulModel = currentCandidate;
              break;
            } catch (err: any) {
              const errMsg = String(err?.message || '');
              const status = err?.status || err?.code || 500;
              const isOverloaded = status === 503 || errMsg.includes('503') || errMsg.includes('overloaded') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand');

              if (isOverloaded && attempt < maxAttempts) {
                sendEvent({
                  type: 'status',
                  status: 'retrying',
                  message: `Model ${currentCandidate} is busy, retrying in 1s (attempt ${attempt}/${maxAttempts})...`,
                  model: currentCandidate
                });
                await new Promise((r) => setTimeout(r, 1000));
                continue;
              }

              console.warn(`Model ${currentCandidate} failed (attempt ${attempt}):`, errMsg);
              break;
            }
          }

          if (responseStream) {
            break;
          }
        }

        if (!responseStream) {
          sendEvent({
            type: 'error',
            error: 'All AI models are currently busy or unavailable. Please try again in a moment.',
            code: 'SERVICE_OVERLOADED',
            status: 503
          });
          clearInterval(heartbeatInterval);
          try { controller.close(); } catch {}
          return;
        }

        try {
          for await (const chunk of responseStream) {
            if (isAborted || req.signal.aborted) break;
            const text = chunk.text;
            if (text) {
              sendEvent({ type: 'chunk', text });
            }
          }
          if (!isAborted && !req.signal.aborted) {
            sendEvent({ type: 'done', model: successfulModel });
          }
        } catch (streamErr: any) {
          if (!isAborted && !req.signal.aborted) {
            const rawMsg = streamErr?.message || 'Streaming failed';
            let readableError = 'AI response was interrupted. Please try again.';
            if (rawMsg.includes('429') || rawMsg.includes('quota')) {
              readableError = 'API quota reached. Please wait a moment or check your key quota.';
            } else if (rawMsg.includes('503') || rawMsg.includes('overload')) {
              readableError = 'AI model is overloaded. Please try again shortly.';
            } else if (rawMsg.includes('API_KEY')) {
              readableError = 'Invalid API key. Please check your Gemini API key in Settings.';
            }

            sendEvent({
              type: 'error',
              error: readableError,
              code: rawMsg.includes('429') ? 'RATE_LIMIT' : 'GENERIC_ERROR',
              status: streamErr?.status || 500
            });
          }
        } finally {
          clearInterval(heartbeatInterval);
          req.signal.removeEventListener('abort', abortHandler);
          try {
            controller.close();
          } catch {}
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
    const rawMsg = String(err?.message || '');
    let readableError = 'Failed to initialize Gemini generation';
    if (rawMsg.includes('429') || rawMsg.includes('quota')) {
      readableError = 'API quota reached. Please wait a moment or check your key quota.';
    } else if (rawMsg.includes('503') || rawMsg.includes('overload')) {
      readableError = 'AI model is overloaded. Please try again shortly.';
    } else if (rawMsg.includes('API_KEY')) {
      readableError = 'Invalid API key. Please check your Gemini API key in Settings.';
    }

    const isRateLimit = rawMsg.includes('429') || rawMsg.includes('quota');
    const isInvalidKey = rawMsg.includes('API_KEY');

    return new Response(
      JSON.stringify({
        error: readableError,
        code: isRateLimit ? 'RATE_LIMIT' : isInvalidKey ? 'INVALID_KEY' : 'GENERIC_ERROR'
      }),
      { 
        status: isRateLimit ? 429 : isInvalidKey ? 401 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
