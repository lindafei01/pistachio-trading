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

    // Handle backspace/delete: in many terminals, Backspace is mapped to Delete
    // To ensure it works everywhere, we treat BOTH keys as backspace (delete left)
    const has127 = input.length > 0 && [...input].some(c => c.charCodeAt(0) === 127);
    const isDeleteKey = key.backspace || key.delete || has127;
    
    if (isDeleteKey) {
      const pos = Math.max(0, Math.min(cursor, value.length));
      if (pos === 0) return; // Nothing to delete
      
      // Count how many 127s (might be multiple backspaces pressed together)
      const deleteCount = has127 ? Math.min([...input].filter(c => c.charCodeAt(0) === 127).length, pos) : 1;
      
      setValue(value.slice(0, pos - deleteCount) + value.slice(pos));
      setCursor(pos - deleteCount);
      return;
    }

    // Insert typed/pasted characters.
    const incoming = sanitizeIncomingText(input);
    if (!incoming) return;

    const pos = Math.max(0, Math.min(cursor, value.length));
    setValue(value.slice(0, pos) + incoming + value.slice(pos));
    setCursor(pos + incoming.length);
  });

  // Calculate terminal width for wrapping
  const terminalWidth = stdout.columns || 80;
  const contentWidth = Math.max(40, terminalWidth - 6); // Account for prompt and padding
  
  // Split text into lines that fit the terminal width (memoized for performance)
  const lines = useMemo(() => wrapText(value, contentWidth), [value, contentWidth]);
  
  // Find which line the cursor is on and where in that line (memoized for performance)
  const { cursorLine, cursorCol } = useMemo(() => {
    let charCount = 0;
    let line = 0;
    let col = safeCursor;
    
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length;
      if (charCount + lineLength >= safeCursor) {
        line = i;
        col = safeCursor - charCount;
        break;
      }
      charCount += lineLength + 1; // +1 for the space that was removed during wrapping
    }
    
    return { cursorLine: line, cursorCol: col };
  }, [lines, safeCursor]);

  return (
    <Box 
      flexDirection="column" 
      marginBottom={1}
      borderStyle="single"
      borderColor={colors.border}
      borderLeft={false}
      borderRight={false}
    >
      {/* Multi-line input display */}
      <Box flexDirection="column" paddingX={1} backgroundColor={colors.panel}>
        {lines.length === 0 ? (
          // Empty input
          <Box>
            <Text color={colors.accent} bold>{'> '}</Text>
            <Text inverse> </Text>
          </Box>
        ) : (
          // Display all lines with cursor on the correct line
          lines.map((line, lineIdx) => (
            <Box key={lineIdx}>
              {lineIdx === 0 && (
                <Text color={colors.accent} bold>{'> '}</Text>
              )}
              {lineIdx > 0 && (
                <Text color={colors.accent} bold>{'  '}</Text>
              )}
              
              {lineIdx === cursorLine ? (
                // This line contains the cursor
                <>
                  <Text>{line.slice(0, cursorCol)}</Text>
                  <Text inverse>{line[cursorCol] ?? ' '}</Text>
                  <Text>{line.slice(cursorCol + 1)}</Text>
                </>
              ) : (
                // Regular line without cursor
                <Text>{line}</Text>
              )}
            </Box>
          ))
        )}
        
        {/* Character count for long inputs */}
        {value.length > 100 && (
          <Box>
            <Text color={colors.muted} dimColor>
              ({value.length} characters)
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
