/**
 * Test Function Calling - 测试function calling是否触发内容过滤
 */

import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { config } from 'dotenv';

config({ quiet: true });

// 模拟我们实际使用的schema
const ToolCallSchema = z.object({
  tool_calls: z.array(
    z.object({
      tool: z.string(),
      args: z.record(z.unknown()),
    })
  ),
});

const testCases = [
  {
    name: '简单的工具调用',
    systemPrompt: 'Select tools to complete the task.',
    userPrompt: 'Get AAPL price data',
    tools: [
      {
        name: 'get_prices',
        description: 'Get stock prices',
        parameters: {
          type: 'object',
          properties: {
            ticker: { type: 'string' },
          },
          required: ['ticker'],
        },
      },
    ],
  },
  {
    name: '包含trading的工具',
    systemPrompt: 'Select tools to complete the task.',
    userPrompt: 'Get AAPL trading volume',
    tools: [
      {
        name: 'get_prices',
        description: 'Get stock prices with trading volume',
        parameters: {
          type: 'object',
          properties: {
            ticker: { type: 'string' },
          },
          required: ['ticker'],
        },
      },
    ],
  },
  {
    name: '完整的工具列表（模拟实际场景）',
    systemPrompt: `Select and call tools to complete the task.

- get_price_snapshot: Fetches the most recent price snapshot for a specific stock ticker, including the latest price, trading volume, and other open, high, low, and close price data.
- get_insider_trades: Retrieves insider trading transactions for a given company ticker.`,
    userPrompt: `Task: Get AAPL data

Tickers: AAPL
Periods: intraday, swing

Call the tools needed for this task.`,
    tools: [
      {
        name: 'get_price_snapshot',
        description: 'Fetches price snapshot with trading volume',
        parameters: {
          type: 'object',
          properties: {
            ticker: { type: 'string' },
          },
          required: ['ticker'],
        },
      },
      {
        name: 'get_insider_trades',
        description: 'Get insider trades',
        parameters: {
          type: 'object',
          properties: {
            ticker: { type: 'string' },
          },
          required: ['ticker'],
        },
      },
    ],
  },
];

async function testWithStructuredOutput(
  testCase: any,
  model: string,
  method: 'functionCalling' | 'jsonSchema'
) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`测试: ${testCase.name}`);
    console.log(`模型: ${model}, 方法: ${method}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`System: ${testCase.systemPrompt.substring(0, 100)}...`);
    console.log(`User: ${testCase.userPrompt.substring(0, 100)}...`);
    console.log(`\n发送请求...`);

    const llm = new ChatOpenAI({
      model: model,
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    // 使用withStructuredOutput，就像我们实际代码中一样
    const structuredLlm = llm.withStructuredOutput(ToolCallSchema, {
      method: method as any,
    });

    const response = await structuredLlm.invoke([
      { role: 'system', content: testCase.systemPrompt },
      { role: 'user', content: testCase.userPrompt },
    ]);

    console.log(`✅ 成功! 没有触发内容过滤`);
    console.log(`响应:`, JSON.stringify(response, null, 2).substring(0, 200));
    return true;
  } catch (error: any) {
    if (error?.message?.includes('ContentPolicyViolationError')) {
      console.log(`❌ 触发内容过滤!`);
      console.log(`错误: ${error.message.substring(0, 300)}...`);
      return false;
    } else {
      console.log(`❌ 其他错误: ${error?.message || error}`);
      if (error?.message?.includes('json_schema')) {
        console.log(`   (这个错误是预期的 - Azure API版本不支持json_schema)`);
      }
      return null;
    }
  }
}

async function testWithFunctionCalling(testCase: any, model: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`测试: ${testCase.name}`);
    console.log(`模型: ${model}, 原生Function Calling`);
    console.log(`${'='.repeat(80)}`);
    console.log(`\n发送请求...`);

    const llm = new ChatOpenAI({
      model: model,
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const response = await llm.invoke(
      [
        { role: 'system', content: testCase.systemPrompt },
        { role: 'user', content: testCase.userPrompt },
      ],
      {
        functions: testCase.tools,
        function_call: 'auto',
      } as any
    );

    console.log(`✅ 成功! 没有触发内容过滤`);
    console.log(`响应:`, JSON.stringify(response, null, 2).substring(0, 200));
    return true;
  } catch (error: any) {
    if (error?.message?.includes('ContentPolicyViolationError')) {
      console.log(`❌ 触发内容过滤!`);
      console.log(`错误: ${error.message.substring(0, 300)}...`);
      return false;
    } else {
      console.log(`❌ 其他错误: ${error?.message || error}`);
      return null;
    }
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  Function Calling 内容过滤测试                        ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const models = ['gpt-5-mini']; // 先测试gpt-5-mini，因为它更容易触发问题

  for (const model of models) {
    console.log(`\n\n${'█'.repeat(80)}`);
    console.log(`  测试模型: ${model}`);
    console.log(`${'█'.repeat(80)}\n`);

    for (const testCase of testCases) {
      // 测试 functionCalling 方法
      await testWithStructuredOutput(testCase, model, 'functionCalling');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 测试原生 function calling
      await testWithFunctionCalling(testCase, model);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n\n测试完成！\n');
}

main().catch(console.error);

