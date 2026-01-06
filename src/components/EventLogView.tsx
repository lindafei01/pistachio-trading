import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import type { HybridUiEvent } from '../trading/ui-events.js';

interface EventLogViewProps {
  events: HybridUiEvent[];
  maxLines?: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

function levelColor(level: HybridUiEvent['level']): string {
  switch (level) {
    case 'info':
      return colors.muted;
    case 'ok':
      return colors.success;
    case 'warn':
      return colors.warning;
    case 'error':
      return colors.error;
  }
}

export const EventLogView = React.memo(function EventLogView({
  events,
  maxLines = 10,
}: EventLogViewProps) {
  if (events.length === 0) return null;

  const visible = events.slice(-maxLines);

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="single"
      borderColor={colors.border}
      backgroundColor={colors.panel}
      paddingX={1}
      paddingY={0}
    >
      <Text color={colors.muted}>Events</Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((e) => (
          <Box key={e.id}>
            <Text color={colors.muted}>{formatTime(e.ts)} </Text>
            <Text color={levelColor(e.level)}>{e.message}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
});


