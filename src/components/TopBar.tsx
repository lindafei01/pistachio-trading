import React from 'react';
import { Box, Text } from 'ink';
import packageJson from '../../package.json';
import { colors } from '../theme.js';
import { getProviderDisplayName } from '../utils/env.js';

export type AppMode = 'RESEARCH' | 'TRADING' | 'PAUSED';

interface TopBarProps {
  provider: string;
  model: string;
  mode: AppMode;
  runState: 'idle' | 'running';
  queued: number;
}

function Pill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Box marginRight={1}>
      <Text backgroundColor={colors.mutedDark} color={colors.muted}>
        {' '}
        {label}
        {': '}
      </Text>
      <Text backgroundColor={colors.mutedDark} color={color || colors.primary}>
        {value}
        {' '}
      </Text>
    </Box>
  );
}

export const TopBar = React.memo(function TopBar({
  provider,
  model,
  mode,
  runState,
  queued,
}: TopBarProps) {
  const modeColor =
    mode === 'TRADING' ? colors.accent : mode === 'PAUSED' ? colors.error : colors.info;
  const runColor = runState === 'running' ? colors.accent : colors.muted;

  return (
    <Box
      width="100%"
      paddingX={1}
      paddingY={0}
      borderStyle="single"
      borderColor={colors.border}
      backgroundColor={colors.panel}
    >
      <Box flexGrow={1}>
        <Text color={colors.accent} bold>
          Dexter
        </Text>
        <Text color={colors.muted}>{` v${packageJson.version}`}</Text>
      </Box>

      <Pill label="Mode" value={mode} color={modeColor} />
      <Pill label="State" value={runState.toUpperCase()} color={runColor} />
      <Pill label="Provider" value={getProviderDisplayName(provider)} />
      <Pill label="Model" value={model} />
      <Pill label="Queue" value={String(queued)} />
    </Box>
  );
});


