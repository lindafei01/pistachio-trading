/**
 * Test Function Calling Support - 测试 CMU AI Gateway 是否支持 function calling
 */

import OpenAI from 'openai';
import { config } from 'dotenv';

config({ quiet: true });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

// 定义一个简单的测试工具（使用新的 tools 格式）
const testTools = [
  {
    type: 'function',
    function: {
      name: 'get_stock_price',
      description: 'Get the current stock price for a given ticker symbol',
      parameters: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'The stock ticker symbol, e.g. AAPL for Apple',
          },
          exchange: {
            type: 'string',
            enum: ['NASDAQ', 'NYSE', 'other'],
            description: 'The stock exchange',
          },
        },
        required: ['ticker'],
      },
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_sum',
      description: 'Calculate the sum of two numbers',
      parameters: {
        type: 'object',
        properties: {
          a: {
            type: 'number',
            description: 'The first number',
          },
          b: {
            type: 'number',
            description: 'The second number',
          },
        },
        required: ['a', 'b'],
      },
    }
  },
];

async function testBasicCall() {
  console.log('\n' + '═'.repeat(80));
  console.log('测试 1: 基本调用（无 function calling）');
  console.log('═'.repeat(80));

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: 'Write a haiku about coding',
        },
      ],
      max_tokens: 100,
    });

    console.log('✅ 基本调用成功!');
    console.log('Response:', response.choices[0].message.content);
    return true;
  } catch (error: any) {
    console.log('❌ 基本调用失败!');
    console.log('Error:', error.message);
    return false;
  }
}

async function testFunctionCallingAuto() {
  console.log('\n' + '═'.repeat(80));
  console.log('测试 2: Function Calling - function_call: "auto"');
  console.log('═'.repeat(80));

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: 'What is the current stock price of Apple?',
        },
      ],
      tools: testTools as any,
      tool_choice: 'auto',
    });

    console.log('✅ Function calling (auto) 成功!');
    console.log('Response:', JSON.stringify(response.choices[0].message, null, 2));

    if (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
      console.log('\n📞 LLM 选择调用工具:');
      const toolCall = response.choices[0].message.tool_calls[0];
      console.log('  工具名:', (toolCall as any).function.name);
      console.log('  参数:', (toolCall as any).function.arguments);
    } else {
      console.log('\n⚠️  LLM 没有调用任何工具，返回了普通文本');
    }

    return true;
  } catch (error: any) {
    console.log('❌ Function calling (auto) 失败!');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testFunctionCallingForced() {
  console.log('\n' + '═'.repeat(80));
  console.log('测试 3: Function Calling - 强制调用特定函数');
  console.log('═'.repeat(80));

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: 'What is 25 plus 17?',
        },
      ],
      functions: testFunctions,
      tool_choice: { type: 'function', function: { name: 'calculate_sum' } },
    });

    console.log('✅ 强制调用函数成功!');
    console.log('Response:', JSON.stringify(response.choices[0].message, null, 2));

    if (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
      console.log('\n📞 工具调用详情:');
      const toolCall = response.choices[0].message.tool_calls[0];
      console.log('  工具名:', (toolCall as any).function.name);
      console.log('  参数:', (toolCall as any).function.arguments);
      
      // 解析参数
      try {
        const args = JSON.parse((toolCall as any).function.arguments);
        console.log('  解析后的参数:', args);
      } catch (e) {
        console.log('  ⚠️  无法解析参数为 JSON');
      }
    }

    return true;
  } catch (error: any) {
    console.log('❌ 强制调用函数失败!');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testMultipleFunctions() {
  console.log('\n' + '═'.repeat(80));
  console.log('测试 4: 多个函数可用，LLM 自主选择');
  console.log('═'.repeat(80));

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: 'Get me the stock price for Tesla (TSLA)',
        },
      ],
      tools: testTools as any,
      tool_choice: 'auto',
    });

    console.log('✅ 多函数选择成功!');

    if (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
      console.log('\n📞 LLM 选择的工具:');
      const toolCall = response.choices[0].message.tool_calls[0];
      console.log('  工具名:', (toolCall as any).function.name);
      console.log('  参数:', (toolCall as any).function.arguments);
      
      const expectedFunction = 'get_stock_price';
      if ((toolCall as any).function.name === expectedFunction) {
        console.log(`  ✅ 正确! LLM 选择了 ${expectedFunction}`);
      } else {
        console.log(`  ⚠️  预期选择 ${expectedFunction}，但选择了 ${(toolCall as any).function.name}`);
      }
    } else {
      console.log('\n⚠️  LLM 没有调用任何工具');
    }

    return true;
  } catch (error: any) {
    console.log('❌ 多函数选择失败!');
    console.log('Error:', error.message);
    return false;
  }
}

async function testWithSensitiveWords() {
  console.log('\n' + '═'.repeat(80));
  console.log('测试 5: Function Calling + 金融敏感词');
  console.log('═'.repeat(80));

  const financialTools = [
    {
      type: 'function',
      function: {
        name: 'get_trading_volume',
        description: 'Get the trading volume for a stock',
        parameters: {
          type: 'object',
          properties: {
            ticker: {
              type: 'string',
              description: 'The stock ticker symbol',
            },
          },
          required: ['ticker'],
        },
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_insider_trades',
        description: 'Get insider trading transactions for a company',
        parameters: {
          type: 'object',
          properties: {
            ticker: {
              type: 'string',
              description: 'The stock ticker symbol',
            },
          },
          required: ['ticker'],
        },
      }
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial assistant. Select appropriate tools to answer queries.',
        },
        {
          role: 'user',
          content: 'Show me the trading volume and insider trades for AAPL',
        },
      ],
      tools: financialTools as any,
      tool_choice: 'auto',
    });

    console.log('✅ 金融敏感词测试成功! 没有触发内容过滤');
    console.log('Response:', JSON.stringify(response.choices[0].message, null, 2));

    return true;
  } catch (error: any) {
    console.log('❌ 金融敏感词测试失败!');
    console.log('Error:', error.message);
    
    if (error.message?.includes('ContentPolicyViolationError')) {
      console.log('\n⚠️  触发了内容过滤策略!');
      console.log('这意味着函数描述中的词汇组合可能触发了 Azure 的过滤器');
    }
    
    return false;
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  CMU AI Gateway - Function Calling 支持测试          ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  console.log('配置信息:');
  console.log(`  Base URL: ${process.env.OPENAI_BASE_URL || 'default'}`);
  console.log(`  API Key: ${process.env.OPENAI_API_KEY?.substring(0, 15)}...`);
  console.log(`  Model: gpt-5-mini`);

  const results = {
    basicCall: false,
    functionCallingAuto: false,
    functionCallingForced: false,
    multipleFunctions: false,
    sensitiveWords: false,
  };

  // 测试 1
  results.basicCall = await testBasicCall();
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 测试 2
  results.functionCallingAuto = await testFunctionCallingAuto();
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 测试 3
  results.functionCallingForced = await testFunctionCallingForced();
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 测试 4
  results.multipleFunctions = await testMultipleFunctions();
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 测试 5
  results.sensitiveWords = await testWithSensitiveWords();

  // 总结
  console.log('\n\n' + '█'.repeat(80));
  console.log('测试总结');
  console.log('█'.repeat(80));

  console.log(`\n1. 基本调用:              ${results.basicCall ? '✅ 通过' : '❌ 失败'}`);
  console.log(`2. Function Calling (auto): ${results.functionCallingAuto ? '✅ 通过' : '❌ 失败'}`);
  console.log(`3. 强制调用函数:            ${results.functionCallingForced ? '✅ 通过' : '❌ 失败'}`);
  console.log(`4. 多函数选择:              ${results.multipleFunctions ? '✅ 通过' : '❌ 失败'}`);
  console.log(`5. 金融敏感词测试:          ${results.sensitiveWords ? '✅ 通过' : '❌ 失败'}`);

  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  console.log(`\n总计: ${passedCount}/${totalCount} 测试通过`);

  if (results.functionCallingAuto && results.functionCallingForced) {
    console.log('\n🎉 结论: CMU AI Gateway 完全支持 Function Calling!');
  } else if (results.basicCall && !results.functionCallingAuto) {
    console.log('\n⚠️  结论: CMU AI Gateway 不支持 Function Calling');
    console.log('需要使用其他方法进行工具调用（如 prompt engineering）');
  } else if (!results.basicCall) {
    console.log('\n❌ 结论: API 连接失败，请检查配置');
  }

  if (!results.sensitiveWords && results.functionCallingAuto) {
    console.log('\n⚠️  注意: Function Calling 支持，但金融词汇会触发内容过滤');
  }

  console.log('\n');
}

main().catch(console.error);

