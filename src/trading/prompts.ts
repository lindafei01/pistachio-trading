/**
 * Prompts for strategy compilation
 */

/**
 * System prompt for strategy compilation
 */
export function getStrategyCompilationSystemPrompt(): string {
  return `You are a quantitative financial analysis framework compiler. Your job is to take research analysis and convert it into an executable decision framework.

## Your Task

Given research findings about a financial instrument, you must:

1. **Extract actionable signals** from the analysis
2. **Formulate precise conditions** using technical indicators
3. **Define risk parameters** appropriate for the market context
4. **Create executable rules** that can run without human intervention

## Framework Requirements

**Signals must be:**
- Precise: Use exact numerical thresholds (e.g., "RSI < 30", not "RSI is low")
- Executable: Use only available data fields (price, volume, indicators)
- Logical: Combine conditions with &&, ||, ! operators
- Prioritized: Higher priority signals are evaluated first

**Available Data Fields:**
- Basic: data.price, data.open, data.high, data.low, data.close, data.volume
- Moving Averages: data.SMA_20, data.SMA_50, data.SMA_200, data.EMA_12, data.EMA_26
- Momentum: data.RSI, data.MACD, data.MACD_signal, data.MACD_histogram
- Volatility: data.BB_upper, data.BB_middle, data.BB_lower, data.ATR
- Volume: data.volume_avg, data.volume_ratio

**Condition Examples:**
- "data.RSI < 30 && data.price > data.SMA_20" (Oversold with uptrend)
- "data.MACD > data.MACD_signal && data.volume > data.volume_avg * 1.5" (MACD crossover with volume)
- "data.price < data.BB_lower && data.RSI < 40" (Bollinger Band signal)

**Risk Parameters:**
- Conservative: stopLoss: 0.02, takeProfit: 0.04, maxPositionSize: 0.1
- Moderate: stopLoss: 0.03, takeProfit: 0.06, maxPositionSize: 0.2
- Aggressive: stopLoss: 0.05, takeProfit: 0.10, maxPositionSize: 0.3

## Output Format

Return a structured framework with:
1. Multiple signals (at least 2-3) ordered by priority
2. Appropriate risk parameters based on volatility and market conditions
3. Required indicators and data lookback period
4. Clear reasoning for each signal

Focus on creating frameworks that are:
- **Executable**: Can run in real-time without LLM calls
- **Robust**: Work across different market conditions
- **Explainable**: Each signal has clear reasoning`;
}

/**
 * Build user prompt for strategy compilation
 */
export function buildStrategyCompilationPrompt(
  query: string,
  understanding: string,
  analysisResults: string,
  marketContext: string
): string {
  return `# Research Query
${query}

# Understanding
${understanding}

# Analysis Results
${analysisResults}

# Market Context
${marketContext}

---

Based on this research, compile an executable decision framework. Extract concrete market signals from the analysis and formulate them as precise conditions using technical indicators.

Focus on:
1. **Actionable signals**: Convert analysis insights into exact conditions
2. **Risk management**: Set appropriate thresholds and position sizing
3. **Timeframe**: Choose appropriate timeframe based on the analysis
4. **Indicators**: Select indicators that match the analysis approach

Return a complete framework that can process market data automatically in real-time.`;
}

/**
 * Format understanding for compilation
 */
export function formatUnderstandingForCompilation(
  intent: string,
  entities: Array<{ type: string; value: string }>
): string {
  const entitiesStr = entities.length > 0
    ? entities.map(e => `- ${e.type}: ${e.value}`).join('\n')
    : 'None identified';
  
  return `Intent: ${intent}\n\nEntities:\n${entitiesStr}`;
}

/**
 * Format task results for compilation
 */
export function formatTaskResultsForCompilation(
  taskResults: Map<string, { taskId: string; output?: string }>
): string {
  const results: string[] = [];
  
  for (const [taskId, result] of taskResults.entries()) {
    if (result.output) {
      results.push(`### Task ${taskId}\n${result.output}`);
    }
  }
  
  return results.length > 0
    ? results.join('\n\n')
    : 'No task results available';
}

/**
 * Format plans for compilation
 */
export function formatPlansForCompilation(
  plans: Array<{ summary: string; tasks: Array<{ description: string }> }>
): string {
  return plans
    .map((plan, index) => {
      const tasks = plan.tasks
        .map((task, taskIndex) => `  ${taskIndex + 1}. ${task.description}`)
        .join('\n');
      
      return `## Plan ${index + 1}: ${plan.summary}\n${tasks}`;
    })
    .join('\n\n');
}

