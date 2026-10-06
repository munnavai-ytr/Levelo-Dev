import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const userApiKey = req.headers.get('x-gemini-key')?.trim();
    const apiKey = isProd ? userApiKey : (userApiKey || process.env.GEMINI_API_KEY?.trim());

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Gemini API Key is missing. Please add your API key in Settings.',
          code: 'API_KEY_MISSING',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      prompt,
      type = 'sprite',
      style = 'pixel_art',
      model,
      size = '512x512',
    } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required for image generation.', code: 'INVALID_PROMPT' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Determine target aspect ratio / dimensions
    let aspectRatio: '1:1' | '16:9' | '4:3' | '9:16' = '1:1';
    if (type === 'background') {
      aspectRatio = '16:9';
    }

    // Enhance prompt for game development
    let styleDescriptor = '';
    switch (style) {
      case 'pixel_art':
        styleDescriptor = 'pixel art game sprite, crisp 16-bit retro arcade aesthetic';
        break;
      case 'cartoon':
        styleDescriptor = 'colorful vibrant 2D cartoon game asset, clean vector outlines, playful';
        break;
      case 'flat_vector':
        styleDescriptor = 'flat modern vector game graphic, minimalistic, clean geometric shapes';
        break;
      case 'realistic':
        styleDescriptor = 'detailed high-definition game concept art, textured and shaded';
        break;
      default:
        styleDescriptor = '2D video game asset art style';
    }

    let enhancedPrompt = '';
    if (type === 'sprite') {
      enhancedPrompt = `Single isolated 2D game character or item sprite of "${prompt.trim()}". ${styleDescriptor}. Centered on solid uniform bright neon green (#00FF00) background for chroma-key extraction. Zero shadow on ground, crisp distinct edges, single object only, no text or watermark.`;
    } else if (type === 'background') {
      enhancedPrompt = `2D video game parallax background of "${prompt.trim()}". ${styleDescriptor}. Seamless environment, game landscape, cinematic wide shot, atmospheric lighting, zero characters in foreground, no text.`;
    } else if (type === 'tileset') {
      enhancedPrompt = `2D game tileset sheet of "${prompt.trim()}". ${styleDescriptor}. Top-down / side-scrolling terrain blocks, modular texture tiles, clean borders, game development asset.`;
    } else if (type === 'ui_icon') {
      enhancedPrompt = `2D game UI icon button badge of "${prompt.trim()}". ${styleDescriptor}. Centered on solid uniform background, clean circular or rounded game UI element, glossy game button icon, no text.`;
    } else {
      enhancedPrompt = `2D game asset graphic of "${prompt.trim()}". ${styleDescriptor}. Game asset, clean composition.`;
    }

    // Model selection: use user model if image-capable or default to imagen-3.0-generate-002 or gemini-3.1-flash-image
    let targetModel = model || 'imagen-3.0-generate-002';
    if (targetModel.includes('gemini-') && !targetModel.includes('image')) {
      // If a pure text Gemini model was selected, use imagen-3.0-generate-002
      targetModel = 'imagen-3.0-generate-002';
    }

    let imageDataUrl = '';
    let mimeType = 'image/png';

    try {
      // First attempt: generateImages with Imagen 3
      const response = await ai.models.generateImages({
        model: targetModel,
        prompt: enhancedPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio,
        },
      });

      const generatedImage = response.generatedImages?.[0];
      if (generatedImage?.image?.imageBytes) {
        mimeType = 'image/png';
        imageDataUrl = `data:${mimeType};base64,${generatedImage.image.imageBytes}`;
      }
    } catch (genImgErr: any) {
      // If generateImages fails with specific model or method, try generateContent fallback with gemini-2.5-flash or gemini-3.1-flash-image
      console.warn('generateImages failed, attempting generateContent fallback:', genImgErr?.message);
      
      const isRateLimit = genImgErr?.status === 429 || String(genImgErr?.message).includes('429') || String(genImgErr?.message).includes('quota') || String(genImgErr?.message).includes('RESOURCE_EXHAUSTED');
      if (isRateLimit) {
        throw genImgErr; // Bubble up rate limit
      }

      try {
        const fallbackModel = 'imagen-3.0-generate-002';
        const fallbackRes = await ai.models.generateImages({
          model: fallbackModel,
          prompt: enhancedPrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: aspectRatio,
          },
        });
        const generated = fallbackRes.generatedImages?.[0];
        if (generated?.image?.imageBytes) {
          mimeType = 'image/png';
          imageDataUrl = `data:${mimeType};base64,${generated.image.imageBytes}`;
        }
      } catch (fallbackErr: any) {
        throw fallbackErr;
      }
    }

    if (!imageDataUrl) {
      throw new Error('No image was returned by the AI image model. Please try a different prompt.');
    }

    return new Response(
      JSON.stringify({
        image: imageDataUrl,
        mimeType,
        prompt: enhancedPrompt,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    const errMsg = err?.message || 'Failed to generate image';
    const isRateLimit = err?.status === 429 || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
    const isInvalidKey = err?.status === 400 || err?.status === 403 || errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid');

    return new Response(
      JSON.stringify({
        error: isRateLimit
          ? 'Gemini Image Generation rate limit or quota exceeded. Please wait a moment and click Retry.'
          : errMsg,
        code: isRateLimit ? 'RATE_LIMIT' : isInvalidKey ? 'INVALID_KEY' : 'GENERATE_FAILED',
      }),
      {
        status: isRateLimit ? 429 : isInvalidKey ? 401 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
