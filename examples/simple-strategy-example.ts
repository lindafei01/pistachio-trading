/**
 * Simple Strategy Compilation Example
 * 
 * Shows how to compile a trading strategy from research
 * 
 * Run with: bun run examples/simple-strategy-example.ts
 */

import { Agent } from '../src/agent/orchestrator.js';
import { StrategyCompiler } from '../src/trading/strategy-compiler.js';
import { config } from 'dotenv';

config({ quiet: true });

async function main() {
  console.log('\n=== Simple Strategy Compilation Example ===\n');

  // Initialize agent
  const agent = new Agent({
    model: 'gpt-5',
  });

  // Ask the agent to compile a market analysis framework
  const query = 'Create an intraday market analysis framework for TSLA that uses RSI and moving averages';

  console.log(`Query: "${query}"\n`);
  console.log('Compiling strategy...\n');

  try {
    const strategy = await agent.compileStrategy(query);

    console.log('✓ Strategy Compiled!\n');
    console.log('=== Strategy Details ===');
    console.log(`ID: ${strategy.id}`);
    console.log(`Ticker: ${strategy.ticker}`);
    console.log(`Timeframe: ${strategy.timeframe}`);
    console.log(`Compiled: ${strategy.compiledAt.toISOString()}`);
    console.log(`Expires: ${strategy.expiresAt.toISOString()}`);

    console.log('\n=== Data Requirements ===');
    console.log(`Indicators: ${strategy.dataRequirements.indicators.join(', ')}`);
    console.log(`Lookback: ${strategy.dataRequirements.lookback} periods`);
    console.log(`Min Data Points: ${strategy.dataRequirements.minDataPoints}`);

    console.log('\n=== Trading Signals ===');
    strategy.signals.forEach((signal, index) => {
      console.log(`\nSignal ${index + 1}:`);
      console.log(`  Action: ${signal.action}`);
      console.log(`  Position Size: ${(signal.positionSize * 100).toFixed(0)}%`);
      console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
      console.log(`  Priority: ${signal.priority}`);
      console.log(`  Reasoning: ${signal.reasoning}`);
      console.log(`  Condition: ${typeof signal.condition === 'function' ? '✓ Compiled' : signal.condition}`);
    });

    console.log('\n=== Risk Parameters ===');
    console.log(`Stop Loss: ${(strategy.riskParams.stopLoss * 100).toFixed(1)}%`);
    console.log(`Take Profit: ${(strategy.riskParams.takeProfit * 100).toFixed(1)}%`);
    console.log(`Max Position: ${(strategy.riskParams.maxPositionSize * 100).toFixed(0)}%`);
    console.log(`Max Daily Loss: ${(strategy.riskParams.maxDailyLoss * 100).toFixed(0)}%`);
    console.log(`Risk Per Trade: ${(strategy.riskParams.riskPerTrade * 100).toFixed(1)}%`);

    console.log('\n=== Strategy Ready for Execution ===');
    console.log('This strategy can now be loaded into FastTradingEngine');
    console.log('for real-time execution with < 1ms latency.\n');

    // Optionally serialize
    const compiler = new StrategyCompiler({ model: 'gpt-5' });
    const serialized = compiler.serializeStrategy(strategy);
    
    console.log('Strategy can be saved and loaded later:');
    console.log(`Size: ${serialized.length} bytes\n`);

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

main().catch(console.error);

