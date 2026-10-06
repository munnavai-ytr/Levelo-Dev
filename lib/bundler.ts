/**
 * Levelo Preview Bundler
 * Reads index.html, inlines local project files (<link href="..."> and <script src="...">),
 * resolves project assets (e.g. "assets/hero.webp", "assets/jump.wav") to data URLs,
 * and preserves external CDN scripts (Phaser, Three.js).
 */

import type { ProjectAsset } from './types';

export function bundleProjectHtml(
  files: Record<string, string>,
  assets: ProjectAsset[] = []
): string {
  let html = files['index.html'];

  if (!html) {
    // If no index.html exists, create a minimal wrapper that runs the main JS file if available
    const mainJs = files['game.js'] || files['main.js'] || Object.keys(files).find(k => k.endsWith('.js'));
    const mainCss = files['style.css'] || Object.keys(files).find(k => k.endsWith('.css'));

    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Levelo Game</title>
  <script src="/libs/phaser.min.js"></script>
  ${mainCss ? `<style>${files[mainCss]}</style>` : ''}
</head>
<body style="margin:0;padding:0;overflow:hidden;background:#020617;display:flex;align-items:center;justify-content:center;height:100vh;">
  ${mainJs ? `<script>${files[mainJs]}</script>` : '<div style="color:#94a3b8;font-family:sans-serif;font-size:14px;">No index.html or game.js found</div>'}
</body>
</html>`;
  }

  // Helper to resolve project file paths (e.g. "./game.js", "game.js", "src/player.js")
  const resolveFileContent = (refPath: string): string | null => {
    const cleanRef = refPath.split('?')[0].split('#')[0];
    const stripped = cleanRef.replace(/^\.?\//, ''); // strip ./ or /

    if (files[stripped] !== undefined) return files[stripped];
    if (files[cleanRef] !== undefined) return files[cleanRef];

    // Fallback: match by filename
    const filenameOnly = stripped.split('/').pop();
    if (filenameOnly) {
      for (const [key, content] of Object.entries(files)) {
        if (key === filenameOnly || key.endsWith('/' + filenameOnly)) {
          return content;
        }
      }
    }

    return null;
  };

  // Build assets dictionary: normalized path -> data URL
  const assetMap: Record<string, string> = {};
  for (const asset of assets) {
    if (asset.data) {
      const cleanPath = asset.path.replace(/^\.?\//, '');
      assetMap[cleanPath] = asset.data;
      assetMap[asset.name] = asset.data;
      assetMap[`assets/${asset.name}`] = asset.data;
      assetMap[`./assets/${asset.name}`] = asset.data;
    }
  }

  // 1. Replace local stylesheet links with inline <style> tags
  html = html.replace(/<link\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, before, href, after) => {
    if (/^(https?:)?\/\//i.test(href) || href.startsWith('data:')) {
      return match;
    }

    const fullTag = before + ' ' + after;
    const isStylesheet = /rel=["']stylesheet["']/i.test(fullTag) || href.endsWith('.css');

    if (isStylesheet) {
      const cssContent = resolveFileContent(href);
      if (cssContent !== null) {
        return `<style data-levelo-file="${href}">\n${cssContent}\n</style>`;
      }
    }

    return match;
  });

  // 2. Replace local script tags with inline <script> tags
  html = html.replace(/<script\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>(\s*<\/script>)?/gi, (match, before, src) => {
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
      return match;
    }

    const jsContent = resolveFileContent(src);
    if (jsContent !== null) {
      return `<script data-levelo-file="${src}">\n${jsContent}\n</script>`;
    }

    return match;
  });

  // 3. Replace direct asset image/audio src in HTML tags
  if (Object.keys(assetMap).length > 0) {
    html = html.replace(/src=["'](assets\/[^"']+|\.\/assets\/[^"']+)["']/gi, (match, assetPath) => {
      const clean = assetPath.replace(/^\.?\//, '');
      if (assetMap[clean]) {
        return `src="${assetMap[clean]}"`;
      }
      return match;
    });
  }

  // 4. Inject runtime Asset Resolver shim before any other scripts in <head>
  // Intercepts fetch, XMLHttpRequest, HTMLImageElement, HTMLAudioElement, and Phaser loader
  const assetShimScript = `
<script id="levelo-asset-resolver">
(function() {
  window.__LEVELO_ASSETS__ = ${JSON.stringify(assetMap)};
  
  function resolveLeveloAsset(url) {
    if (!url || typeof url !== 'string') return url;
    var clean = url.split('?')[0].split('#')[0].replace(/^\\.?\\//, '');
    if (window.__LEVELO_ASSETS__[clean]) return window.__LEVELO_ASSETS__[clean];
    if (window.__LEVELO_ASSETS__['assets/' + clean]) return window.__LEVELO_ASSETS__['assets/' + clean];
    var fname = clean.split('/').pop();
    if (fname && window.__LEVELO_ASSETS__[fname]) return window.__LEVELO_ASSETS__[fname];
    return url;
  }

  // Override fetch
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string') {
      var resolved = resolveLeveloAsset(input);
      if (resolved !== input) {
        return origFetch(resolved, init);
      }
    }
    return origFetch.apply(this, arguments);
  };

  // Override Image src
  var origImageDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (origImageDescriptor && origImageDescriptor.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set: function(val) {
        origImageDescriptor.set.call(this, resolveLeveloAsset(val));
      },
      get: origImageDescriptor.get,
      configurable: true
    });
  }

  // Override Audio src
  var origAudioDescriptor = Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype, 'src');
  if (origAudioDescriptor && origAudioDescriptor.set) {
    Object.defineProperty(HTMLAudioElement.prototype, 'src', {
      set: function(val) {
        origAudioDescriptor.set.call(this, resolveLeveloAsset(val));
      },
      get: origAudioDescriptor.get,
      configurable: true
    });
  }
})();
</script>
`;

  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n${assetShimScript}`);
  } else if (html.includes('<html>')) {
    html = html.replace('<html>', `<html>\n<head>${assetShimScript}</head>`);
  } else {
    html = assetShimScript + html;
  }

  return html;
}
