/**
 * Strategy Compiler
 * 
 * Converts deep research analysis into executable trading strategies.
 * Takes the output from the Research Agent and compiles it into rules
 * that can execute in real-time without LLM calls.
 */

import { callLlm } from '../model/llm.js';
import { CompiledStrategySchema, type CompiledStrategyOutput } from './schemas.js';
import {
  getStrategyCompilationSystemPrompt,
  buildStrategyCompilationPrompt,
  formatUnderstandingForCompilation,
  formatTaskResultsForCompilation,
  formatPlansForCompilation,
} from './prompts.js';
import type { Understanding, Plan, TaskResult } from '../agent/state.js';
import type { CompiledStrategy, TradingSignal, EnrichedMarketData } from './types.js';

// ============================================================================
// Strategy Compiler Options
// ============================================================================

export interface StrategyCompilerOptions {
  model: string;
}

// ============================================================================
// Strategy Compiler Implementation
// ============================================================================

/**
 * Compiles deep research results into executable trading strategies
 */
export class StrategyCompiler {
  private readonly model: string;

  constructor(options: StrategyCompilerOptions) {
    this.model = options.model;
  }

  /**
   * Main compilation method: converts research results into executable strategy
   */
  async compileFromResearch(
    query: string,
    understanding: Understanding,
    taskResults: Map<string, TaskResult>,
    completedPlans: Plan[]
  ): Promise<CompiledStrategy> {
    // Format inputs for the compilation prompt
    const understandingStr = formatUnderstandingForCompilation(
      understanding.intent,
      understanding.entities
    );
    
    const analysisResults = formatTaskResultsForCompilation(taskResults);
    const marketContext = formatPlansForCompilation(completedPlans);

    // Build the prompt
    const systemPrompt = getStrategyCompilationSystemPrompt();
    const userPrompt = buildStrategyCompilationPrompt(
      query,
      understandingStr,
      analysisResults,
      marketContext
    );

    // 🔍 DEBUG: 打印完整prompt
    if (process.env.DEBUG_PROMPTS === 'true') {
      console.log('\n🔍 [StrategyCompiler] About to call LLM with:');
      console.log('Query:', query);
      console.log('\nSystem Prompt Length:', systemPrompt.length, 'chars');
      console.log('User Prompt Length:', userPrompt.length, 'chars');
      console.log('\nFull User Prompt:');
      console.log('─'.repeat(80));
      console.log(userPrompt);
      console.log('─'.repeat(80));
      console.log('\nFull System Prompt:');
      console.log('─'.repeat(80));
      console.log(systemPrompt);
      console.log('─'.repeat(80));
    }

    // Call LLM to generate structured strategy
    const response = await callLlm(userPrompt, {
      systemPrompt,
      model: this.model,
      outputSchema: CompiledStrategySchema,
    });

    const strategyOutput = response as CompiledStrategyOutput;

    // Compile conditions into executable functions
    const compiledStrategy = this.compileStrategy(query, strategyOutput);

    return compiledStrategy;
  }

  /**
   * Compiles condition strings into executable functions
   */
  private compileStrategy(
    query: string,
    output: CompiledStrategyOutput
  ): CompiledStrategy {
    const now = new Date();
    
    // Compile each signal's condition into a function
    const compiledSignals: TradingSignal[] = output.signals.map((signal) => ({
      ...signal,
      condition: this.compileCondition(signal.condition),
    }));

    return {
      id: this.generateStrategyId(output.ticker),
      ticker: output.ticker,
      timeframe: output.timeframe,
      dataRequirements: output.dataRequirements,
      signals: compiledSignals,
      riskParams: output.riskParams,
      compiledAt: now,
      expiresAt: this.calculateExpirationTime(output.timeframe),
      sourceQuery: query,
    };
  }

  /**
   * Compiles a condition string into an executable function
   */
  private compileCondition(
    conditionStr: string
  ): (data: EnrichedMarketData) => boolean {
    try {
      // Create a safe function that evaluates the condition
      // Using Function constructor with 'data' parameter
      const conditionFunc = new Function(
        'data',
        `
        'use strict';
        try {
          return !!(${conditionStr});
        } catch (error) {
          console.error('Condition evaluation error:', error);
          return false;
        }
        `
      ) as (data: EnrichedMarketData) => boolean;

      return conditionFunc;
    } catch (error) {
      console.error(`Failed to compile condition: ${conditionStr}`, error);
      // Return a function that always returns false
      return () => false;
    }
  }

  /**
   * Generates a unique strategy ID
   */
  private generateStrategyId(ticker: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `strategy_${ticker}_${timestamp}_${random}`;
  }

  /**
   * Calculates when the strategy should expire based on timeframe
   */
  private calculateExpirationTime(timeframe: string): Date {
    const now = new Date();
    const expirationMs = this.getExpirationMs(timeframe);
    return new Date(now.getTime() + expirationMs);
  }

  /**
   * Gets expiration time in milliseconds based on timeframe
   */
  private getExpirationMs(timeframe: string): number {
    // Strategies expire after a period relative to their timeframe
    const expirationMap: Record<string, number> = {
      '1min': 1000 * 60 * 60,          // 1 hour for 1-minute strategies
      '5min': 1000 * 60 * 60 * 4,      // 4 hours for 5-minute strategies
      '15min': 1000 * 60 * 60 * 12,    // 12 hours for 15-minute strategies
      '1hour': 1000 * 60 * 60 * 24,    // 1 day for 1-hour strategies
      '1day': 1000 * 60 * 60 * 24 * 7, // 1 week for daily strategies
    };

    return expirationMap[timeframe] || 1000 * 60 * 60 * 24; // Default: 1 day
  }

  /**
   * Validates a compiled strategy
   */
  validateStrategy(strategy: CompiledStrategy): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check basic fields
    if (!strategy.ticker) {
      errors.push('Strategy missing ticker');
    }

    if (!strategy.signals || strategy.signals.length === 0) {
      errors.push('Strategy has no signals');
    }

    // Validate each signal
    strategy.signals.forEach((signal, index) => {
      if (typeof signal.condition !== 'function') {
        errors.push(`Signal ${index} has invalid condition function`);
      }

      if (signal.positionSize < 0 || signal.positionSize > 1) {
        errors.push(`Signal ${index} has invalid position size: ${signal.positionSize}`);
      }

      if (!['BUY', 'SELL', 'HOLD'].includes(signal.action)) {
        errors.push(`Signal ${index} has invalid action: ${signal.action}`);
      }
    });

    // Validate risk parameters
    if (strategy.riskParams.stopLoss < 0 || strategy.riskParams.stopLoss > 1) {
      errors.push(`Invalid stop loss: ${strategy.riskParams.stopLoss}`);
    }

    if (strategy.riskParams.maxPositionSize < 0 || strategy.riskParams.maxPositionSize > 1) {
      errors.push(`Invalid max position size: ${strategy.riskParams.maxPositionSize}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serializes a strategy for storage (converts functions to strings)
   */
  serializeStrategy(strategy: CompiledStrategy): string {
    const serializable = {
      ...strategy,
      signals: strategy.signals.map((signal) => ({
        ...signal,
        condition: typeof signal.condition === 'function'
          ? signal.condition.toString()
          : signal.condition,
      })),
      compiledAt: strategy.compiledAt.toISOString(),
      expiresAt: strategy.expiresAt.toISOString(),
    };

    return JSON.stringify(serializable, null, 2);
  }

  /**
   * Deserializes a strategy from storage (converts strings back to functions)
   */
  deserializeStrategy(serialized: string): CompiledStrategy {
    const parsed = JSON.parse(serialized);

    return {
      ...parsed,
      signals: parsed.signals.map((signal: any) => ({
        ...signal,
        condition: typeof signal.condition === 'string'
          ? this.compileCondition(signal.condition)
          : signal.condition,
      })),
      compiledAt: new Date(parsed.compiledAt),
      expiresAt: new Date(parsed.expiresAt),
    };
  }
}




