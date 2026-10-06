/**
 * Levelo Asset Utilities
 * Client-side compression, thumbnail generation, format conversion, and size validations.
 */

import type { AssetType, ProjectAsset } from './types';

export const MAX_IMAGE_SIZE_BYTES = 250 * 1024; // 250 KB limit for images
export const MAX_AUDIO_SIZE_BYTES = 600 * 1024; // 600 KB limit for audio
export const PROJECT_TOTAL_BUDGET_BYTES = 8 * 1024 * 1024; // 8 MB per project budget
export const BUDGET_WARNING_THRESHOLD_BYTES = 0.8 * PROJECT_TOTAL_BUDGET_BYTES; // 6.4 MB (80%)

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function detectAssetType(fileName: string, mimeType: string): AssetType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext) || mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (fileName.includes('tile') || fileName.includes('tileset')) {
    return 'tileset';
  }
  if (fileName.includes('bg') || fileName.includes('background')) {
    return 'background';
  }
  if (fileName.includes('icon') || fileName.includes('ui_') || fileName.includes('btn')) {
    return 'ui_icon';
  }
  if (fileName.includes('sprite') || fileName.includes('hero') || fileName.includes('player') || fileName.includes('enemy')) {
    return 'sprite';
  }
  return 'image';
}

/**
 * Loads an image from a File or Data URL into an HTMLImageElement.
 */
export function loadImageElement(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to decode image data'));

    if (typeof src === 'string') {
      img.src = src;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(src);
    }
  });
}

/**
 * Compresses an image to WebP with max 1024px dimension, aiming for <250KB,
 * and creates a lightweight thumbnail for fast grid rendering.
 */
export async function processAndCompressImage(
  source: File | string,
  preferredName?: string
): Promise<{
  dataUrl: string;
  thumbnail: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
}> {
  // If source is an SVG string or file, keep vector format or convert cleanly
  if (source instanceof File && (source.type === 'image/svg+xml' || source.name.endsWith('.svg'))) {
    const text = await source.text();
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(text)}`;
    const size = new Blob([text]).size;
    if (size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`SVG file (${formatBytes(size)}) exceeds the 250KB limit.`);
    }
    return {
      dataUrl,
      thumbnail: dataUrl,
      width: 512,
      height: 512,
      size,
      mimeType: 'image/svg+xml'
    };
  }

  const img = await loadImageElement(source);
  let width = img.naturalWidth || img.width || 512;
  let height = img.naturalHeight || img.height || 512;

  // Max dimension 1024px constraint
  const MAX_DIM = 1024;
  if (width > MAX_DIM || height > MAX_DIM) {
    if (width > height) {
      height = Math.round((height * MAX_DIM) / width);
      width = MAX_DIM;
    } else {
      width = Math.round((width * MAX_DIM) / height);
      height = MAX_DIM;
    }
  }

  // Draw on canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(img, 0, 0, width, height);

  // Compress to WebP with iterative quality control to stay under 250KB
  let quality = 0.88;
  let dataUrl = canvas.toDataURL('image/webp', quality);
  let size = estimateBase64Size(dataUrl);

  while (size > MAX_IMAGE_SIZE_BYTES && quality > 0.3) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL('image/webp', quality);
    size = estimateBase64Size(dataUrl);
  }

  if (size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `Image size (${formatBytes(size)}) exceeds the 250KB limit after compression. Please choose a smaller image.`
    );
  }

  // Create lightweight thumbnail (max 128px)
  const thumbDim = 128;
  let thumbW = width;
  let thumbH = height;
  if (thumbW > thumbDim || thumbH > thumbDim) {
    if (thumbW > thumbH) {
      thumbH = Math.round((thumbH * thumbDim) / thumbW);
      thumbW = thumbDim;
    } else {
      thumbW = Math.round((thumbW * thumbDim) / thumbH);
      thumbH = thumbDim;
    }
  }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext('2d');
  if (thumbCtx) {
    thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);
  }
  const thumbnail = thumbCanvas.toDataURL('image/webp', 0.7);

  return {
    dataUrl,
    thumbnail,
    width,
    height,
    size,
    mimeType: 'image/webp'
  };
}

/**
 * Validates and processes an audio file (under 600KB).
 */
export async function processAudioFile(file: File): Promise<{
  dataUrl: string;
  size: number;
  mimeType: string;
  duration?: number;
}> {
  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    throw new Error(
      `Audio file (${formatBytes(file.size)}) exceeds the 600KB limit. Please use a shorter or more compressed sound clip.`
    );
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read audio file'));
    reader.readAsDataURL(file);
  });

  // Calculate audio duration if WebAudio is available
  let duration: number | undefined;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      duration = Math.round(audioBuffer.duration * 100) / 100;
      await audioCtx.close();
    }
  } catch {
    // Non-fatal if duration cannot be extracted
  }

  return {
    dataUrl,
    size: file.size,
    mimeType: file.type || 'audio/wav',
    duration
  };
}

export function estimateBase64Size(dataUrl: string): number {
  const base64Str = dataUrl.split(',')[1] || '';
  const padding = (base64Str.endsWith('==') ? 2 : base64Str.endsWith('=') ? 1 : 0);
  return Math.round((base64Str.length * 3) / 4) - padding;
}

export function sanitizeAssetFileName(rawName: string, ext = 'webp'): string {
  const clean = rawName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_');
  
  if (clean.includes('.')) {
    return clean;
  }
  return `${clean}.${ext}`;
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
