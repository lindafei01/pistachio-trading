/**
 * Zod schemas for strategy compilation
 */
import { z } from 'zod';

// ============================================================================
// Trading Signal Schema
// ============================================================================

export const TradingSignalSchema = z.object({
  id: z.string().describe('Unique identifier for this signal'),
  condition: z.string().describe(
    'Boolean condition expression using available data fields. ' +
    'Example: "data.RSI < 30 && data.price > data.SMA_20" or "data.MACD > data.MACD_signal && data.volume > data.volume_avg"'
  ),
  action: z.enum(['BUY', 'SELL', 'HOLD']).describe('Market action when condition is met'),
  positionSize: z.number().min(0).max(1).describe('Position size as fraction of capital (0-1)'),
  confidence: z.number().min(0).max(1).describe('Confidence in this signal (0-1)'),
  reasoning: z.string().describe('Brief explanation of why this signal is valid'),
  priority: z.number().describe('Priority level (higher = more important)'),
});

// ============================================================================
// Risk Parameters Schema
// ============================================================================

export const RiskParametersSchema = z.object({
  maxPositionSize: z.number().min(0).max(1).describe('Maximum position size as fraction of capital'),
  stopLoss: z.number().min(0).max(1).describe('Stop loss as fraction of entry price (e.g., 0.02 = 2%)'),
  takeProfit: z.number().min(0).max(1).describe('Take profit as fraction of entry price (e.g., 0.05 = 5%)'),
  maxDailyLoss: z.number().min(0).max(1).describe('Maximum daily loss as fraction of capital'),
  maxDrawdown: z.number().min(0).max(1).describe('Maximum drawdown tolerance'),
  useDynamicSizing: z.boolean().describe('Whether to use dynamic position sizing based on volatility'),
  riskPerTrade: z.number().min(0).max(0.1).describe('Risk per trade as fraction of capital'),
});

// ============================================================================
// Data Requirements Schema
// ============================================================================

export const DataRequirementsSchema = z.object({
  indicators: z.array(z.string()).describe(
    'List of required technical indicators. ' +
    'Available: RSI, SMA_20, SMA_50, SMA_200, EMA_12, EMA_26, MACD, MACD_signal, BB_upper, BB_lower, ATR, volume_avg'
  ),
  lookback: z.number().min(1).describe('Number of historical periods needed'),
  minDataPoints: z.number().min(1).describe('Minimum data points required before processing'),
});

// ============================================================================
// Compiled Strategy Schema
// ============================================================================

export const CompiledStrategySchema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  timeframe: z.string().describe('Analysis timeframe (e.g., "1min", "5min", "15min", "1hour", "1day")'),
  
  dataRequirements: DataRequirementsSchema,
  signals: z.array(TradingSignalSchema).min(1).describe('List of market signals in priority order'),
  riskParams: RiskParametersSchema,
  
  strategyDescription: z.string().describe('High-level description of the framework'),
  marketContext: z.string().describe('Current market context that informed this framework'),
});

export type CompiledStrategyOutput = z.infer<typeof CompiledStrategySchema>;

