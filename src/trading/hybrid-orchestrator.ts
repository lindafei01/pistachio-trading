/**
 * Hybrid Orchestrator
 * 
 * Coordinates between Research Mode (deep analysis) and Trading Mode (fast execution).
 * - Research Mode runs periodically in background to generate/update strategies
 * - Trading Mode executes strategies in real-time with minimal latency
 */

import { Agent } from '../agent/orchestrator.js';
import { FastTradingEngine } from './fast-engine.js';
import type {
  HybridOrchestratorConfig,
  MarketData,
  TradeDecision,
  CompiledStrategy,
  ExecutionResult,
} from './types.js';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: HybridOrchestratorConfig = {
  strategyRefreshIntervalMs: 1000 * 60 * 60, // 1 hour
  researchModel: 'moonshot-v1-128k', // Use Kimi 128k model for long prompts
  watchlist: [],
  engineConfig: {
    maxLatencyMs: 10,
    enableCaching: true,
    maxCacheSize: 1000,
    dataRetentionMs: 1000 * 60 * 60,
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
  },
};

// ============================================================================
// Hybrid Orchestrator
// ============================================================================

/**
 * Orchestrates both research and trading modes
 */
export class HybridOrchestrator {
  private researchAgent: Agent;
  private tradingEngine: FastTradingEngine;
  private config: HybridOrchestratorConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  private watchlist: Set<string>;
  private strategyCache: Map<string, CompiledStrategy> = new Map();

  constructor(config: Partial<HybridOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.watchlist = new Set(this.config.watchlist);

    // Initialize research agent (for slow, deep analysis)
    this.researchAgent = new Agent({
      model: this.config.researchModel,
    });

    // Initialize trading engine (for fast execution)
    this.tradingEngine = new FastTradingEngine(this.config.engineConfig);

    console.log('[HybridOrchestrator] Initialized');
    console.log(`  Research Model: ${this.config.researchModel}`);
    console.log(`  Watchlist: ${Array.from(this.watchlist).join(', ') || 'empty'}`);
    console.log(`  Refresh Interval: ${this.config.strategyRefreshIntervalMs / 1000 / 60} minutes`);
  }

  /**
   * Start the orchestrator (begins background strategy refresh loop)
   */
  async start(): Promise<void> {
    console.log('[HybridOrchestrator] Starting...');

    // Load initial strategies
    await this.refreshAllStrategies();

    // Start background refresh loop
    this.startStrategyRefreshLoop();

    console.log('[HybridOrchestrator] Started successfully');
  }

  /**
   * Stop the orchestrator
   */
  stop(): void {
    console.log('[HybridOrchestrator] Stopping...');

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    console.log('[HybridOrchestrator] Stopped');
  }

  /**
   * Add a ticker to the watchlist
   */
  addToWatchlist(ticker: string): void {
    this.watchlist.add(ticker.toUpperCase());
    console.log(`[HybridOrchestrator] Added ${ticker} to watchlist`);
  }

  /**
   * Remove a ticker from the watchlist
   */
  removeFromWatchlist(ticker: string): void {
    this.watchlist.delete(ticker.toUpperCase());
    this.tradingEngine.unloadStrategy(ticker);
    this.strategyCache.delete(ticker);
    console.log(`[HybridOrchestrator] Removed ${ticker} from watchlist`);
  }

  /**
   * Get current watchlist
   */
  getWatchlist(): string[] {
    return Array.from(this.watchlist);
  }

  /**
   * Background loop: periodically refresh strategies using Research Mode
   */
  private startStrategyRefreshLoop(): void {
    this.refreshTimer = setInterval(async () => {
      if (!this.isRefreshing) {
        await this.refreshAllStrategies();
      }
    }, this.config.strategyRefreshIntervalMs);
  }

  /**
   * Refresh strategies for all tickers in watchlist
   */
  private async refreshAllStrategies(): Promise<void> {
    if (this.watchlist.size === 0) {
      console.log('[HybridOrchestrator] No tickers in watchlist, skipping refresh');
      return;
    }

    this.isRefreshing = true;
    console.log(`[HybridOrchestrator] Refreshing strategies for ${this.watchlist.size} tickers...`);

    const startTime = Date.now();

    for (const ticker of this.watchlist) {
      try {
        await this.refreshStrategyForTicker(ticker);
      } catch (error) {
        console.error(`[HybridOrchestrator] Failed to refresh strategy for ${ticker}:`, error);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[HybridOrchestrator] Strategy refresh complete (${elapsed}ms)`);

    this.isRefreshing = false;
  }

  /**
   * Refresh strategy for a specific ticker using Research Mode
   */
  private async refreshStrategyForTicker(ticker: string): Promise<void> {
    console.log(`[HybridOrchestrator] Refreshing strategy for ${ticker}...`);

    try {
      // Use Research Mode to generate strategy
      const query = `Create a market analysis framework for ${ticker} based on current market conditions. 
Focus on generating actionable signals with specific conditions using technical indicators.
The framework should be suitable for intraday or swing analysis.`;

      // 🔍 DEBUG: 打印query
      if (process.env.DEBUG_PROMPTS === 'true') {
        console.log('\n🔍 [HybridOrchestrator] Sending query to Research Agent:');
        console.log('─'.repeat(80));
        console.log(query);
        console.log('─'.repeat(80));
      }

      const strategy = await this.researchAgent.compileStrategy(query);

      // Cache and load into trading engine
      this.strategyCache.set(ticker, strategy);
      this.tradingEngine.loadStrategy(strategy);

      console.log(
        `[HybridOrchestrator] Strategy for ${ticker} updated: ` +
        `${strategy.signals.length} signals, expires ${strategy.expiresAt.toISOString()}`
      );
    } catch (error) {
      console.error(`[HybridOrchestrator] Failed to compile strategy for ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Manually trigger strategy refresh for a ticker
   */
  async refreshStrategy(ticker: string): Promise<CompiledStrategy> {
    ticker = ticker.toUpperCase();
    
    if (!this.watchlist.has(ticker)) {
      this.addToWatchlist(ticker);
    }

    await this.refreshStrategyForTicker(ticker);
    
    const strategy = this.strategyCache.get(ticker);
    if (!strategy) {
      throw new Error(`Failed to refresh strategy for ${ticker}`);
    }

    return strategy;
  }

  /**
   * TRADING MODE: Handle real-time market data and make trading decisions
   * This is the hot path - must be extremely fast (< 1ms target)
   */
  async onMarketData(ticker: string, data: MarketData): Promise<TradeDecision | null> {
    // Fast path: pure strategy evaluation, no LLM calls
    const decision = await this.tradingEngine.makeDecision(ticker, data);

    if (decision && this.config.engineConfig.logTrades) {
      console.log(
        `[HybridOrchestrator] Trade signal: ${decision.action} ${decision.ticker} ` +
        `(latency: ${decision.latency.toFixed(2)}ms)`
      );
    }

    return decision;
  }

  /**
   * Execute a trade decision
   */
  async executeTrade(decision: TradeDecision): Promise<ExecutionResult> {
    console.log(
      `[HybridOrchestrator] Executing trade: ${decision.action} ${decision.ticker} ` +
      `@ $${decision.entryPrice?.toFixed(2)}`
    );

    const result = await this.tradingEngine.executeTrade(decision);

    if (result.executed) {
      console.log(
        `[HybridOrchestrator] Trade executed successfully: ${decision.ticker} ` +
        `(${result.executionTime?.toFixed(2)}ms)`
      );
    } else {
      console.error(
        `[HybridOrchestrator] Trade execution failed: ${decision.ticker} ` +
        `- ${result.error}`
      );
    }

    return result;
  }

  /**
   * RESEARCH MODE: Perform deep analysis (returns text answer, not strategy)
   */
  async deepResearch(query: string): Promise<string> {
    console.log(`[HybridOrchestrator] Starting deep research: "${query}"`);
    
    const startTime = Date.now();
    const answer = await this.researchAgent.run(query);
    const elapsed = Date.now() - startTime;

    console.log(`[HybridOrchestrator] Deep research complete (${elapsed}ms)`);

    return answer;
  }

  /**
   * Get loaded strategies
   */
  getLoadedStrategies(): CompiledStrategy[] {
    return this.tradingEngine.getLoadedStrategies();
  }

  /**
   * Get strategy for a ticker
   */
  getStrategy(ticker: string): CompiledStrategy | undefined {
    return this.strategyCache.get(ticker.toUpperCase());
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      engine: this.tradingEngine.getMetrics(),
      daily: this.tradingEngine.getDailyStats(),
      positions: this.tradingEngine.getPositions(),
    };
  }

  /**
   * Reset all state
   */
  reset(): void {
    console.log('[HybridOrchestrator] Resetting...');
    
    this.stop();
    this.tradingEngine.reset();
    this.strategyCache.clear();
    
    console.log('[HybridOrchestrator] Reset complete');
  }
}

