# Dexter 🤖

Dexter is an autonomous financial research agent that thinks, plans, and learns as it works. It performs analysis using task planning, self-reflection, and real-time market data. Think Claude Code, but built specifically for financial research.


<img width="979" height="651" alt="Screenshot 2025-10-14 at 6 12 35 PM" src="https://github.com/user-attachments/assets/5a2859d4-53cf-4638-998a-15cef3c98038" />

## Overview

Dexter takes complex financial questions and turns them into clear, step-by-step research plans. It runs those tasks using live market data, checks its own work, and refines the results until it has a confident, data-backed answer.  

**Key Capabilities:**
- **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- **Autonomous Execution**: Selects and executes the right tools to gather financial data
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Real-Time Financial Data**: Access to income statements, balance sheets, and cash flow statements
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

<img width="996" height="639" alt="Screenshot 2025-11-22 at 1 45 07 PM" src="https://github.com/user-attachments/assets/8915fd70-82c9-4775-bdf9-78d5baf28a8a" />


### Prerequisites

- [Bun](https://bun.com) runtime (v1.0 or higher)
- LLM API key:
  - **Recommended**: [Kimi (Moonshot)](https://platform.moonshot.cn/) API key - No content filtering, OpenAI-compatible
  - Alternative: [OpenAI](https://platform.openai.com/api-keys) API key
- Financial Datasets API key (get [here](https://financialdatasets.ai))
- Tavily API key (get [here](https://tavily.com)) - optional, for web search

#### Installing Bun

If you don't have Bun installed, you can install it using curl:

**macOS/Linux:**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

After installation, restart your terminal and verify Bun is installed:
```bash
bun --version
```

### Installing Dexter

1. Clone the repository:
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

2. Install dependencies with Bun:
```bash
bun install
```

3. Set up your environment variables:
```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your API keys
# OPENAI_API_KEY=your-api-key
# 
# For Kimi (Moonshot) API (recommended):
# OPENAI_BASE_URL=https://api.moonshot.cn/v1
# 
# FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key
# TAVILY_API_KEY=your-tavily-api-key
```

**Note**: This project uses Kimi (Moonshot) API by default, which provides OpenAI-compatible endpoints without content filtering. If you prefer OpenAI, simply omit the `OPENAI_BASE_URL` setting.

### Usage

Run Dexter in interactive mode:
```bash
bun start
```

Or with watch mode for development:
```bash
bun dev
```

### Example Queries

Try asking Dexter questions like:
- "What was Apple's revenue growth over the last 4 quarters?"
- "Compare Microsoft and Google's operating margins for 2023"
- "Analyze Tesla's cash flow trends over the past year"
- "What is Amazon's debt-to-equity ratio based on recent financials?"

Dexter will automatically:
1. Break down your question into research tasks
2. Fetch the necessary financial data
3. Perform calculations and analysis
4. Provide a comprehensive, data-rich answer

## 🆕 Hybrid Trading Mode

### Quick Start with Hybrid Mode

Run the demo to see Research + Trading modes in action:

```bash
bun run examples/hybrid-trading-demo.ts
```

### Strategy Compilation Example

Compile a trading strategy from AI analysis:

```bash
bun run examples/simple-strategy-example.ts
```

### Programmatic Usage

```typescript
import { HybridOrchestrator } from './src/trading/index.js';

// Initialize orchestrator
const orchestrator = new HybridOrchestrator({
  watchlist: ['AAPL', 'MSFT', 'TSLA'],
  researchModel: 'gpt-4o',
  strategyRefreshIntervalMs: 1000 * 60 * 60, // 1 hour
});

// Start (begins background strategy refresh)
await orchestrator.start();

// Research Mode: Deep analysis
const analysis = await orchestrator.deepResearch(
  "Should I buy Tesla stock based on recent earnings?"
);

// Trading Mode: Real-time execution
marketDataStream.on('data', async (data) => {
  // This is the hot path - < 1ms latency
  const decision = await orchestrator.onMarketData(data.ticker, data);
  
  if (decision) {
    await orchestrator.executeTrade(decision);
  }
});
```

### Use Cases

| Mode | Use Case | Example |
|------|----------|---------|
| **Research Only** | Investment research | "Analyze AAPL's fundamentals for long-term investment" |
| **Strategy Compilation** | Algorithm development | "Create a trading strategy for TSLA using RSI and MACD" |
| **Hybrid (Both)** | Adaptive trading | AI updates strategies hourly, executes trades in real-time |

### Performance

- **Research Mode**: 8-50 seconds per query (depends on complexity)
- **Strategy Compilation**: 10-60 seconds per strategy
- **Trading Mode**: < 1 millisecond per decision
- **Strategy Refresh**: Background, configurable interval

## Architecture

Dexter uses a multi-agent architecture with specialized components:

- **Planning Agent**: Analyzes queries and creates structured task lists
- **Action Agent**: Selects appropriate tools and executes research steps
- **Validation Agent**: Verifies task completion and data sufficiency
- **Answer Agent**: Synthesizes findings into comprehensive responses

### 🆕 Hybrid Trading Mode (Research + Trading)

Dexter now supports **two operating modes** that work together:

#### 📚 Research Mode (Deep Analysis)
- **Purpose**: Complex financial analysis and strategy generation
- **Latency**: 8-50 seconds
- **Uses**: Full Multi-Agent pipeline with LLM calls
- **Output**: Detailed analysis OR compiled trading strategies
- **Best for**: Long-term decisions, fundamental analysis, strategy development

#### ⚡ Trading Mode (Fast Execution)
- **Purpose**: Real-time trade execution
- **Latency**: < 1 millisecond
- **Uses**: Pre-compiled strategies (no LLM calls)
- **Output**: Trade decisions (BUY/SELL/HOLD)
- **Best for**: Intraday trading, high-frequency execution

#### 🔄 How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│  Research Mode (Background, Periodic)                        │
│  ─────────────────────────────────────────                   │
│  AI analyzes markets → Generates strategies                  │
│  "What's a good strategy for AAPL today?"                    │
│  ↓                                                            │
│  Compiled Strategy (executable rules)                        │
└─────────────────────────────────────────────────────────────┘
                         ↓ Loads into
┌─────────────────────────────────────────────────────────────┐
│  Trading Mode (Real-time)                                    │
│  ──────────────────────────────                              │
│  Market data → Execute strategy → Trade decision             │
│  Latency: < 1ms (no AI calls)                                │
└─────────────────────────────────────────────────────────────┘
```

**Key Innovation**: AI thinks slowly to create smart strategies, then executes them at high speed.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **UI Framework**: [React](https://react.dev) + [Ink](https://github.com/vadimdemedes/ink) (terminal UI)
- **LLM Integration**: [LangChain.js](https://js.langchain.com) with multi-provider support (OpenAI, Anthropic, Google)
- **Schema Validation**: [Zod](https://zod.dev)
- **Language**: TypeScript
- **Trading Engine**: Custom high-performance execution engine with sub-millisecond latency
- **Technical Indicators**: Incremental calculation algorithms for real-time updates


### Changing Models

Type `/model` in the CLI to switch between:
- GPT 4.1 (OpenAI)
- Claude Sonnet 4.5 (Anthropic)
- Gemini 3 (Google)

## Features

### Core Research Features

- ✅ **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- ✅ **Autonomous Execution**: Selects and executes the right tools to gather financial data
- ✅ **Self-Validation**: Checks its own work and iterates until tasks are complete
- ✅ **Real-Time Financial Data**: Access to income statements, balance sheets, and cash flow statements
- ✅ **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

### 🆕 Hybrid Trading Features

- ⚡ **Dual-Mode Operation**: Deep research (8-50s) + Fast execution (<1ms)
- 🤖 **AI Strategy Generation**: Converts analysis into executable trading rules
- 📊 **Technical Indicators**: RSI, MACD, Bollinger Bands, SMA, EMA, ATR, and more
- 🔄 **Incremental Updates**: O(1) indicator calculations for real-time performance
- 🎯 **Risk Management**: Built-in position sizing, stop loss, and take profit
- 📈 **Performance Metrics**: Real-time latency tracking and trade statistics
- 🔁 **Adaptive Strategies**: Background refresh keeps strategies aligned with market conditions

### Architecture Highlights

**Research Layer** (Strategic):
- Multi-agent collaboration (Understand, Plan, Execute, Reflect, Answer)
- Iterative refinement with self-reflection
- Context management for efficient data handling
- Comprehensive financial analysis

**Trading Layer** (Tactical):
- Pre-compiled strategy execution
- Zero LLM calls in hot path
- Sub-millisecond decision latency
- Real-time market data processing

**Hybrid Orchestration**:
- Background strategy updates
- Watchlist management
- Automatic strategy loading
- Performance monitoring

## How to Contribute

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

**Important**: Please keep your pull requests small and focused.  This will make it easier to review and merge.


## License

This project is licensed under the MIT License.

