import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import packageJson from '../../package.json';
import { getProviderDisplayName } from '../utils/env.js';

interface IntroProps {
  provider: string;
}

export function Intro({ provider }: IntroProps) {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1} paddingX={1}>
      <Box>
        <Text color={colors.accent} bold>
          Pistachio
        </Text>
        <Text color={colors.muted}>{` v${packageJson.version}`}</Text>
      </Box>
      <Text color={colors.muted}>
        {`Provider: ${getProviderDisplayName(provider)}  ·  Type /model to switch  ·  Ctrl+C to cancel/quit`}
      </Text>
    </Box>
  );
}
