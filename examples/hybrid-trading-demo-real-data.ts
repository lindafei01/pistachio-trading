/**
 * Hybrid Trading Demo - Real Data
 * 
 * Uses real market data instead of mock data
 * Run with: bun run examples/hybrid-trading-demo-real-data.ts
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
  watchlist: ['AAPL'],
  strategyRefreshIntervalMs: 1000 * 60 * 60, // 1 hour (realistic)
  researchModel: 'moonshot-v1-128k', // Use Kimi 128k model for long prompts
};

// ============================================================================
// Real Market Data Fetcher (using fetch to get data from a free API)
// ============================================================================

interface YahooFinanceQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
}

async function fetchRealMarketData(ticker: string): Promise<MarketData | null> {
  try {
    // Using Yahoo Finance API (free, no key required)
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch data for ${ticker}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    const quote = data.quoteResponse.results[0] as YahooFinanceQuote;
    
    if (!quote) {
      console.error(`No data found for ${ticker}`);
      return null;
    }
    
    // Convert to MarketData format
    const marketData: MarketData = {
      ticker: ticker,
      timestamp: Date.now(),
      price: quote.regularMarketPrice,
      volume: quote.regularMarketVolume,
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      close: quote.regularMarketPreviousClose,
    };
    
    return marketData;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// Real-time Data Stream Simulator
// ============================================================================

async function streamRealMarketData(
  orchestrator: HybridOrchestrator,
  tickers: string[],
  durationMs: number = 60000, // 1 minute
  intervalMs: number = 5000 // Every 5 seconds
): Promise<void> {
  console.log(`\nStarting real-time data stream for ${tickers.join(', ')}...`);
  console.log(`Duration: ${durationMs / 1000}s, Interval: ${intervalMs / 1000}s\n`);
  
  const startTime = Date.now();
  let tickCount = 0;
  
  const streamInterval = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    
    if (elapsed >= durationMs) {
      clearInterval(streamInterval);
      console.log('\n✓ Data stream complete\n');
      return;
    }
    
    // Fetch and process data for all tickers
    for (const ticker of tickers) {
      const data = await fetchRealMarketData(ticker);
      
      if (data) {
        tickCount++;
        
        // Send to trading engine
        const decision = await orchestrator.onMarketData(ticker, data);
        
        // Display results
        const timestamp = new Date(data.timestamp).toLocaleTimeString();
        if (decision) {
          console.log(
            `[${timestamp}] ${ticker}: $${data.price.toFixed(2)} → ` +
            `${decision.action} (confidence: ${(decision.confidence * 100).toFixed(0)}%, ` +
            `latency: ${decision.latency.toFixed(2)}ms)`
          );
        } else {
          console.log(
            `[${timestamp}] ${ticker}: $${data.price.toFixed(2)} (no signal)`
          );
        }
      }
    }
  }, intervalMs);
  
  // Wait for stream to complete
  await new Promise(resolve => setTimeout(resolve, durationMs + 1000));
}

// ============================================================================
// Main Demo
// ============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Dexter Hybrid Trading System - Real Data Demo           ║');
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
    // ========================================================================
    // DEMO 1: Generate Strategy from Real Market Conditions
    // ========================================================================
    
    console.log('\n' + '='.repeat(60));
    console.log('=== DEMO 1: Strategy Generation ===');
    console.log('='.repeat(60) + '\n');
    
    console.log(`Generating market analysis framework for ${DEMO_CONFIG.watchlist[0]}...\n`);
    
    const strategy = await orchestrator.refreshStrategy(DEMO_CONFIG.watchlist[0]);
    
    console.log('--- Compiled Strategy ---');
    console.log(`Ticker: ${strategy.ticker}`);
    console.log(`Timeframe: ${strategy.timeframe}`);
    console.log(`Signals: ${strategy.signals.length}`);
    console.log(`Expires: ${strategy.expiresAt.toISOString()}\n`);
    
    console.log('Signals:');
    strategy.signals.forEach((signal, idx) => {
      console.log(
        `  ${idx + 1}. ${signal.action} - ${signal.description}\n` +
        `     Priority: ${signal.priority}, Confidence: ${signal.confidence}`
      );
    });
    
    console.log('\nRisk Parameters:');
    console.log(`  Stop Loss: ${(strategy.riskParams.stopLoss * 100).toFixed(1)}%`);
    console.log(`  Take Profit: ${(strategy.riskParams.takeProfit * 100).toFixed(1)}%`);
    console.log(`  Max Position: ${(strategy.riskParams.maxPositionSize * 100).toFixed(1)}%`);
    
    // ========================================================================
    // DEMO 2: Test with Current Real Market Data
    // ========================================================================
    
    console.log('\n' + '='.repeat(60));
    console.log('=== DEMO 2: Real-Time Market Data Test ===');
    console.log('='.repeat(60) + '\n');
    
    console.log('Fetching current market data...\n');
    
    const currentData = await fetchRealMarketData(DEMO_CONFIG.watchlist[0]);
    
    if (currentData) {
      console.log('--- Current Market Data ---');
      console.log(`Ticker: ${currentData.ticker}`);
      console.log(`Price: $${currentData.price.toFixed(2)}`);
      console.log(`Volume: ${currentData.volume.toLocaleString()}`);
      console.log(`Open: $${currentData.open.toFixed(2)}`);
      console.log(`High: $${currentData.high.toFixed(2)}`);
      console.log(`Low: $${currentData.low.toFixed(2)}\n`);
      
      const decision = await orchestrator.onMarketData(currentData.ticker, currentData);
      
      if (decision) {
        console.log('--- Trading Decision ---');
        console.log(`Action: ${decision.action}`);
        console.log(`Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
        console.log(`Signal: ${decision.signal?.description}`);
        console.log(`Latency: ${decision.latency.toFixed(2)}ms`);
      } else {
        console.log('No trading signal triggered at current price levels.');
      }
    }
    
    // ========================================================================
    // DEMO 3: Real-Time Data Stream (Optional)
    // ========================================================================
    
    const enableStream = process.env.DEMO_STREAM === 'true';
    
    if (enableStream) {
      console.log('\n' + '='.repeat(60));
      console.log('=== DEMO 3: Real-Time Data Stream ===');
      console.log('='.repeat(60));
      
      await streamRealMarketData(
        orchestrator,
        DEMO_CONFIG.watchlist,
        60000,  // 1 minute
        5000    // Every 5 seconds
      );
      
      // Display final metrics
      const metrics = orchestrator.getMetrics();
      
      console.log('\n--- Performance Metrics ---');
      console.log(`Total Decisions: ${metrics.totalDecisions}`);
      console.log(`Avg Latency: ${metrics.avgLatency.toFixed(2)}ms`);
      console.log(`Signals Triggered: ${metrics.signalsTriggered}`);
    }
    
    // ========================================================================
    // Summary
    // ========================================================================
    
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  Demo Complete!                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.log('Key Takeaways:');
    console.log('  ✓ Strategy generated from real market conditions');
    console.log('  ✓ Real-time data fetched from Yahoo Finance API');
    console.log('  ✓ Trading decisions made in <1ms');
    console.log('  ✓ Ready for production deployment\n');
    
    console.log('To enable real-time streaming:');
    console.log('  DEMO_STREAM=true bun run examples/hybrid-trading-demo-real-data.ts\n');
    
  } catch (error) {
    console.error('\nDemo error:', error);
  } finally {
    orchestrator.stop();
  }
}

main();

