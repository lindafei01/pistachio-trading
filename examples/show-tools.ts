/**
 * Show all tool descriptions
 */

import { TOOLS } from '../src/tools/index.js';

console.log('\n═══════════════════════════════════════════════════════');
console.log('ALL TOOL DESCRIPTIONS');
console.log('═══════════════════════════════════════════════════════\n');

TOOLS.forEach((tool, index) => {
  console.log(`${index + 1}. ${tool.name}`);
  console.log(`   Description: ${tool.description}`);
  
  const schema = tool.schema;
  if (schema && typeof schema === 'object' && 'shape' in schema) {
    const shape = schema.shape as Record<string, { description?: string }>;
    console.log('   Arguments:');
    Object.entries(shape).forEach(([key, value]) => {
      console.log(`     - ${key}: ${value.description || 'No description'}`);
    });
  }
  
  console.log('');
});

console.log('═══════════════════════════════════════════════════════');
console.log(`Total: ${TOOLS.length} tools`);
console.log('═══════════════════════════════════════════════════════\n');

// 检查敏感词
const sensitiveWords = ['trading', 'trade', 'buy', 'sell', 'purchase', 'sale', 'trader'];
console.log('\n🔍 Checking for sensitive words...\n');

TOOLS.forEach((tool) => {
  const fullText = `${tool.name} ${tool.description}`.toLowerCase();
  const found = sensitiveWords.filter(word => fullText.includes(word));
  
  if (found.length > 0) {
    console.log(`⚠️  ${tool.name}: Found [${found.join(', ')}]`);
    console.log(`    "${tool.description}"`);
    console.log('');
  }
});

