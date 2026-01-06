# Hybrid Mode Quick Start Guide

快速上手Dexter的混合交易模式（5分钟）

## 前置条件

```bash
# 确保已安装Bun
bun --version

# 确保已设置OpenAI API key
echo $OPENAI_API_KEY
```

## 🚀 快速开始

### 1. 运行完整演示

```bash
# 运行混合交易演示
bun run examples/hybrid-trading-demo.ts
```

这将展示：
- ✅ 策略编译（AI → 可执行规则）
- ✅ 实时交易决策（< 1ms）
- ✅ 性能指标统计
- ✅ 模拟市场数据处理

### 2. 运行简单示例

```bash
# 只演示策略编译
bun run examples/simple-strategy-example.ts
```

### 3. 原有研究模式

```bash
# 运行原有的深度研究CLI
bun start
```

## 📝 代码示例

### 示例1: 编译交易策略

```typescript
import { Agent } from './src/agent/orchestrator.js';

const agent = new Agent({ model: 'gpt-4o' });

// 从查询生成策略
const strategy = await agent.compileStrategy(
  'Create an intraday trading strategy for AAPL using RSI and moving averages'
);

console.log(`Strategy has ${strategy.signals.length} signals`);
console.log(`Expires at: ${strategy.expiresAt}`);
```

### 示例2: 使用混合orchestrator

```typescript
import { HybridOrchestrator } from './src/trading/index.js';

// 初始化
const orchestrator = new HybridOrchestrator({
  watchlist: ['AAPL', 'MSFT', 'TSLA'],
  researchModel: 'gpt-4o',
  strategyRefreshIntervalMs: 1000 * 60 * 60, // 1小时
});

// 启动（后台自动刷新策略）
await orchestrator.start();

// 处理实时市场数据
const decision = await orchestrator.onMarketData(ticker, marketData);

if (decision) {
  console.log(`Signal: ${decision.action} ${decision.ticker}`);
  await orchestrator.executeTrade(decision);
}
```

### 示例3: 深度研究（原有功能）

```typescript
import { HybridOrchestrator } from './src/trading/index.js';

const orchestrator = new HybridOrchestrator();

// 使用Research Mode进行深度分析
const analysis = await orchestrator.deepResearch(
  "Should I invest in Apple based on recent earnings?"
);

console.log(analysis);
```

## 🎯 三种使用场景

### 场景1: 只做研究
```typescript
// 使用原有Agent
const agent = new Agent({ model: 'gpt-4o' });
const answer = await agent.run("Analyze AAPL financials");
```

**适用**: 长期投资决策、基本面分析

### 场景2: 策略开发
```typescript
// 编译策略但不执行
const strategy = await agent.compileStrategy("Create strategy for TSLA");
console.log(strategy.signals);
```

**适用**: 算法开发、策略测试

### 场景3: 自动交易（推荐）
```typescript
// 完整混合模式
const orchestrator = new HybridOrchestrator({
  watchlist: ['AAPL', 'MSFT'],
});
await orchestrator.start();
// 自动后台更新策略 + 实时执行
```

**适用**: 日内交易、自适应交易

## 📊 性能对比

| 功能 | Research Mode | Hybrid Mode |
|------|---------------|-------------|
| 深度分析 | ✅ 8-50s | ✅ 8-50s (后台) |
| 实时交易 | ❌ 太慢 | ✅ < 1ms |
| 适用频率 | 低频 | 低频 + 高频 |

## 🔧 常见问题

### Q: 混合模式会替代原有功能吗？
**A**: 不会！所有原有功能完整保留。混合模式是额外功能。

### Q: 需要额外的API key吗？
**A**: 不需要。使用相同的OpenAI API key。

### Q: 可以只用Trading Mode吗？
**A**: 可以，但需要先用Research Mode生成策略。

### Q: 策略多久更新一次？
**A**: 可配置，默认1小时。根据需要调整`strategyRefreshIntervalMs`。

### Q: 真的能达到< 1ms延迟吗？
**A**: 是的！Trading Mode不调用LLM，只执行预编译的规则。

## 📁 项目结构

```
src/
├── agent/              # 原有深度研究agent
│   └── orchestrator.ts # ✨ 扩展了compileStrategy()
├── trading/            # 🆕 新增交易模块
│   ├── types.ts
│   ├── strategy-compiler.ts
│   ├── fast-engine.ts
│   ├── indicators.ts
│   └── hybrid-orchestrator.ts
└── tools/              # 原有金融数据工具

examples/
├── hybrid-trading-demo.ts      # 完整演示
└── simple-strategy-example.ts  # 简单示例
```

## 🎓 学习路径

1. **理解原理**: 阅读 [HYBRID_MODE.md](./HYBRID_MODE.md)
2. **运行演示**: `bun run examples/hybrid-trading-demo.ts`
3. **查看代码**: 从 `src/trading/hybrid-orchestrator.ts` 开始
4. **修改配置**: 调整watchlist和刷新频率
5. **扩展功能**: 添加自己的技术指标或策略

## 💬 下一步

- 查看完整文档: [HYBRID_MODE.md](./HYBRID_MODE.md)
- 阅读主README: [README.md](./README.md)
- 浏览源代码: `src/trading/`
- 运行示例: `examples/`

---

**提示**: 演示使用模拟数据。在实际环境中，需要接入真实市场数据流。




