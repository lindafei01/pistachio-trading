/**
 * Trading Module
 * 
 * Exports all trading-related functionality for extending the Deep Research Agent
 * with high-frequency trading capabilities.
 */

// Main components
export { HybridOrchestrator } from './hybrid-orchestrator.js';
export { FastTradingEngine } from './fast-engine.js';
export { StrategyCompiler } from './strategy-compiler.js';
export { IndicatorCalculator } from './indicators.js';
export { BacktestEngine } from './backtesting.js';
export { fetchYahooHistoricalData, timeframeToYahooInterval } from './data/yahoo.js';
export type { HybridMode, HybridUiEvent, HybridUiEventLevel } from './ui-events.js';
export { newUiEvent } from './ui-events.js';

// Types
export type {
  MarketData,
  EnrichedMarketData,
  CompiledStrategy,
  TradingSignal,
  TradeDecision,
  ExecutionResult,
  DataRequirements,
  RiskParameters,
  TradingEngineConfig,
  HybridOrchestratorConfig,
  IndicatorCache,
} from './types.js';

export type {
  BacktestConfig,
  BacktestMetrics,
  BacktestResult,
  Position,
  Trade,
} from './backtesting.js';

// Schemas
export {
  CompiledStrategySchema,
  TradingSignalSchema,
  RiskParametersSchema,
  DataRequirementsSchema,
} from './schemas.js';




