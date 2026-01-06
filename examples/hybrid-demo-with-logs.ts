/**
 * Hybrid Demo with Detailed Logging
 * 用console.log替代断点，同样有效！
 */

import { HybridOrchestrator } from '../src/trading/index.js';
import type { MarketData } from '../src/trading/index.js';
import { config } from 'dotenv';

config({ quiet: true });

const DEMO_CONFIG = {
  watchlist: ['AAPL'],
  researchModel: 'gpt-5',
};

async function main() {
  console.log('\n=== 开始Demo ===\n');

  const orchestrator = new HybridOrchestrator(DEMO_CONFIG);
  console.log('✓ Orchestrator初始化完成\n');

  try {
    // ==================== 策略编译 ====================
    console.log('📊 Step 1: 编译策略');
    console.log('  输入: ticker =', 'AAPL');
    
    const startTime = Date.now();
    const strategy = await orchestrator.refreshStrategy('AAPL');
    const elapsed = Date.now() - startTime;
    
    console.log('  耗时:', (elapsed / 1000).toFixed(2), '秒\n');
    
    // 详细输出策略信息
    console.log('📋 策略详情:');
    console.log('  ID:', strategy.id);
    console.log('  Ticker:', strategy.ticker);
    console.log('  Timeframe:', strategy.timeframe);
    console.log('  过期时间:', strategy.expiresAt.toISOString());
    console.log('  信号数量:', strategy.signals.length);
    
    console.log('\n🎯 信号列表:');
    strategy.signals.forEach((signal, idx) => {
      console.log(`\n  [${idx + 1}] ${signal.action}信号:`);
      console.log('      仓位:', (signal.positionSize * 100).toFixed(0) + '%');
      console.log('      置信度:', (signal.confidence * 100).toFixed(0) + '%');
      console.log('      优先级:', signal.priority);
      console.log('      原因:', signal.reasoning);
      console.log('      条件类型:', typeof signal.condition);
    });
    
    console.log('\n🛡️  风险参数:');
    console.log('  止损:', (strategy.riskParams.stopLoss * 100).toFixed(1) + '%');
    console.log('  止盈:', (strategy.riskParams.takeProfit * 100).toFixed(1) + '%');
    console.log('  最大仓位:', (strategy.riskParams.maxPositionSize * 100).toFixed(0) + '%');

    // ==================== 快速交易测试 ====================
    console.log('\n\n⚡ Step 2: 测试快速交易');
    console.log('  生成模拟市场数据...\n');
    
    let basePrice = 180;
    for (let i = 0; i < 10; i++) {
      basePrice += (Math.random() - 0.5) * 2;
      
      const marketData: MarketData = {
        ticker: 'AAPL',
        timestamp: Date.now(),
        price: basePrice,
        open: basePrice - 0.5,
        high: basePrice + 1,
        low: basePrice - 1,
        close: basePrice,
        volume: 1000000 + Math.random() * 500000,
      };
      
      const decisionStart = performance.now();
      const decision = await orchestrator.onMarketData('AAPL', marketData);
      const decisionTime = performance.now() - decisionStart;
      
      if (decision) {
        console.log(`\n  🔔 [${i + 1}] 信号触发!`);
        console.log('     动作:', decision.action);
        console.log('     价格: $' + decision.entryPrice?.toFixed(2));
        console.log('     决策延迟:', decisionTime.toFixed(2) + 'ms');
        console.log('     引擎延迟:', decision.latency.toFixed(2) + 'ms');
        console.log('     原因:', decision.reasoning);
      } else {
        process.stdout.write(`  [${i + 1}] AAPL: $${basePrice.toFixed(2)} - 无信号 (${decisionTime.toFixed(2)}ms)\r`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // ==================== 性能指标 ====================
    console.log('\n\n📊 Step 3: 性能指标');
    const metrics = orchestrator.getMetrics();
    
    console.log('\n  引擎性能:');
    console.log('    总决策数:', metrics.engine.totalDecisions);
    console.log('    平均延迟:', metrics.engine.avgLatencyMs.toFixed(3) + 'ms');
    console.log('    最大延迟:', metrics.engine.maxLatencyMs.toFixed(3) + 'ms');
    console.log('    最小延迟:', metrics.engine.minLatencyMs.toFixed(3) + 'ms');
    
    console.log('\n  今日统计:');
    console.log('    交易次数:', metrics.daily.trades);
    console.log('    持仓数:', metrics.daily.positions);
    
    console.log('\n✅ Demo完成!\n');
    
  } catch (error) {
    console.error('\n❌ 错误:', error);
  } finally {
    orchestrator.stop();
    process.exit(0);
  }
}

main();




