import React, { useMemo, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

import { colors } from '../theme.js';

interface InputProps {
  onSubmit: (value: string) => void;
}

function sanitizeIncomingText(raw: string): string {
  // Normalize paste newlines into spaces so a multi-line paste doesn't get split into multiple submits.
  let s = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, ' ');

  // Strip bracketed paste markers if the terminal sends them through.
  s = s.replace(/\u001b\[200~|\u001b\[201~/g, '');

  return s;
}

// Helper to wrap text to terminal width
function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text];
  
  const lines: string[] = [];
  let currentLine = '';
  
  // Split by spaces to preserve word boundaries
  const words = text.split(' ');
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If a single word is longer than maxWidth, break it
      if (word.length > maxWidth) {
        for (let i = 0; i < word.length; i += maxWidth) {
          lines.push(word.slice(i, i + maxWidth));
        }
        currentLine = '';
      } else {
        currentLine = word;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

export function Input({ onSubmit }: InputProps) {
  // Input manages its own state - typing won't cause parent re-renders
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const { stdout } = useStdout();

  // Keep cursor in bounds whenever value changes.
  const safeCursor = Math.max(0, Math.min(cursor, value.length));

  const handleSubmit = (val: string) => {
    if (!val.trim()) return;
    onSubmit(val);
    setValue('');
    setCursor(0);
  };

  useInput((input, key) => {
    // Debug: log key events
    if (process.env.DEBUG_INPUT === 'true') {
      console.error(`[Input] key event: input="${input}" (charCodes: ${[...input].map(c => c.charCodeAt(0)).join(',')}), key=`, JSON.stringify(key));
    }

    // Let outer app handle Ctrl+C etc.
    if (key.ctrl) return;

    if (key.return) {
      handleSubmit(value);
      return;
    }

    if (key.escape) return;

    if (key.leftArrow) {
      setCursor(c => Math.max(0, c - 1));
      return;
    }
    if (key.rightArrow) {
      setCursor(c => Math.min(value.length, c + 1));
      return;
    }
    // Home/End are not consistently normalized by Ink across terminals; skip for portability.

    // Handle backspace: either key.backspace or charCode 127 (DEL character used by many terminals)
    const isBackspace = key.backspace || (input.length === 1 && input.charCodeAt(0) === 127);
    
    if (isBackspace || key.delete) {
      if (process.env.DEBUG_INPUT === 'true') {
        console.error(`[Input] Delete key detected: backspace=${isBackspace}, delete=${key.delete}, cursor=${cursor}, value.length=${value.length}`);
      }
    }

    if (isBackspace) {
      const pos = Math.max(0, Math.min(cursor, value.length));
      if (pos === 0) return;
      setValue(value.slice(0, pos - 1) + value.slice(pos));
      setCursor(pos - 1);
      return;
    }

    if (key.delete) {
      const pos = Math.max(0, Math.min(cursor, value.length));
      if (pos >= value.length) return;
      setValue(value.slice(0, pos) + value.slice(pos + 1));
      return;
    }

    // Insert typed/pasted characters.
    const incoming = sanitizeIncomingText(input);
    if (!incoming) return;

    const pos = Math.max(0, Math.min(cursor, value.length));
    setValue(value.slice(0, pos) + incoming + value.slice(pos));
    setCursor(pos + incoming.length);
  });

  // Show preview if query is longer than 60 characters
  const showPreview = value.length > 60;
  
  // Calculate available width for preview
  // Terminal width minus: left border (1) + left padding (1) + right padding (1) + right border (1) = 4
  const terminalWidth = stdout.columns || 80;
  const previewWidth = Math.max(40, terminalWidth - 4);
  const previewLines = useMemo(() => (showPreview ? wrapText(value, previewWidth) : []), [showPreview, value, previewWidth]);
  
  // Debug: log to help diagnose width issues
  if (showPreview && previewLines.length > 0 && process.env.DEBUG_INPUT === 'true') {
    console.error(`[Input] value.length=${value.length}, terminalWidth=${terminalWidth}, previewWidth=${previewWidth}, lines=${previewLines.length}`);
    console.error(`[Input] full value: "${value}"`);
    previewLines.forEach((line, i) => {
      console.error(`[Input] line ${i}: length=${line.length}, content="${line}"`);
    });
    const totalChars = previewLines.reduce((sum, line) => sum + line.length, 0);
    // wrapText drops the spaces at wrap boundaries; account for that for this diagnostic.
    const approxExpected = value.length - Math.max(0, previewLines.length - 1);
    console.error(`[Input] total chars in lines: ${totalChars}, approxExpected: ${approxExpected}`);
  }

  // Render a single-line editor view with a visible cursor, while the preview shows full multi-line wrap.
  const prompt = '> ';
  const countSuffix = value.length > 50 ? ` (${value.length})` : '';
  const contentWidth = Math.max(10, terminalWidth - 4 - prompt.length - countSuffix.length); // rough: borders+padding

  const windowStart = Math.min(
    Math.max(0, safeCursor - Math.floor(contentWidth * 0.7)),
    Math.max(0, value.length - contentWidth)
  );
  const windowEnd = Math.min(value.length, windowStart + contentWidth);
  const slice = value.slice(windowStart, windowEnd);
  const cursorInSlice = safeCursor - windowStart;

  const before = slice.slice(0, cursorInSlice);
  const at = slice[cursorInSlice] ?? ' ';
  const after = slice.slice(cursorInSlice + 1);
  const showLeftEllipsis = windowStart > 0;
  const showRightEllipsis = windowEnd < value.length;

  return (
    <Box 
      flexDirection="column" 
      marginBottom={1}
      borderStyle="single"
      borderColor={colors.border}
      borderLeft={false}
      borderRight={false}
    >
      {/* Preview area - shows full query if it's long */}
      {showPreview && previewLines.length > 0 && (
        <Box 
          paddingX={1} 
          paddingY={0}
          backgroundColor={colors.panel}
          borderTop={false}
          borderBottom={true}
          borderStyle="single"
          borderColor={colors.border}
          flexDirection="column"
          minHeight={previewLines.length}
        >
          <Box flexDirection="column">
            {previewLines.map((line, idx) => (
              <Box key={idx}>
                <Text color={colors.muted}>
                  {line}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      
      {/* Input line */}
      <Box paddingX={1} backgroundColor={colors.panel}>
        <Text color={colors.accent} bold>
          {'> '}
        </Text>
        {showLeftEllipsis && <Text color={colors.muted}>…</Text>}
        <Text>{before}</Text>
        <Text inverse>{at}</Text>
        <Text>{after}</Text>
        {showRightEllipsis && <Text color={colors.muted}>…</Text>}
        {/* Character count for long inputs */}
        {value.length > 50 && (
          <Text color={colors.muted} dimColor>
            {' '}({value.length})
          </Text>
        )}
      </Box>
    </Box>
  );
}
