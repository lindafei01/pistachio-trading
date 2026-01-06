/**
 * Strategy Diagnostics
 * 
 * Analyzes why a strategy might not be generating trades
 */

import type { CompiledStrategy } from './types.js';
import type { BacktestResult } from './backtesting.js';

export interface DiagnosisResult {
  reason: string;
  suggestions: string[];
}

/**
 * Diagnose why a backtest produced no trades
 */
export function diagnoseNoTrades(
  strategy: CompiledStrategy,
  backtestResult: BacktestResult,
  historicalDataPoints: number
): DiagnosisResult {
  const suggestions: string[] = [];
  let reason = 'Strategy signals were never triggered during the backtest period.';

  // Check if there's enough data
  if (historicalDataPoints < 100) {
    reason = `Insufficient historical data (${historicalDataPoints} points). Need at least 100 data points.`;
    suggestions.push('Try extending the lookback period to 6 months or 1 year');
    return { reason, suggestions };
  }

  // Analyze signals
  const buySignals = strategy.signals.filter(s => s.action === 'BUY');
  const sellSignals = strategy.signals.filter(s => s.action === 'SELL');

  if (buySignals.length === 0) {
    reason = 'No BUY signals defined in the strategy.';
    suggestions.push('Strategy needs at least one buy condition');
    return { reason, suggestions };
  }

  // Check for overly restrictive conditions
  const hasComplexConditions = strategy.signals.some(s => {
    if (typeof s.condition === 'string') {
      return s.condition.includes('&&') || s.condition.split(/AND|and|\&\&/).length > 2;
    }
    return false;
  });

  if (hasComplexConditions) {
    reason = 'Signal conditions may be too restrictive (multiple AND conditions).';
    suggestions.push('Try simplifying conditions or using OR logic');
    suggestions.push('Consider relaxing indicator thresholds (e.g., RSI < 35 instead of < 30)');
  }

  // Check for indicator-heavy strategies
  const indicatorCount = strategy.dataRequirements.indicators.length;
  if (indicatorCount > 3) {
    reason = `Strategy uses many indicators (${indicatorCount}), which may require rare market conditions.`;
    suggestions.push('Try reducing the number of indicators or using simpler rules');
  }

  // Check lookback period
  const lookback = strategy.dataRequirements.lookback;
  if (lookback > historicalDataPoints / 2) {
    reason = `Lookback period (${lookback}) is too long relative to available data (${historicalDataPoints} points).`;
    suggestions.push(`Reduce lookback to ${Math.floor(historicalDataPoints / 3)} or less`);
  }

  // Generic suggestions
  if (suggestions.length === 0) {
    suggestions.push('Try a longer backtest period (6 months or 1 year)');
    suggestions.push('Consider using trend-following signals (moving average crossovers)');
    suggestions.push('Relax buy/sell thresholds (e.g., RSI < 40 instead of < 30)');
  }

  return { reason, suggestions };
}

/**
 * Generate a human-readable diagnosis message
 */
export function formatDiagnosis(diagnosis: DiagnosisResult): string {
  let message = diagnosis.reason;
  
  if (diagnosis.suggestions.length > 0) {
    message += '\n\nSuggestions:\n';
    diagnosis.suggestions.forEach((s, i) => {
      message += `${i + 1}. ${s}\n`;
    });
  }
  
  return message.trim();
}

