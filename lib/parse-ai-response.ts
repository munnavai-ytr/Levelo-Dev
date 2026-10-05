export interface ParsedAiOutput {
  explanation: string;
  files: Record<string, string>;
  deletedFiles: string[];
  hasFiles: boolean;
}

export function parseAiResponse(rawText: string): ParsedAiOutput {
  const files: Record<string, string> = {};
  const deletedFiles: string[] = [];
  const explanationParts: string[] = [];

  // 1. Check for delete directives: [DELETE: filename] or [REMOVE: filename]
  const deleteRegex = /\[(?:DELETE|REMOVE):\s*([^\]\s]+)\]/gi;
  let delMatch: RegExpExecArray | null;
  while ((delMatch = deleteRegex.exec(rawText)) !== null) {
    const filename = delMatch[1].trim().replace(/^\.?\//, '');
    if (filename && !deletedFiles.includes(filename)) {
      deletedFiles.push(filename);
    }
  }

  // 2. Match code fences: ```[lang] [filename] \n [code] ```
  const codeBlockRegex = /```(?:([a-zA-Z0-9_\-\.\/]+)(?:\s+([^\n\r]+))?)?\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    const precedingText = rawText.slice(lastIndex, match.index).trim();
    if (precedingText) {
      // Remove any delete directives from explanation
      const cleanPreceding = precedingText.replace(deleteRegex, '').trim();
      if (cleanPreceding) {
        explanationParts.push(cleanPreceding);
      }
    }
    lastIndex = match.index + match[0].length;

    const firstToken = (match[1] || '').trim();
    const secondToken = (match[2] || '').trim();
    const code = match[3] || '';

    // Check if code block is a delete directive, e.g. ```delete filename.js```
    if (firstToken.toLowerCase() === 'delete' || firstToken.toLowerCase() === 'rm') {
      const target = (secondToken || code.trim()).replace(/^\.?\//, '');
      if (target && !deletedFiles.includes(target)) {
        deletedFiles.push(target);
      }
      continue;
    }

    let targetFilename = 'index.html';

    if (secondToken) {
      // e.g. ```html index.html or ```javascript game.js
      targetFilename = secondToken.replace(/^\.?\//, '').replace(/["']/g, '');
    } else if (firstToken.includes('.')) {
      // e.g. ```index.html or ```game.js
      targetFilename = firstToken.replace(/^\.?\//, '').replace(/["']/g, '');
    } else if (firstToken === 'css') {
      targetFilename = 'style.css';
    } else if (firstToken === 'js' || firstToken === 'javascript') {
      targetFilename = 'game.js';
    } else if (firstToken === 'html') {
      targetFilename = 'index.html';
    } else if (code.includes('<!DOCTYPE') || code.includes('<html')) {
      targetFilename = 'index.html';
    }

    files[targetFilename] = code.trim();
  }

  // Trailing explanation
  const trailing = rawText.slice(lastIndex).replace(deleteRegex, '').trim();
  if (trailing) {
    explanationParts.push(trailing);
  }

  let explanation = explanationParts.join('\n\n').trim();

  // Fallback: if no code fences matched but text contains full HTML document
  if (Object.keys(files).length === 0 && deletedFiles.length === 0 && (rawText.includes('<!DOCTYPE html>') || rawText.includes('<html'))) {
    const htmlStart = rawText.indexOf('<!DOCTYPE html>');
    const effectiveStart = htmlStart >= 0 ? htmlStart : rawText.indexOf('<html');
    const htmlEnd = rawText.lastIndexOf('</html>');
    if (effectiveStart >= 0 && htmlEnd > effectiveStart) {
      files['index.html'] = rawText.substring(effectiveStart, htmlEnd + 7).trim();
      explanation = rawText.substring(0, effectiveStart).trim();
    }
  }

  const hasFiles = Object.keys(files).length > 0 || deletedFiles.length > 0;

  return {
    explanation: explanation || (hasFiles ? 'Updated game files.' : rawText),
    files,
    deletedFiles,
    hasFiles
  };
}
