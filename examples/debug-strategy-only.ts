/**
 * 只调试策略编译部分
 * 方便设置断点逐步调试
 */

import { HybridOrchestrator } from '../src/trading/index.js';
import { config } from 'dotenv';

config({ quiet: true });

async function main() {
  console.log('🔍 开始调试策略编译流程\n');
  console.log('💡 提示: 在想调试的地方设置断点，按F5启动调试\n');

  // 初始化
  const orchestrator = new HybridOrchestrator({
    watchlist: ['AAPL'],
    researchModel: 'gpt-5',
  });

  console.log('✓ Orchestrator已初始化\n');
  console.log('⏳ 开始编译策略...\n');

  try {
    // 🔴 在这里设置断点！
    const strategy = await orchestrator.refreshStrategy('AAPL');

    console.log('\n✅ 策略编译完成!\n');
    console.log('策略信息:');
    console.log('  Ticker:', strategy.ticker);
    console.log('  Timeframe:', strategy.timeframe);
    console.log('  Signals:', strategy.signals.length);
    console.log('  Expires:', strategy.expiresAt.toISOString());

    console.log('\n信号详情:');
    strategy.signals.forEach((signal, idx) => {
      console.log(`\n  信号 ${idx + 1}:`);
      console.log(`    动作: ${signal.action}`);
      console.log(`    仓位: ${(signal.positionSize * 100).toFixed(0)}%`);
      console.log(`    置信度: ${(signal.confidence * 100).toFixed(0)}%`);
      console.log(`    原因: ${signal.reasoning}`);
      
      // 🔴 在这里设置断点可以查看每个信号
      if (typeof signal.condition === 'function') {
        console.log(`    条件: [已编译为函数]`);
      }
    });

    console.log('\n风险参数:');
    console.log(`  止损: ${(strategy.riskParams.stopLoss * 100).toFixed(1)}%`);
    console.log(`  止盈: ${(strategy.riskParams.takeProfit * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('\n❌ 编译失败:', error);
    throw error;
  } finally {
    orchestrator.stop();
  }
}

main().catch(console.error);

