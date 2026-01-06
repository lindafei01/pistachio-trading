/**
 * Debug Prompts - 查看所有发送给LLM的prompts
 * 用于调试内容过滤问题
 */

import { HybridOrchestrator } from '../src/trading/index.js';
import { config } from 'dotenv';
import * as fs from 'fs';

config({ quiet: true });

// 启用prompt调试
process.env.DEBUG_PROMPTS = 'true';

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  Debug Prompts - 捕获所有LLM调用                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // 创建日志文件
  const logFile = 'prompts-debug.log';
  const originalLog = console.log;
  const logStream = fs.createWriteStream(logFile, { flags: 'w' });

  // 重定向console.log到文件和控制台
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    originalLog(...args);  // 输出到控制台
    logStream.write(message + '\n');  // 写入文件
  };

  const orchestrator = new HybridOrchestrator({
    watchlist: ['AAPL'],
    researchModel: 'gpt-5',
  });

  console.log('\n开始编译策略...');
  console.log('所有prompts将被记录到:', logFile);
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    await orchestrator.refreshStrategy('AAPL');
    console.log('\n✅ 策略编译成功');
  } catch (error) {
    console.log('\n❌ 策略编译失败');
    console.log('错误信息:', error);
    
    if (error instanceof Error) {
      console.log('\n错误详情:');
      console.log('  Message:', error.message);
      console.log('  Stack:', error.stack);
    }
  } finally {
    orchestrator.stop();
    logStream.end();
    
    console.log = originalLog;  // 恢复原始console.log
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 完整日志已保存到:', logFile);
    console.log('='.repeat(80) + '\n');
    
    console.log('查看日志:');
    console.log(`  cat ${logFile}`);
    console.log(`  grep -i "prompt" ${logFile}`);
    console.log(`  grep -i "trading\\|buy\\|sell" ${logFile}`);
    
    process.exit(0);
  }
}

main();

