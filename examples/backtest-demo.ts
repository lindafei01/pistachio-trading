/**
 * Backtest Demo - High-Frequency Trading Strategy Validation
 * 
 * Tests trading strategies against historical data
 * Run with: bun run examples/backtest-demo.ts
 */

import { HybridOrchestrator } from '../src/trading/index.js';
import { BacktestEngine } from '../src/trading/backtesting.js';
import type { MarketData } from '../src/trading/index.js';
import { config } from 'dotenv';

// Load environment variables
config({ override: true });

// ============================================================================
// Historical Data Fetcher (Yahoo Finance)
// ============================================================================

interface YahooHistoricalData {
  timestamp: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

async function fetchHistoricalData(
  ticker: string,
  period: string = '1mo', // 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
  interval: string = '1h' // 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
): Promise<MarketData[]> {
  try {
    console.log(`\n📊 Fetching ${period} of ${interval} data for ${ticker}...`);
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?` +
      `period1=0&period2=9999999999&interval=${interval}&range=${period}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result) {
      throw new Error('No data returned from Yahoo Finance');
    }
    
    const timestamps = result.timestamp as number[];
    const quotes = result.indicators.quote[0];
    
    // Convert to MarketData format
    const marketData: MarketData[] = timestamps.map((ts, i) => ({
      ticker,
      timestamp: ts * 1000, // Convert to milliseconds
      price: quotes.close[i],
      volume: quotes.volume[i],
      open: quotes.open[i],
      high: quotes.high[i],
      low: quotes.low[i],
      close: quotes.close[i],
    })).filter(d => 
      // Filter out invalid data points
      d.price != null && 
      d.volume != null && 
      !isNaN(d.price) && 
      !isNaN(d.volume)
    );
    
    console.log(`✓ Fetched ${marketData.length} data points`);
    console.log(`  Date Range: ${new Date(marketData[0].timestamp).toLocaleDateString()} to ${new Date(marketData[marketData.length - 1].timestamp).toLocaleDateString()}`);
    
    return marketData;
  } catch (error) {
    console.error(`Error fetching historical data for ${ticker}:`, error);
    throw error;
  }
}

// ============================================================================
// Results Display
// ============================================================================

function displayBacktestResults(result: any): void {
  const { config, metrics, trades, finalCapital } = result;
  
  console.log('\n' + '═'.repeat(70));
  console.log('BACKTEST RESULTS');
  console.log('═'.repeat(70));
  
  // Configuration
  console.log('\n📋 Configuration:');
  console.log(`  Initial Capital: $${config.initialCapital.toLocaleString()}`);
  console.log(`  Commission: ${(config.commission * 100).toFixed(2)}%`);
  console.log(`  Slippage: ${(config.slippage * 100).toFixed(2)}%`);
  console.log(`  Leverage: ${config.leverage}x`);
  
  // Performance Metrics
  console.log('\n📈 Performance Metrics:');
  console.log(`  Final Capital: $${finalCapital.toLocaleString()}`);
  console.log(`  Total Return: ${metrics.totalReturn.toFixed(2)}%`);
  console.log(`  Total P&L: $${metrics.totalPnL.toLocaleString()}`);
  console.log(`  Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
  console.log(`  Max Drawdown: ${metrics.maxDrawdown.toFixed(2)}%`);
  
  // Trading Statistics
  console.log('\n📊 Trading Statistics:');
  console.log(`  Total Trades: ${metrics.totalTrades}`);
  console.log(`  Winning Trades: ${metrics.winningTrades} (${metrics.winRate.toFixed(1)}%)`);
  console.log(`  Losing Trades: ${metrics.losingTrades}`);
  console.log(`  Avg Win: $${metrics.avgWin.toFixed(2)}`);
  console.log(`  Avg Loss: $${metrics.avgLoss.toFixed(2)}`);
  console.log(`  Profit Factor: ${metrics.profitFactor.toFixed(2)}`);
  console.log(`  Avg Holding Time: ${(metrics.avgHoldingTime / 1000 / 60).toFixed(1)} minutes`);
  console.log(`  Total Commissions: $${metrics.totalCommissions.toFixed(2)}`);
  
  // Recent Trades
  if (trades.length > 0) {
    console.log('\n💼 Recent Trades (last 10):');
    const recentTrades = trades.slice(-10);
    recentTrades.forEach((trade: any, i: number) => {
      const date = new Date(trade.timestamp).toLocaleString();
      const pnl = trade.pnl != null ? ` | P&L: $${trade.pnl.toFixed(2)}` : '';
      console.log(
        `  ${i + 1}. [${date}] ${trade.action} ${trade.quantity} @ $${trade.price.toFixed(2)}${pnl}`
      );
    });
  }
  
  // Performance Summary
  console.log('\n' + '═'.repeat(70));
  
  if (metrics.totalReturn > 0) {
    console.log('✅ PROFITABLE STRATEGY');
  } else {
    console.log('❌ UNPROFITABLE STRATEGY');
  }
  
  console.log('═'.repeat(70) + '\n');
}

// ============================================================================
// Main Demo
// ============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  High-Frequency Trading Strategy Backtest                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  try {
    // Configuration
    const TICKER = 'AAPL';
    const PERIOD = '1mo'; // 1 month of data
    const INTERVAL = '1h'; // Hourly data for HFT simulation
    
    // ========================================================================
    // Step 1: Generate Trading Strategy
    // ========================================================================
    
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 1: Generate Trading Strategy');
    console.log('─'.repeat(70));
    
    console.log(`\nGenerating AI-powered strategy for ${TICKER}...`);
    
    const orchestrator = new HybridOrchestrator({
      watchlist: [TICKER],
      researchModel: 'moonshot-v1-128k',
    });
    
    const strategy = await orchestrator.refreshStrategy(TICKER);
    
    console.log('\n✓ Strategy Generated:');
    console.log(`  Signals: ${strategy.signals.length}`);
    console.log(`  Timeframe: ${strategy.timeframe}`);
    console.log(`  Expires: ${strategy.expiresAt.toLocaleDateString()}`);
    
    strategy.signals.forEach((signal, i) => {
      console.log(`\n  Signal ${i + 1}: ${signal.action}`);
      console.log(`    ${signal.description}`);
      console.log(`    Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
    });
    
    // ========================================================================
    // Step 2: Fetch Historical Data
    // ========================================================================
    
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 2: Fetch Historical Data');
    console.log('─'.repeat(70));
    
    const historicalData = await fetchHistoricalData(TICKER, PERIOD, INTERVAL);
    
    // ========================================================================
    // Step 3: Run Backtest
    // ========================================================================
    
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 3: Run Backtest');
    console.log('─'.repeat(70));
    
    const backtester = new BacktestEngine({
      initialCapital: 100000,
      commission: 0.001, // 0.1% commission
      slippage: 0.0005,  // 0.05% slippage
      leverage: 1,       // No leverage for safety
    });
    
    backtester.loadStrategy(strategy);
    
    const result = await backtester.runBacktest(historicalData);
    
    // ========================================================================
    // Step 4: Display Results
    // ========================================================================
    
    displayBacktestResults(result);
    
    // ========================================================================
    // Step 5: Recommendations
    // ========================================================================
    
    console.log('💡 Recommendations:\n');
    
    if (result.metrics.sharpeRatio < 1) {
      console.log('  ⚠️  Low Sharpe Ratio - Consider:');
      console.log('     • Adjusting signal confidence thresholds');
      console.log('     • Adding more technical indicators');
      console.log('     • Tightening stop loss parameters\n');
    }
    
    if (result.metrics.maxDrawdown > 20) {
      console.log('  ⚠️  High Drawdown - Consider:');
      console.log('     • Implementing better risk management');
      console.log('     • Reducing position sizes');
      console.log('     • Using trailing stops\n');
    }
    
    if (result.metrics.winRate < 50) {
      console.log('  ⚠️  Low Win Rate - Consider:');
      console.log('     • Refining entry conditions');
      console.log('     • Improving signal filtering');
      console.log('     • Testing on different timeframes\n');
    }
    
    if (result.metrics.totalReturn > 5 && result.metrics.sharpeRatio > 1) {
      console.log('  ✅ Strategy shows promise!');
      console.log('     • Consider forward testing');
      console.log('     • Test on multiple tickers');
      console.log('     • Optimize parameters\n');
    }
    
    orchestrator.stop();
    
  } catch (error) {
    console.error('\n❌ Backtest error:', error);
    process.exit(1);
  }
}

main();


