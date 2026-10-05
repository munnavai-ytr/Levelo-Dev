export interface ParsedAiOutput {
  explanation: string;
  files: Record<string, string>;
  hasFiles: boolean;
}

export function parseAiResponse(rawText: string): ParsedAiOutput {
  const files: Record<string, string> = {};
  let explanation = '';

  // Match code fences: ```[lang] [filename] \n [code] ```
  // Regex handles variations like:
  // ```html index.html
  // ```index.html
  // ```html
  // ```javascript
  const codeBlockRegex = /```(?:([a-zA-Z0-9_-]+)(?:\s+([^\n\r]+))?)?\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  const explanationParts: string[] = [];

  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    // Collect explanation before this code block
    const precedingText = rawText.slice(lastIndex, match.index).trim();
    if (precedingText) {
      explanationParts.push(precedingText);
    }
    lastIndex = match.index + match[0].length;

    const lang = (match[1] || '').trim();
    const filenameHint = (match[2] || '').trim();
    const code = match[3] || '';

    let targetFilename = 'index.html';

    if (filenameHint) {
      targetFilename = filenameHint;
    } else if (lang.includes('.')) {
      targetFilename = lang;
    } else if (code.includes('<!DOCTYPE') || code.includes('<html') || code.includes('<canvas')) {
      targetFilename = 'index.html';
    }

    files[targetFilename] = code.trim();
  }

  // Trailing explanation
  const trailing = rawText.slice(lastIndex).trim();
  if (trailing) {
    explanationParts.push(trailing);
  }

  explanation = explanationParts.join('\n\n').trim();

  // If no code block regex matched but text contains full HTML document
  if (Object.keys(files).length === 0 && (rawText.includes('<!DOCTYPE html>') || rawText.includes('<html'))) {
    const htmlStart = rawText.indexOf('<!DOCTYPE html>');
    const effectiveStart = htmlStart >= 0 ? htmlStart : rawText.indexOf('<html');
    const htmlEnd = rawText.lastIndexOf('</html>');
    if (effectiveStart >= 0 && htmlEnd > effectiveStart) {
      files['index.html'] = rawText.substring(effectiveStart, htmlEnd + 7).trim();
      explanation = rawText.substring(0, effectiveStart).trim();
    }
  }

  return {
    explanation: explanation || 'Updated game code applied to index.html.',
    files,
    hasFiles: Object.keys(files).length > 0
  };
}
