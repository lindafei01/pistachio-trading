import type { EnrichedMarketData } from './types.js';

/**
 * Compile a simple boolean expression into an executable predicate.
 *
 * Intended for demo use only. We aggressively restrict characters/keywords to reduce risk.
 * Supported patterns:
 * - Comparisons: RSI < 30, SMA_20 > SMA_50, close >= EMA_12
 * - Boolean ops: &&, ||, !
 * - Parentheses
 * - Basic arithmetic: + - * / %
 * - Optional "data." prefix (e.g. data.RSI)
 */
export function compileCondition(expr: string): (data: EnrichedMarketData) => boolean {
  const raw = String(expr ?? '').trim();
  if (!raw) {
    return () => false;
  }

  // Normalize common prefixes
  const normalized = raw.replace(/\bdata\./g, '');

  // Reject obviously dangerous tokens / metacharacters
  const forbidden = [
    ';',
    '`',
    '"',
    "'",
    '\\',
    '[',
    ']',
    '{',
    '}',
  ];
  if (forbidden.some((t) => normalized.includes(t))) {
    throw new Error('Unsupported condition expression (forbidden token)');
  }

  // Restrict to a conservative character set
  if (!/^[\w\s().,!<>=&|+\-*/%]+$/.test(normalized)) {
    throw new Error('Unsupported condition expression (invalid characters)');
  }

  // Disallow a few risky keywords even if they pass the regex
  const lowered = normalized.toLowerCase();
  const badWords = ['constructor', 'prototype', 'process', 'global', 'require', 'import', 'function', 'new'];
  if (badWords.some((w) => lowered.includes(w))) {
    throw new Error('Unsupported condition expression (forbidden keyword)');
  }

  // Compile into a function with explicit locals (no "with", no global access)
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    'ticker',
    'timestamp',
    'price',
    'open',
    'high',
    'low',
    'close',
    'volume',
    'SMA_20',
    'SMA_50',
    'SMA_200',
    'EMA_12',
    'EMA_26',
    'RSI',
    'MACD',
    'MACD_signal',
    'MACD_histogram',
    'BB_upper',
    'BB_middle',
    'BB_lower',
    'ATR',
    'volume_avg',
    'volume_ratio',
    `"use strict"; return Boolean(${normalized});`
  ) as (...args: unknown[]) => boolean;

  return (data: EnrichedMarketData) =>
    fn(
      data.ticker,
      data.timestamp,
      data.price,
      data.open,
      data.high,
      data.low,
      data.close,
      data.volume,
      data.SMA_20,
      data.SMA_50,
      data.SMA_200,
      data.EMA_12,
      data.EMA_26,
      data.RSI,
      data.MACD,
      data.MACD_signal,
      data.MACD_histogram,
      data.BB_upper,
      data.BB_middle,
      data.BB_lower,
      data.ATR,
      data.volume_avg,
      data.volume_ratio
    );
}


