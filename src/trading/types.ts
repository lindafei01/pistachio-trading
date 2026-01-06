/**
 * Trading Module Types
 * 
 * Defines types for the high-frequency trading capabilities that extend
 * the Deep Research Agent with real-time execution.
 */

// ============================================================================
// Market Data Types
// ============================================================================

/**
 * Basic market data point
 */
export interface MarketData {
  ticker: string;
  timestamp: number;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Market data enriched with technical indicators
 */
export interface EnrichedMarketData extends MarketData {
  // Moving Averages
  SMA_20?: number;
  SMA_50?: number;
  SMA_200?: number;
  EMA_12?: number;
  EMA_26?: number;
  
  // Momentum Indicators
  RSI?: number;
  MACD?: number;
  MACD_signal?: number;
  MACD_histogram?: number;
  
  // Volatility
  BB_upper?: number;
  BB_middle?: number;
  BB_lower?: number;
  ATR?: number;
  
  // Volume
  volume_avg?: number;
  volume_ratio?: number;
}

// ============================================================================
// Strategy Types
// ============================================================================

/**
 * Data requirements for a strategy
 */
export interface DataRequirements {
  indicators: string[];
  lookback: number;
  minDataPoints: number;
}

/**
 * Trading signal with condition and action
 */
export interface TradingSignal {
  id: string;
  
  // Condition (can be string expression or compiled function)
  condition: string | ((data: EnrichedMarketData) => boolean);
  
  // Action to take when condition is met
  action: 'BUY' | 'SELL' | 'HOLD';
  positionSize: number;
  
  // Metadata
  confidence: number;
  reasoning: string;
  priority: number;
}

/**
 * Risk management parameters
 */
export interface RiskParameters {
  maxPositionSize: number;
  stopLoss: number;
  takeProfit: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  
  // Position sizing
  useDynamicSizing: boolean;
  riskPerTrade: number;
}

/**
 * Compiled trading strategy (executable without LLM)
 */
export interface CompiledStrategy {
  id: string;
  ticker: string;
  timeframe: string;
  
  // Data requirements
  dataRequirements: DataRequirements;
  
  // Decision logic
  signals: TradingSignal[];
  
  // Risk management
  riskParams: RiskParameters;
  
  // Metadata
  compiledAt: Date;
  expiresAt: Date;
  sourceQuery: string;
  
  // Performance tracking
  stats?: StrategyStats;
}

/**
 * Strategy performance statistics
 */
export interface StrategyStats {
  totalTrades: number;
  winRate: number;
  profitLoss: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  lastUpdated: Date;
}

// ============================================================================
// Trading Decision Types
// ============================================================================

/**
 * A trading decision made by the engine
 */
export interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  ticker: string;
  positionSize: number;
  
  // Price levels
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  
  // Metadata
  confidence: number;
  reasoning: string;
  signalId: string;
  latency: number;
  timestamp: number;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  decision: TradeDecision;
  executed: boolean;
  executionPrice?: number;
  executionTime?: number;
  error?: string;
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Indicator cache for incremental updates
 */
export interface IndicatorCache {
  ticker: string;
  lastUpdate: number;
  
  // Cached intermediate values for O(1) updates
  rsiState?: {
    avgGain: number;
    avgLoss: number;
    lastPrice: number;
  };
  
  smaState?: Map<number, {
    sum: number;
    count: number;
  }>;
  
  emaState?: Map<number, {
    value: number;
  }>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Trading engine configuration
 */
export interface TradingEngineConfig {
  // Performance
  maxLatencyMs: number;
  enableCaching: boolean;
  
  // Data
  maxCacheSize: number;
  dataRetentionMs: number;
  
  // Risk
  defaultRiskParams: RiskParameters;
  
  // Monitoring
  enableMetrics: boolean;
  logTrades: boolean;
}

/**
 * Hybrid orchestrator configuration
 */
export interface HybridOrchestratorConfig {
  // Strategy refresh
  strategyRefreshIntervalMs: number;
  
  // Model selection
  researchModel: string;
  
  // Watchlist
  watchlist: string[];
  
  // Trading engine
  engineConfig: TradingEngineConfig;
}




