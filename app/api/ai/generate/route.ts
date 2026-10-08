import { NextRequest } from 'next/server';
import { 
  streamGenerate, 
  normalizeAIError, 
  type AIProviderId, 
  AI_PROVIDERS_CONFIG 
} from '@/lib/providers';

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

interface FallbackCandidate {
  provider: AIProviderId;
  model: string;
  baseUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const activeProvider = (req.headers.get('x-ai-provider') || 'gemini') as AIProviderId;
    const activeKey = req.headers.get('x-ai-key')?.trim();
    const customBaseUrl = req.headers.get('x-ai-base-url')?.trim();

    // Map of all keys provided by client for cross-provider auto-fallback
    let providerKeysMap: Record<string, string> = {};
    try {
      const rawKeysHeader = req.headers.get('x-ai-keys');
      if (rawKeysHeader) {
        providerKeysMap = JSON.parse(rawKeysHeader);
      }
    } catch {}

    if (activeKey) {
      providerKeysMap[activeProvider] = activeKey;
    }
    // Development fallback for Gemini
    if (!providerKeysMap.gemini && !isProd && process.env.GEMINI_API_KEY) {
      providerKeysMap.gemini = process.env.GEMINI_API_KEY.trim();
    }

    const body = await req.json();
    const {
      messages = [],
      files = {},
      assets = [],
      model: requestedModel,
      provider: requestedProvider,
      fallbackChain: clientFallbackChain = [],
      errorContext
    } = body;

    const currentProvider = (requestedProvider || activeProvider) as AIProviderId;
    const currentModel = requestedModel || AI_PROVIDERS_CONFIG[currentProvider]?.defaultModel || 'gemini-3.8-flash';

    // Construct full fallback chain:
    // 1. Primary requested (provider + model)
    // 2. Client specified fallback chain
    // 3. Other models within same provider
    // 4. Other configured providers that have keys
    const fallbackList: FallbackCandidate[] = [
      { provider: currentProvider, model: currentModel, baseUrl: customBaseUrl }
    ];

    if (Array.isArray(clientFallbackChain)) {
      for (const item of clientFallbackChain) {
        if (item?.provider && item?.model) {
          fallbackList.push({
            provider: item.provider as AIProviderId,
            model: item.model,
            baseUrl: item.baseUrl || customBaseUrl
          });
        }
      }
    }

    // Add preset models for the current provider
    const currentPresets = AI_PROVIDERS_CONFIG[currentProvider]?.presetModels || [];
    for (const p of currentPresets) {
      if (p.id !== currentModel) {
        fallbackList.push({ provider: currentProvider, model: p.id, baseUrl: customBaseUrl });
      }
    }

    // Add other providers that have keys configured
    for (const [pId, keyVal] of Object.entries(providerKeysMap)) {
      if (pId !== currentProvider && keyVal && keyVal.trim()) {
        const otherMeta = AI_PROVIDERS_CONFIG[pId as AIProviderId];
        if (otherMeta) {
          fallbackList.push({
            provider: pId as AIProviderId,
            model: otherMeta.defaultModel,
            baseUrl: customBaseUrl
          });
          for (const extra of otherMeta.presetModels.slice(1, 2)) {
            fallbackList.push({
              provider: pId as AIProviderId,
              model: extra.id,
              baseUrl: customBaseUrl
            });
          }
        }
      }
    }

    // Deduplicate candidate chain
    const uniqueChain: FallbackCandidate[] = [];
    const seen = new Set<string>();
    for (const c of fallbackList) {
      const key = `${c.provider}:${c.model}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueChain.push(c);
      }
    }

    // Create ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (obj: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          } catch {}
        };

        sendEvent({
          type: 'status',
          status: 'connected',
          provider: currentProvider,
          model: currentModel
        });

        // Keepalive heartbeat
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
          try { controller.close(); } catch {}
        };
        req.signal.addEventListener('abort', abortHandler);

        let succeeded = false;
        let lastErrorMsg = 'Failed to generate code with any configured model';

        for (let i = 0; i < uniqueChain.length; i++) {
          if (isAborted || req.signal.aborted) break;
          const candidate = uniqueChain[i];
          const candidateKey = providerKeysMap[candidate.provider] || activeKey;

          if (!candidateKey && candidate.provider !== 'custom') {
            continue; // Skip provider if no key available
          }

          if (i > 0) {
            sendEvent({
              type: 'status',
              status: 'switching',
              message: `Switching to ${AI_PROVIDERS_CONFIG[candidate.provider]?.name || candidate.provider} (${candidate.model})...`,
              provider: candidate.provider,
              model: candidate.model
            });
          }

          let attempt = 0;
          const maxAttempts = candidate.provider === 'gemini' ? 2 : 1;

          while (attempt < maxAttempts) {
            if (isAborted || req.signal.aborted) break;
            attempt++;

            try {
              const generator = streamGenerate(
                {
                  provider: candidate.provider,
                  model: candidate.model,
                  messages,
                  files,
                  assets,
                  errorContext,
                  signal: req.signal,
                  apiKey: candidateKey,
                  customBaseUrl: candidate.baseUrl || customBaseUrl
                },
                SYSTEM_INSTRUCTION
              );

              let hasEmittedChunks = false;
              for await (const chunk of generator) {
                if (isAborted || req.signal.aborted) break;
                if (chunk) {
                  hasEmittedChunks = true;
                  sendEvent({ type: 'chunk', text: chunk });
                }
              }

              if (hasEmittedChunks && !isAborted && !req.signal.aborted) {
                sendEvent({
                  type: 'done',
                  provider: candidate.provider,
                  model: candidate.model
                });
                succeeded = true;
                break;
              }
            } catch (err: any) {
              const normalized = normalizeAIError(err, candidate.provider);
              lastErrorMsg = normalized.message;

              if (normalized.type === 'overloaded' && attempt < maxAttempts) {
                sendEvent({
                  type: 'status',
                  status: 'retrying',
                  message: `${AI_PROVIDERS_CONFIG[candidate.provider]?.name} is busy, retrying in 1s...`,
                  provider: candidate.provider,
                  model: candidate.model
                });
                await new Promise((r) => setTimeout(r, 1000));
                continue;
              }
              break; // Try next fallback candidate
            }
          }

          if (succeeded) break;
        }

        if (!succeeded && !isAborted && !req.signal.aborted) {
          sendEvent({
            type: 'error',
            error: lastErrorMsg,
            code: 'ALL_FALLBACKS_FAILED'
          });
        }

        clearInterval(heartbeatInterval);
        req.signal.removeEventListener('abort', abortHandler);
        try { controller.close(); } catch {}
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
    const normalized = normalizeAIError(err);
    return new Response(
      JSON.stringify({
        error: normalized.message,
        code: normalized.type
      }),
      {
        status: normalized.statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
