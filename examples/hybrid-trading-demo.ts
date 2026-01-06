/**
 * Hybrid Trading Demo
 * 
 * Demonstrates how to use the Hybrid Orchestrator to combine:
 * - Deep Research Mode (AI-powered analysis)
 * - Fast Trading Mode (real-time execution)
 * 
 * Run with: bun run examples/hybrid-trading-demo.ts
 */

import { HybridOrchestrator } from '../src/trading/index.js';
import type { MarketData } from '../src/trading/index.js';
import { config } from 'dotenv';

// Load environment variables (override system env vars)
config({ override: true });

// ============================================================================
// Demo Configuration
// ============================================================================

const DEMO_CONFIG = {
  watchlist: ['AAPL', 'MSFT', 'GOOGL'],
  strategyRefreshIntervalMs: 1000 * 60 * 5, // 5 minutes (for demo)
  researchModel: 'moonshot-v1-128k', // Use Kimi 128k model for long prompts
};

// ============================================================================
// Mock Market Data Generator (for demo)
// ============================================================================

class MockMarketDataGenerator {
  private basePrice: Map<string, number> = new Map();
  private dataCounter: Map<string, number> = new Map();

  constructor(tickers: string[]) {
    // Initialize base prices
    tickers.forEach(ticker => {
      this.basePrice.set(ticker, this.getRandomPrice(ticker));
      this.dataCounter.set(ticker, 0);
    });
  }

  /**
   * Generate mock market data
   */
  generate(ticker: string): MarketData {
    const base = this.basePrice.get(ticker) || 100;
    const count = (this.dataCounter.get(ticker) || 0) + 1;
    this.dataCounter.set(ticker, count);

    // Simulate price movement
    const change = (Math.random() - 0.5) * 2; // -1 to +1
    const newPrice = base + change;
    this.basePrice.set(ticker, newPrice);

    const high = newPrice * (1 + Math.random() * 0.005);
    const low = newPrice * (1 - Math.random() * 0.005);
    const volume = Math.floor(1000000 + Math.random() * 500000);

    return {
      ticker,
      timestamp: Date.now(),
      price: newPrice,
      open: base,
      high,
      low,
      close: newPrice,
      volume,
    };
  }

  /**
   * Get random base price for ticker
   */
  private getRandomPrice(ticker: string): number {
    const prices: Record<string, number> = {
      'AAPL': 180,
      'MSFT': 380,
      'GOOGL': 140,
      'TSLA': 250,
      'NVDA': 500,
    };
    return prices[ticker] || 100;
  }
}

// ============================================================================
// Demo Functions
// ============================================================================

async function demoResearchMode(orchestrator: HybridOrchestrator) {
  console.log('\n=== DEMO 1: Research Mode ===\n');
  console.log('Asking a complex financial question...\n');

  const query = "What are the key financial metrics I should look at when evaluating Apple's stock?";
  
  const answer = await orchestrator.deepResearch(query);
  
  console.log('\n--- Research Answer ---');
  console.log(answer);
  console.log('\n');
}

async function demoStrategyCompilation(orchestrator: HybridOrchestrator) {
  console.log('\n=== DEMO 2: Strategy Compilation ===\n');
  console.log('Generating market analysis framework for AAPL...\n');

  const strategy = await orchestrator.refreshStrategy('AAPL');
  
  console.log('\n--- Compiled Strategy ---');
  console.log(`Ticker: ${strategy.ticker}`);
  console.log(`Timeframe: ${strategy.timeframe}`);
  console.log(`Signals: ${strategy.signals.length}`);
  console.log(`Expires: ${strategy.expiresAt.toISOString()}`);
  console.log('\nSignals:');
  strategy.signals.forEach((signal, index) => {
    console.log(`  ${index + 1}. ${signal.action} - ${signal.reasoning}`);
    console.log(`     Priority: ${signal.priority}, Confidence: ${signal.confidence}`);
  });
  console.log('\nRisk Parameters:');
  console.log(`  Stop Loss: ${(strategy.riskParams.stopLoss * 100).toFixed(1)}%`);
  console.log(`  Take Profit: ${(strategy.riskParams.takeProfit * 100).toFixed(1)}%`);
  console.log(`  Max Position: ${(strategy.riskParams.maxPositionSize * 100).toFixed(1)}%`);
  console.log('\n');
}

async function demoFastTrading(orchestrator: HybridOrchestrator) {
  console.log('\n=== DEMO 3: Fast Trading Mode ===\n');
  console.log('Simulating real-time market data stream...\n');

  const tickers = orchestrator.getWatchlist();
  const generator = new MockMarketDataGenerator(tickers);

  console.log('Generating 20 market data points...\n');

  for (let i = 0; i < 20; i++) {
    // Pick a random ticker
    const ticker = tickers[Math.floor(Math.random() * tickers.length)];
    
    // Generate market data
    const marketData = generator.generate(ticker);
    
    // Make trading decision (fast path - no LLM)
    const decision = await orchestrator.onMarketData(ticker, marketData);
    
    if (decision) {
      console.log(
        `[${i + 1}] SIGNAL: ${decision.action} ${decision.ticker} @ $${decision.entryPrice?.toFixed(2)} ` +
        `(confidence: ${decision.confidence.toFixed(2)}, latency: ${decision.latency.toFixed(2)}ms)`
      );
      
      // Execute the trade
      const result = await orchestrator.executeTrade(decision);
      
      if (result.executed) {
        console.log(
          `    ✓ Executed @ $${result.executionPrice?.toFixed(2)} ` +
          `(${result.executionTime?.toFixed(2)}ms)`
        );
      }
    } else {
      // No signal, just log price
      process.stdout.write(
        `[${i + 1}] ${ticker}: $${marketData.price.toFixed(2)} (no signal)\r`
      );
    }

    // Small delay to simulate real-time
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n');
}

async function demoMetrics(orchestrator: HybridOrchestrator) {
  console.log('\n=== DEMO 4: Performance Metrics ===\n');

  const metrics = orchestrator.getMetrics();

  console.log('Engine Metrics:');
  console.log(`  Total Decisions: ${metrics.engine.totalDecisions}`);
  console.log(`  Avg Latency: ${metrics.engine.avgLatencyMs.toFixed(2)}ms`);
  console.log(`  Max Latency: ${metrics.engine.maxLatencyMs.toFixed(2)}ms`);
  console.log(`  Min Latency: ${metrics.engine.minLatencyMs.toFixed(2)}ms`);
  console.log(`  Decisions/sec: ${metrics.engine.decisionsPerSecond.toFixed(2)}`);

  console.log('\nDaily Stats:');
  console.log(`  Trades: ${metrics.daily.trades}`);
  console.log(`  P&L: $${metrics.daily.pnl.toFixed(2)}`);
  console.log(`  Open Positions: ${metrics.daily.positions}`);

  console.log('\nLoaded Strategies:');
  const strategies = orchestrator.getLoadedStrategies();
  strategies.forEach(strategy => {
    console.log(`  ${strategy.ticker}: ${strategy.signals.length} signals`);
  });

  console.log('\n');
}

// ============================================================================
// Main Demo
// ============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Dexter Hybrid Trading System Demo                        ║');
  console.log('║  Research Mode + Trading Mode                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Initialize orchestrator
  console.log('Initializing Hybrid Orchestrator...');
  const orchestrator = new HybridOrchestrator({
    watchlist: DEMO_CONFIG.watchlist,
    strategyRefreshIntervalMs: DEMO_CONFIG.strategyRefreshIntervalMs,
    researchModel: DEMO_CONFIG.researchModel,
  });

  console.log('✓ Orchestrator initialized\n');

  try {
    // Demo 1: Deep Research Mode (optional - can be slow)
    if (process.env.DEMO_RESEARCH === 'true') {
      await demoResearchMode(orchestrator);
    } else {
      console.log('\n=== DEMO 1: Research Mode ===');
      console.log('(Skipped - set DEMO_RESEARCH=true to enable)\n');
    }

    // Demo 2: Strategy Compilation
    await demoStrategyCompilation(orchestrator);

    // Demo 3: Fast Trading Mode
    await demoFastTrading(orchestrator);

    // Demo 4: Performance Metrics
    await demoMetrics(orchestrator);

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  Demo Complete!                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('Key Takeaways:');
    console.log('  ✓ Research Mode: AI analyzes markets deeply (slow, ~10-50s)');
    console.log('  ✓ Strategy Compilation: AI generates executable rules');
    console.log('  ✓ Trading Mode: Executes strategies in real-time (fast, <1ms)');
    console.log('  ✓ Hybrid Approach: Combines AI intelligence with HFT speed\n');

  } catch (error) {
    console.error('Demo error:', error);
  } finally {
    // Cleanup
    orchestrator.stop();
    process.exit(0);
  }
}

// Run demo
main().catch(console.error);

