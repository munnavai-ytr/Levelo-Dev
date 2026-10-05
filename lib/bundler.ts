/**
 * Levelo Preview Bundler
 * Reads index.html, inlines local project files (<link href="..."> and <script src="...">),
 * and preserves external CDN scripts (Phaser, Three.js).
 */

export function bundleProjectHtml(files: Record<string, string>): string {
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
    return html;
  }

  // Helper to resolve project file paths (e.g. "./game.js", "game.js", "src/player.js")
  const resolveFileContent = (refPath: string): string | null => {
    // Strip query params or hash
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

  // 1. Replace local stylesheet links with inline <style> tags
  // Matches <link rel="stylesheet" href="..."> and <link href="..." rel="stylesheet">
  html = html.replace(/<link\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, before, href, after) => {
    // Ignore external URLs (http://, https://, //, data:)
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
  // Matches <script ... src="..." ...></script> or self-closing <script ... src="..."/>
  html = html.replace(/<script\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>(\s*<\/script>)?/gi, (match, before, src, after) => {
    // Ignore external URLs (http://, https://, //, data:)
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
      return match;
    }

    const jsContent = resolveFileContent(src);
    if (jsContent !== null) {
      return `<script data-levelo-file="${src}">\n${jsContent}\n</script>`;
    }

    return match;
  });

  return html;
}
