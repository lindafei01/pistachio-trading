/**
 * Test Real Tools - 测试实际的19个工具是否触发内容过滤
 */

import OpenAI from 'openai';
import { config } from 'dotenv';
import { TOOLS } from '../src/tools/index.js';

config({ quiet: true });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

// 使用 moonshot-v1-32k 作为默认模型
const TEST_MODEL = process.env.OPENAI_BASE_URL?.includes('moonshot') 
  ? 'moonshot-v1-32k' 
  : 'gpt-4';

// 复制 tool-executor.ts 中的 formatToolDescriptions 逻辑
function formatToolDescriptions(tools: typeof TOOLS): string {
  return tools.map(tool => {
    const schema = tool.schema;
    let argsDescription = '';
    
    if (schema && typeof schema === 'object' && 'shape' in schema) {
      const shape = schema.shape as Record<string, { description?: string }>;
      const args = Object.entries(shape)
        .map(([key, value]) => `  - ${key}: ${value.description || 'No description'}`)
        .join('\n');
      argsDescription = args ? `\n  Arguments:\n${args}` : '';
    }
    
    return `- ${tool.name}: ${tool.description}${argsDescription}`;
  }).join('\n\n');
}

// 转换工具为 OpenAI tools 格式（新格式）
function convertToOpenAITools(tools: typeof TOOLS) {
  return tools.map(tool => {
    const schema = tool.schema;
    let parameters: any = {
      type: 'object',
      properties: {},
      required: [],
    };
    
    if (schema && typeof schema === 'object' && 'shape' in schema) {
      const shape = schema.shape as Record<string, any>;
      
      for (const [key, value] of Object.entries(shape)) {
        // 简化：只处理基本类型
        if (value._def) {
          const typeName = value._def.typeName;
          let propType = 'string';
          
          if (typeName === 'ZodString') propType = 'string';
          else if (typeName === 'ZodNumber') propType = 'number';
          else if (typeName === 'ZodBoolean') propType = 'boolean';
          else if (typeName === 'ZodArray') propType = 'array';
          
          parameters.properties[key] = {
            type: propType,
            description: value.description || '',
          };
          
          // 检查是否是必需的（非 optional）
          if (!value.isOptional?.()) {
            parameters.required.push(key);
          }
        }
      }
    }
    
    // 新格式：tools 数组，每个元素包含 type 和 function
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: parameters,
      }
    };
  });
}

async function testWithTextPrompt() {
  console.log('\n' + '═'.repeat(80));
  console.log('测试 1: 使用文本格式的工具描述（模拟 system prompt）');
  console.log('═'.repeat(80));

  const toolDescriptions = formatToolDescriptions(TOOLS);
  const systemPrompt = `Select and call tools to complete the task. Use the provided tickers and parameters.

${toolDescriptions}`;

  const userPrompt = `Task: Get AAPL intraday and daily data

Tickers: AAPL
Periods: intraday, swing

Call the tools needed for this task.`;

  console.log(`\nSystem Prompt 长度: ${systemPrompt.length} 字符`);
  console.log(`User Prompt 长度: ${userPrompt.length} 字符`);
  console.log(`\nSystem Prompt 前500字符:`);
  console.log(systemPrompt.substring(0, 500) + '...\n');

  try {
    const response = await client.chat.completions.create({
      model: TEST_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      max_tokens: 200,
    });

    console.log('✅ 成功! 没有触发内容过滤');
    console.log('Response:', response.choices[0].message.content?.substring(0, 300));
    return true;
  } catch (error: any) {
    console.log('❌ 失败! 触发内容过滤');
    console.log('Error:', error.message?.substring(0, 500));
    
    if (error.message?.includes('ContentPolicyViolationError')) {
      console.log('\n⚠️  确认: 这是内容过滤错误!');
    }
    
    return false;
  }
}

async function testWithFunctionCalling() {
  console.log('\n' + '═'.repeat(80));
  console.log('测试 2: 使用 Function Calling (真实场景)');
  console.log('═'.repeat(80));

  const tools = convertToOpenAITools(TOOLS);
  
  console.log(`\n工具数量: ${tools.length}`);
  console.log(`工具名称: ${tools.map((t: any) => t.function.name).join(', ')}`);

  const userPrompt = `Task: Get AAPL intraday and daily data

Tickers: AAPL
Periods: intraday, swing

Call the tools needed for this task.`;

  try {
    const response = await client.chat.completions.create({
     //   model: 'gpt-5-mini',
       model: "moonshot-v1-32k",
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      tools: tools as any,
      tool_choice: 'auto',
    });

    console.log('✅ 成功! 没有触发内容过滤');
    
    if (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
      console.log('\n📞 LLM 调用的工具:');
      response.choices[0].message.tool_calls.forEach((tc: any) => {
        console.log('  工具名:', tc.function.name);
        console.log('  参数:', tc.function.arguments);
      });
    } else {
      console.log('\n⚠️  LLM 没有调用工具，返回了文本:');
      console.log('  ', response.choices[0].message.content);
    }
    
    return true;
  } catch (error: any) {
    console.log('❌ 失败! 触发内容过滤');
    console.log('Error:', error.message?.substring(0, 500));
    
    if (error.message?.includes('ContentPolicyViolationError')) {
      console.log('\n⚠️  确认: 这是内容过滤错误!');
    }
    
    return false;
  }
}

async function testWithSystemPromptAndFunctions() {
  console.log('\n' + '═'.repeat(80));
  console.log('测试 3: System Prompt + Function Calling (完全模拟真实场景)');
  console.log('═'.repeat(80));

  const toolDescriptions = formatToolDescriptions(TOOLS);
  const tools = convertToOpenAITools(TOOLS);
  
  const systemPrompt = `Select and call tools to complete the task. Use the provided tickers and parameters.

${toolDescriptions}`;

  const userPrompt = `Task: Get AAPL intraday and daily data

Tickers: AAPL
Periods: intraday, swing

Call the tools needed for this task.`;

  console.log(`\nSystem Prompt 长度: ${systemPrompt.length} 字符`);
  console.log(`工具数量: ${tools.length}`);

  try {
    const response = await client.chat.completions.create({
     //   model: 'gpt-5-mini',
       model: "moonshot-v1-32k",
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      tools: tools as any,
      tool_choice: 'auto',
    });

    console.log('✅ 成功! 没有触发内容过滤');
    
    if (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
      console.log('\n📞 LLM 调用的工具:');
      response.choices[0].message.tool_calls.forEach((tc: any) => {
        console.log('  工具名:', tc.function.name);
        console.log('  参数:', tc.function.arguments);
      });
    }
    
    return true;
  } catch (error: any) {
    // console.log('❌ 失败! 触发内容过滤');
    console.log('Error:', error.message?.substring(0, 500));
    
    if (error.message?.includes('ContentPolicyViolationError')) {
      console.log('\n⚠️  确认: 这是内容过滤错误!');
      console.log('\n🔍 问题可能出在:');
      console.log('  1. System prompt 中的工具描述文本');
      console.log('  2. Functions 参数中的工具定义');
      console.log('  3. 两者的组合');
    }
    
    return false;
  }
}

async function testDifferentTasks() {
  console.log('\n' + '═'.repeat(80));
  console.log('测试 4: 不同的任务描述');
  console.log('═'.repeat(80));

  const toolDescriptions = formatToolDescriptions(TOOLS);
  const systemPrompt = `Select and call tools to complete the task. Use the provided tickers and parameters.

${toolDescriptions}`;

  const testCases = [
    {
      name: '原始任务（可能触发）',
      prompt: 'Task: Get AAPL intraday and daily data\n\nTickers: AAPL\nPeriods: intraday, swing\n\nCall the tools needed for this task.',
    },
    {
      name: '简化任务',
      prompt: 'Task: Fetch AAPL price data\n\nTickers: AAPL\n\nCall the tools needed.',
    },
    {
      name: '通用任务',
      prompt: 'Get data for AAPL',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n  测试: ${testCase.name}`);
    
    try {
      await client.chat.completions.create({
        model: TEST_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: testCase.prompt },
        ],
        max_tokens: 100,
      });
      
      console.log(`  ✅ 通过`);
    } catch (error: any) {
      if (error.message?.includes('ContentPolicyViolationError')) {
        console.log(`  ❌ 触发内容过滤!`);
      } else {
        console.log(`  ⚠️  其他错误: ${error.message?.substring(0, 100)}`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  测试真实的19个工具定义                               ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  console.log('配置信息:');
  console.log(`  Base URL: ${client.baseURL}`);
  console.log(`  Model: ${TEST_MODEL}`);
  console.log(`  工具数量: ${TOOLS.length}`);

  console.log('\n工具列表:');
  TOOLS.forEach((tool, i) => {
    console.log(`  ${i + 1}. ${tool.name}`);
  });

  const results = {
    textPrompt: false,
    functionCalling: false,
    systemAndFunctions: false,
  };

  // 测试 1
  results.textPrompt = await testWithTextPrompt();
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 测试 2
  results.functionCalling = await testWithFunctionCalling();
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 测试 3
  results.systemAndFunctions = await testWithSystemPromptAndFunctions();
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 测试 4
  await testDifferentTasks();

  // 总结
  console.log('\n\n' + '█'.repeat(80));
  console.log('测试总结');
  console.log('█'.repeat(80));

  console.log(`\n1. 文本格式工具描述:           ${results.textPrompt ? '✅ 通过' : '❌ 失败'}`);
  console.log(`2. Function Calling:            ${results.functionCalling ? '✅ 通过' : '❌ 失败'}`);
  console.log(`3. System Prompt + Functions:   ${results.systemAndFunctions ? '✅ 通过' : '❌ 失败'}`);

  if (!results.textPrompt && !results.systemAndFunctions) {
    console.log('\n🔍 结论: 工具描述的**文本内容**触发了内容过滤');
    console.log('   (在 system prompt 中)');
  } else if (results.textPrompt && !results.systemAndFunctions) {
    console.log('\n🔍 结论: System Prompt + Functions 的**组合**触发了内容过滤');
  } else if (!results.functionCalling && results.textPrompt) {
    console.log('\n🔍 结论: Function definitions 触发了内容过滤');
  } else if (results.textPrompt && results.functionCalling && results.systemAndFunctions) {
    console.log('\n✅ 结论: 所有测试通过! 工具定义本身没有问题');
    console.log('   之前的错误可能是由其他因素引起的');
  }

  console.log('\n');
}

main().catch(console.error);

