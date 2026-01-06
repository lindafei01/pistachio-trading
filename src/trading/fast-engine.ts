/**
 * Fast Trading Engine
 * 
 * High-frequency trading execution engine with sub-millisecond latency.
 * Executes pre-compiled strategies without LLM calls.
 */

import { IndicatorCalculator } from './indicators.js';
import { compileCondition } from './condition-compiler.js';
import type {
  CompiledStrategy,
  MarketData,
  EnrichedMarketData,
  TradeDecision,
  TradingEngineConfig,
  ExecutionResult,
} from './types.js';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: TradingEngineConfig = {
  maxLatencyMs: 10,
  enableCaching: true,
  maxCacheSize: 1000,
  dataRetentionMs: 1000 * 60 * 60, // 1 hour
  defaultRiskParams: {
    maxPositionSize: 0.1,
    stopLoss: 0.02,
    takeProfit: 0.04,
    maxDailyLoss: 0.05,
    maxDrawdown: 0.1,
    useDynamicSizing: false,
    riskPerTrade: 0.01,
  },
  enableMetrics: true,
  logTrades: true,
};

// ============================================================================
// Performance Metrics
// ============================================================================

export interface PerformanceMetrics {
  totalDecisions: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  cacheHitRate: number;
  decisionsPerSecond: number;
  lastReset: Date;
}

// ============================================================================
// Fast Trading Engine
// ============================================================================

/**
 * High-performance trading engine that executes strategies in real-time
 */
export class FastTradingEngine {
  private strategies: Map<string, CompiledStrategy> = new Map();
  private dataCache: Map<string, MarketData[]> = new Map();
  private indicators: IndicatorCalculator;
  private config: TradingEngineConfig;
  private metrics: PerformanceMetrics;
  private positions: Map<string, number> = new Map();
  private dailyPnL: number = 0;
  private dailyTrades: number = 0;
  private compiledSignalConditions: Map<string, (data: EnrichedMarketData) => boolean> = new Map();

  constructor(config: Partial<TradingEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.indicators = new IndicatorCalculator();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Load a compiled strategy into the engine
   */
  loadStrategy(strategy: CompiledStrategy): void {
    console.log(`[FastEngine] Loading strategy: ${strategy.id} for ${strategy.ticker}`);
    
    // Validate strategy
    if (!strategy.id || !strategy.ticker || !strategy.signals || strategy.signals.length === 0) {
      throw new Error('Invalid strategy: missing required fields');
    }

    // Check if strategy is expired
    if (strategy.expiresAt < new Date()) {
      console.warn(`[FastEngine] Strategy ${strategy.id} is expired`);
    }

    this.strategies.set(strategy.ticker, strategy);
    // Clear any cached compiled conditions for this strategy's signals (in case strategy updates)
    for (const s of strategy.signals) {
      this.compiledSignalConditions.delete(s.id);
    }
    
    console.log(
      `[FastEngine] Loaded ${strategy.signals.length} signals for ${strategy.ticker}, ` +
      `expires at ${strategy.expiresAt.toISOString()}`
    );
  }

  /**
   * Unload a strategy
   */
  unloadStrategy(ticker: string): boolean {
    return this.strategies.delete(ticker);
  }

  /**
   * Get all loaded strategies
   */
  getLoadedStrategies(): CompiledStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Make a trading decision based on current market data
   * Target latency: < 1ms
   */
  async makeDecision(ticker: string, marketData: MarketData): Promise<TradeDecision | null> {
    const startTime = performance.now();

    try {
      // 1. Find strategy for ticker
      const strategy = this.strategies.get(ticker);
      if (!strategy) {
        return null;
      }

      // Check if strategy is expired
      if (strategy.expiresAt < new Date()) {
        console.warn(`[FastEngine] Strategy for ${ticker} is expired, skipping`);
        return null;
      }

      // 2. Update data cache
      this.updateCache(ticker, marketData);

      // 3. Get historical data
      const historicalData = this.dataCache.get(ticker) || [];
      
      // Check if we have enough data
      if (historicalData.length < strategy.dataRequirements.minDataPoints) {
        if (this.config.logTrades) {
          console.log(
            `[FastEngine] Not enough data for ${ticker}: ` +
            `${historicalData.length}/${strategy.dataRequirements.minDataPoints}`
          );
        }
        return null;
      }

      // 4. Enrich data with indicators
      const enrichedData = this.indicators.enrichData(
        ticker,
        marketData,
        historicalData,
        strategy.dataRequirements.indicators
      );

      // 5. Evaluate signals (in priority order)
      for (const signal of strategy.signals) {
        try {
          let conditionMet = false;
          if (typeof signal.condition === 'function') {
            conditionMet = signal.condition(enrichedData);
          } else if (typeof signal.condition === 'string') {
            let compiled = this.compiledSignalConditions.get(signal.id);
            if (!compiled) {
              compiled = compileCondition(signal.condition);
              this.compiledSignalConditions.set(signal.id, compiled);
            }
            conditionMet = compiled(enrichedData);
          }

          if (conditionMet) {
            const latency = performance.now() - startTime;
            
            // Update metrics
            this.updateMetrics(latency);

            // Check risk limits
            if (!this.checkRiskLimits(strategy, signal.action, signal.positionSize)) {
              console.log(`[FastEngine] Risk limits exceeded for ${ticker}, skipping signal`);
              continue;
            }

            // Create decision
            const decision: TradeDecision = {
              action: signal.action,
              ticker,
              positionSize: signal.positionSize,
              entryPrice: marketData.close,
              stopLoss: marketData.close * (1 - strategy.riskParams.stopLoss),
              takeProfit: marketData.close * (1 + strategy.riskParams.takeProfit),
              confidence: signal.confidence,
              reasoning: signal.reasoning,
              signalId: signal.id,
              latency,
              timestamp: Date.now(),
            };

            if (this.config.logTrades) {
              console.log(
                `[FastEngine] Decision: ${decision.action} ${decision.ticker} ` +
                `@ $${decision.entryPrice?.toFixed(2)} (confidence: ${decision.confidence}, latency: ${latency.toFixed(2)}ms)`
              );
            }

            return decision;
          }
        } catch (error) {
          console.error(`[FastEngine] Error evaluating signal ${signal.id}:`, error);
          continue;
        }
      }

      // No signals triggered
      return null;
    } catch (error) {
      console.error(`[FastEngine] Error making decision for ${ticker}:`, error);
      return null;
    } finally {
      const totalLatency = performance.now() - startTime;
      if (totalLatency > this.config.maxLatencyMs) {
        if (this.config.logTrades) {
          console.warn(
            `[FastEngine] High latency detected: ${totalLatency.toFixed(2)}ms ` +
            `(limit: ${this.config.maxLatencyMs}ms)`
          );
        }
      }
    }
  }

  /**
   * Update data cache with new market data
   */
  private updateCache(ticker: string, data: MarketData): void {
    if (!this.dataCache.has(ticker)) {
      this.dataCache.set(ticker, []);
    }

    const cache = this.dataCache.get(ticker)!;
    cache.push(data);

    // Limit cache size
    const strategy = this.strategies.get(ticker);
    const maxSize = strategy
      ? strategy.dataRequirements.lookback * 2
      : this.config.maxCacheSize;

    if (cache.length > maxSize) {
      cache.shift();
    }
  }

  /**
   * Check if risk limits allow this trade
   */
  private checkRiskLimits(
    strategy: CompiledStrategy,
    action: 'BUY' | 'SELL' | 'HOLD',
    positionSize: number
  ): boolean {
    if (action === 'HOLD') return true;

    // Check position size
    if (positionSize > strategy.riskParams.maxPositionSize) {
      return false;
    }

    // Check daily loss limit
    if (this.dailyPnL < -strategy.riskParams.maxDailyLoss) {
      console.warn('[FastEngine] Daily loss limit reached');
      return false;
    }

    // Check if we already have a position
    const currentPosition = this.positions.get(strategy.ticker) || 0;
    if (Math.abs(currentPosition) > 0) {
      // Already have a position, don't open another
      return false;
    }

    return true;
  }

  /**
   * Execute a trade decision (placeholder for actual execution)
   */
  async executeTrade(decision: TradeDecision): Promise<ExecutionResult> {
    const startTime = performance.now();

    try {
      // In a real system, this would:
      // 1. Send order to broker API
      // 2. Wait for fill confirmation
      // 3. Update positions and P&L

      // Simulated execution
      const executionTime = performance.now() - startTime;
      
      // Update position tracking
      if (decision.action === 'BUY') {
        this.positions.set(decision.ticker, decision.positionSize);
      } else if (decision.action === 'SELL') {
        this.positions.set(decision.ticker, -decision.positionSize);
      }

      this.dailyTrades++;

      const result: ExecutionResult = {
        decision,
        executed: true,
        executionPrice: decision.entryPrice,
        executionTime,
      };

      if (this.config.logTrades) {
        console.log(
          `[FastEngine] Executed: ${decision.action} ${decision.ticker} ` +
          `@ $${result.executionPrice?.toFixed(2)} (${executionTime.toFixed(2)}ms)`
        );
      }

      return result;
    } catch (error) {
      console.error(`[FastEngine] Execution error for ${decision.ticker}:`, error);
      
      return {
        decision,
        executed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(latency: number): void {
    this.metrics.totalDecisions++;
    
    // Update latency stats
    this.metrics.avgLatencyMs =
      (this.metrics.avgLatencyMs * (this.metrics.totalDecisions - 1) + latency) /
      this.metrics.totalDecisions;
    
    this.metrics.maxLatencyMs = Math.max(this.metrics.maxLatencyMs, latency);
    this.metrics.minLatencyMs = Math.min(this.metrics.minLatencyMs, latency);

    // Calculate decisions per second
    const elapsed = (Date.now() - this.metrics.lastReset.getTime()) / 1000;
    if (elapsed > 0) {
      this.metrics.decisionsPerSecond = this.metrics.totalDecisions / elapsed;
    }
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      totalDecisions: 0,
      avgLatencyMs: 0,
      maxLatencyMs: 0,
      minLatencyMs: Infinity,
      cacheHitRate: 0,
      decisionsPerSecond: 0,
      lastReset: new Date(),
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Get current positions
   */
  getPositions(): Map<string, number> {
    return new Map(this.positions);
  }

  /**
   * Get daily statistics
   */
  getDailyStats(): {
    trades: number;
    pnl: number;
    positions: number;
  } {
    return {
      trades: this.dailyTrades,
      pnl: this.dailyPnL,
      positions: this.positions.size,
    };
  }

  /**
   * Clear all data and reset engine
   */
  reset(): void {
    this.strategies.clear();
    this.dataCache.clear();
    this.positions.clear();
    this.indicators.clearCache();
    this.dailyPnL = 0;
    this.dailyTrades = 0;
    this.resetMetrics();
    
    console.log('[FastEngine] Engine reset complete');
  }
}




