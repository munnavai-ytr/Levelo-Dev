/**
 * Levelo Chroma-Key Transparency Utility
 * Removes solid background colors (green screen, solid white, dark or corner-sampled background)
 * from AI generated sprites on client canvas.
 */

export interface ChromaKeyOptions {
  targetColor?: { r: number; g: number; b: number }; // RGB color to remove
  tolerance?: number; // 0 to 100 (default 30)
  smoothness?: number; // 0 to 20 edge feathering (default 5)
  autoSampleCorner?: boolean; // if true, samples corner pixel (0,0) as background
}

export async function removeImageBackground(
  imageSource: string | HTMLImageElement,
  options: ChromaKeyOptions = {}
): Promise<{ dataUrl: string; width: number; height: number }> {
  const {
    targetColor = { r: 0, g: 255, b: 0 }, // default bright green
    tolerance = 35,
    smoothness = 8,
    autoSampleCorner = false,
  } = options;

  let img: HTMLImageElement;
  if (typeof imageSource === 'string') {
    img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image for chroma key'));
      el.src = imageSource;
    });
  } else {
    img = imageSource;
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  let keyR = targetColor.r;
  let keyG = targetColor.g;
  let keyB = targetColor.b;

  if (autoSampleCorner) {
    // Sample top-left corner
    keyR = data[0];
    keyG = data[1];
    keyB = data[2];
  }

  const maxDist = (tolerance / 100) * 441.67; // 441.67 is max Euclidean distance in RGB space
  const smoothDist = (smoothness / 100) * 100;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Euclidean distance in RGB color space
    const dist = Math.sqrt(
      Math.pow(r - keyR, 2) + Math.pow(g - keyG, 2) + Math.pow(b - keyB, 2)
    );

    if (dist < maxDist) {
      if (smoothDist > 0 && dist > maxDist - smoothDist) {
        // Feather edge smoothly
        const alphaFraction = (dist - (maxDist - smoothDist)) / smoothDist;
        data[i + 3] = Math.round(data[i + 3] * alphaFraction);
      } else {
        // Fully transparent
        data[i + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}
