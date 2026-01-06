#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import { CLI } from './cli.js';

// Load environment variables
config({ override: true, quiet: true });

// Ink needs an interactive TTY for raw mode input. If output is piped (non-TTY),
// fail gracefully with a helpful message instead of throwing.
const hasTty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
if (!hasTty) {
  // Keep this minimal: the interactive UI must be run in a real terminal.
  console.error('Dexter CLI requires an interactive TTY. Run without piping (no `| head`, no redirect).');
  process.exit(1);
}

// Render the CLI app
render(<CLI />);
