/**
 * Test Content Filter - 测试哪些词会触发Azure的内容过滤
 */

import OpenAI from 'openai';
import { config } from 'dotenv';

config({ quiet: true });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

// 测试用例
const testCases = [
  {
    name: '纯粹的trading词汇',
    prompt: 'What is trading? Explain trading strategies.',
  },
  {
    name: 'buy和sell',
    prompt: 'Should I buy or sell stocks now?',
  },
  {
    name: '我们当前的query',
    prompt: 'Create a market analysis framework for AAPL based on current market conditions. Focus on generating actionable signals with specific conditions using technical indicators. The framework should be suitable for intraday or swing trading.',
  },
  {
    name: '中性词汇版本',
    prompt: 'Create a market analysis framework for AAPL based on current market conditions. Focus on generating actionable signals with specific conditions using technical indicators. The framework should be suitable for intraday or swing analysis.',
  },
  {
    name: '工具描述 - trading volume',
    prompt: 'Get the trading volume for AAPL',
  },
  {
    name: '工具描述 - transaction volume',
    prompt: 'Get the transaction volume for AAPL',
  },
  {
    name: 'insider trades',
    prompt: 'Show me insider trades for AAPL',
  },
  {
    name: 'insider transactions',
    prompt: 'Show me insider transactions for AAPL',
  },
  {
    name: '完整的工具列表prompt（模拟）',
    prompt: `Select and call tools to complete the task. Use the provided tickers and parameters.

- get_price_snapshot: Fetches the most recent price snapshot for a specific stock ticker, including the latest price, trading volume, and other open, high, low, and close price data.
- get_insider_trades: Retrieves insider trading transactions for a given company ticker.

Task: Get AAPL data
Call the tools needed for this task.`,
  },
  {
    name: '无敏感词的简单测试',
    prompt: 'Analyze AAPL stock price data',
  },
];

async function testPrompt(testCase: { name: string; prompt: string }, model: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`测试: ${testCase.name}`);
    console.log(`模型: ${model}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Prompt: ${testCase.prompt.substring(0, 200)}${testCase.prompt.length > 200 ? '...' : ''}`);
    console.log(`\n发送请求...`);

    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: testCase.prompt,
        },
      ],
      max_tokens: 100,
    });

    console.log(`✅ 成功! 没有触发内容过滤`);
    console.log(`响应: ${response.choices[0].message.content?.substring(0, 100)}...`);
    return true;
  } catch (error: any) {
    if (error?.status === 400 && error?.message?.includes('ContentPolicyViolationError')) {
      console.log(`❌ 触发内容过滤!`);
      console.log(`错误: ${error.message.substring(0, 200)}...`);
      return false;
    } else {
      console.log(`❌ 其他错误: ${error?.message || error}`);
      return null;
    }
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  内容过滤测试 - Azure OpenAI                          ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  console.log(`Base URL: ${process.env.OPENAI_BASE_URL || 'default'}`);
  console.log(`API Key: ${process.env.OPENAI_API_KEY?.substring(0, 10)}...`);

  // 测试两个模型
  const models = ['gpt-5', 'gpt-5-mini'];

  for (const model of models) {
    console.log(`\n\n${'█'.repeat(80)}`);
    console.log(`  测试模型: ${model}`);
    console.log(`${'█'.repeat(80)}\n`);

    const results: { name: string; passed: boolean | null }[] = [];

    for (const testCase of testCases) {
      const result = await testPrompt(testCase, model);
      results.push({ name: testCase.name, passed: result });
      
      // 稍微延迟避免rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 总结
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`${model} - 测试总结`);
    console.log(`${'='.repeat(80)}`);
    
    const passed = results.filter(r => r.passed === true).length;
    const failed = results.filter(r => r.passed === false).length;
    const errors = results.filter(r => r.passed === null).length;

    console.log(`✅ 通过: ${passed}/${testCases.length}`);
    console.log(`❌ 触发过滤: ${failed}/${testCases.length}`);
    console.log(`⚠️  其他错误: ${errors}/${testCases.length}`);

    if (failed > 0) {
      console.log(`\n触发内容过滤的测试:`);
      results.filter(r => r.passed === false).forEach(r => {
        console.log(`  - ${r.name}`);
      });
    }
  }

  console.log('\n\n测试完成！\n');
}

main().catch(console.error);

