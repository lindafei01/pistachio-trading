#!/usr/bin/env bun
/**
 * CLI - Multi-phase Agent Interface
 * 
 * Uses the agent with Understand, Plan, and Task Loop phases.
 */
import React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, Static, useApp, useInput } from 'ink';
import { config } from 'dotenv';

import { Intro } from './components/Intro.js';
import { Input } from './components/Input.js';
import { AnswerBox } from './components/AnswerBox.js';
import { ProviderSelector, getModelIdForProvider } from './components/ModelSelector.js';
import { ApiKeyConfirm, ApiKeyInput } from './components/ApiKeyPrompt.js';
import { QueueDisplay } from './components/QueueDisplay.js';
import { StatusMessage } from './components/StatusMessage.js';
import { CurrentTurnView, AgentProgressView } from './components/AgentProgressView.js';
import { TaskListView } from './components/TaskListView.js';
import { TopBar } from './components/TopBar.js';
import type { AppMode } from './components/TopBar.js';
import { EventLogView } from './components/EventLogView.js';
import type { Task } from './agent/state.js';
import type { AgentProgressState } from './components/AgentProgressView.js';

import { useQueryQueue } from './hooks/useQueryQueue.js';
import { useApiKey } from './hooks/useApiKey.js';
import { useAgentExecution, ToolError } from './hooks/useAgentExecution.js';

import { getSetting, setSetting } from './utils/config.js';
import { 
  getApiKeyNameForProvider, 
  getProviderDisplayName, 
  checkApiKeyExistsForProvider,
  saveApiKeyForProvider 
} from './utils/env.js';
import { MessageHistory } from './utils/message-history.js';

import { DEFAULT_PROVIDER } from './model/llm.js';
import { colors } from './theme.js';
import {
  BacktestEngine,
  FastTradingEngine,
  fetchYahooHistoricalData,
  timeframeToYahooInterval,
  newUiEvent,
  type CompiledStrategy,
  type HybridUiEvent,
} from './trading/index.js';

import type { AppState } from './cli/types.js';

// Load environment variables
config({ quiet: true });

// ============================================================================
// Completed Turn Type and View
// ============================================================================

interface CompletedTurn {
  id: string;
  query: string;
  tasks: Task[];
  answer: string;
}

// ============================================================================
// Debug Section Component
// ============================================================================

const DebugSection = React.memo(function DebugSection({ errors }: { errors: ToolError[] }) {
  if (errors.length === 0) return null;

  const formatArgs = (args: Record<string, unknown>): string => {
    const entries = Object.entries(args);
    if (entries.length === 0) return '(no args)';
    return entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ');
  };

  return (
    <Box flexDirection="column" marginTop={1} paddingX={1} borderStyle="single" borderColor="red">
      <Text color="red" bold>Debug: Tool Errors</Text>
      {errors.map((err, i) => (
        <Box key={i} flexDirection="column" marginTop={i > 0 ? 1 : 0}>
          <Text color="yellow">Tool: {err.toolName}</Text>
          <Text color="cyan">Args: {formatArgs(err.args)}</Text>
          <Text color="gray">Error: {err.error}</Text>
        </Box>
      ))}
    </Box>
  );
});

const CompletedTurnView = React.memo(function CompletedTurnView({ turn }: { turn: CompletedTurn }) {
  // Mark all tasks as completed for display
  const completedTasks = turn.tasks.map(t => ({ ...t, status: 'completed' as const }));

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Query */}
      <Box marginBottom={1}>
        <Text color={colors.primary} bold>{'> '}</Text>
        <Text>{turn.query}</Text>
      </Box>

      {/* Task list (completed) */}
      {completedTasks.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box marginLeft={2} flexDirection="column">
            <TaskListView tasks={completedTasks} />
          </Box>
        </Box>
      )}

      {/* Answer */}
      <Box marginTop={1}>
        <AnswerBox text={turn.answer} />
      </Box>
    </Box>
  );
});

// ============================================================================
// Main CLI Component
// ============================================================================

export function CLI() {
  const { exit } = useApp();

  const [state, setState] = useState<AppState>('idle');
  const [mode, setMode] = useState<AppMode>('RESEARCH');
  const [provider, setProvider] = useState(() => getSetting('provider', DEFAULT_PROVIDER));
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [history, setHistory] = useState<CompletedTurn[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hybridEvents, setHybridEvents] = useState<HybridUiEvent[]>([]);

  // Derive model from provider
  const model = getModelIdForProvider(provider) || getModelIdForProvider(DEFAULT_PROVIDER)!;

  // Store the current turn's tasks when answer starts streaming
  const currentTasksRef = useRef<Task[]>([]);

  const messageHistoryRef = useRef<MessageHistory>(new MessageHistory(model));

  const { apiKeyReady } = useApiKey(model);
  const { queue: queryQueue, enqueue, shift: shiftQueue, clear: clearQueue } = useQueryQueue();

  const {
    currentTurn,
    answerStream,
    isProcessing,
    toolErrors,
    processQuery,
    compileStrategy,
    handleAnswerComplete: baseHandleAnswerComplete,
    cancelExecution,
  } = useAgentExecution({
    model,
    messageHistory: messageHistoryRef.current,
  });

  // Capture tasks when answer stream starts
  useEffect(() => {
    if (answerStream && currentTurn) {
      currentTasksRef.current = [...currentTurn.state.tasks];
    }
  }, [answerStream, currentTurn]);

  /**
   * Handles the completed answer and moves current turn to history
   */
  const handleAnswerComplete = useCallback((answer: string) => {
    if (currentTurn) {
      // Non-streaming flows (e.g. /hybrid) won't trigger the answerStream effect.
      if (currentTasksRef.current.length === 0) {
        currentTasksRef.current = [...currentTurn.state.tasks];
      }
      setHistory(h => [...h, {
        id: currentTurn.id,
        query: currentTurn.query,
        tasks: currentTasksRef.current,
        answer,
      }]);
    }
    baseHandleAnswerComplete(answer);
    currentTasksRef.current = [];
  }, [currentTurn, baseHandleAnswerComplete]);

  const appendHybridEvent = useCallback((e: HybridUiEvent) => {
    setHybridEvents(prev => [...prev, e]);
  }, []);

  function formatStrategySpec(strategy: CompiledStrategy): string {
    const lines: string[] = [];
    lines.push('Strategy Spec');
    lines.push(`- ticker: ${strategy.ticker}`);
    lines.push(`- timeframe: ${strategy.timeframe}`);
    lines.push(`- signals: ${strategy.signals.length}`);
    lines.push(`- risk: stopLoss=${(strategy.riskParams.stopLoss * 100).toFixed(2)}% takeProfit=${(strategy.riskParams.takeProfit * 100).toFixed(2)}% maxDailyLoss=${(strategy.riskParams.maxDailyLoss * 100).toFixed(2)}%`);
    return lines.join('\n');
  }

  const runHybridQuery = useCallback(
    async (query: string) => {
      setHybridEvents([]);
      setMode('RESEARCH');
      appendHybridEvent(newUiEvent({ level: 'info', kind: 'mode', message: 'Mode → RESEARCH (start)' }));

      // 1) Research: compile executable Strategy Spec (multi-agent UI stays visible)
      appendHybridEvent(newUiEvent({ level: 'info', kind: 'system', message: 'Research: compiling Strategy Spec…' }));
      const strategy = await compileStrategy(query);
      appendHybridEvent(
        newUiEvent({
          level: 'ok',
          kind: 'system',
          message: `Research complete: spec ready (${strategy.ticker}, ${strategy.timeframe}, ${strategy.signals.length} signals)`,
        })
      );
      appendHybridEvent(
        newUiEvent({
          level: 'info',
          kind: 'system',
          message:
            `Spec details: indicators=${strategy.dataRequirements.indicators.length}, ` +
            `lookback=${strategy.dataRequirements.lookback}, minDataPoints=${strategy.dataRequirements.minDataPoints}`,
        })
      );

      // 2) Gate #1: backtest validation
      const interval = timeframeToYahooInterval(strategy.timeframe);
      const candidateRanges: Array<'3mo' | '6mo' | '1y' | '2y'> = ['3mo', '6mo', '1y', '2y'];
      let historical: Awaited<ReturnType<typeof fetchYahooHistoricalData>> | null = null;
      let usedRange: string = '3mo';

      for (const r of candidateRanges) {
        usedRange = r;
        appendHybridEvent(newUiEvent({ level: 'info', kind: 'system', message: `Backtest: fetching Yahoo history (${r}, ${interval})…` }));
        const data = await fetchYahooHistoricalData({
          ticker: strategy.ticker,
          range: r,
          interval,
        });
        appendHybridEvent(newUiEvent({ level: 'ok', kind: 'system', message: `Backtest: data loaded (${data.length} points)` }));
        historical = data;

        if (data.length >= strategy.dataRequirements.minDataPoints) {
          break;
        }

        appendHybridEvent(
          newUiEvent({
            level: 'warn',
            kind: 'gate',
            message:
              `Gate precheck: history too short for minDataPoints ` +
              `(${data.length}/${strategy.dataRequirements.minDataPoints}); expanding range…`,
          })
        );
      }

      if (!historical) {
        throw new Error('Backtest: failed to load historical data');
      }

      const backtest = new BacktestEngine({
        initialCapital: 100000,
        commission: 0.001,
        slippage: 0.0005,
        leverage: 1,
      });
      backtest.loadStrategy(strategy);
      appendHybridEvent(newUiEvent({ level: 'info', kind: 'system', message: 'Backtest: running…' }));
      const result = await backtest.runBacktest(historical);
      const m = result.metrics;

      const gate = {
        minTrades: 3,
        maxDrawdownPct: 20,
        minTotalReturnPct: -5,
      };
      const gatePass =
        m.totalTrades >= gate.minTrades &&
        m.maxDrawdown <= gate.maxDrawdownPct &&
        m.totalReturn >= gate.minTotalReturnPct;

      appendHybridEvent(
        newUiEvent({
          level: gatePass ? 'ok' : 'warn',
          kind: 'gate',
          message:
            `Gate #1 (start trading?): ${gatePass ? 'PASS' : 'FAIL'} ` +
            `(trades=${m.totalTrades}, return=${m.totalReturn.toFixed(2)}%, maxDD=${m.maxDrawdown.toFixed(2)}%)`,
        })
      );

      if (!gatePass) {
        setMode('RESEARCH');
        appendHybridEvent(newUiEvent({ level: 'warn', kind: 'mode', message: 'Mode stays RESEARCH (gate failed)' }));

        const summary =
          `Hybrid run summary\n` +
          `${formatStrategySpec(strategy)}\n` +
          `\nBacktest\n` +
          `- trades: ${m.totalTrades}\n` +
          `- totalReturn: ${m.totalReturn.toFixed(2)}%\n` +
          `- maxDrawdown: ${m.maxDrawdown.toFixed(2)}%\n` +
          `\nDecision\n` +
          `- Gate #1 failed → stay in RESEARCH\n`;
        handleAnswerComplete(summary);
        return;
      }

      // 3) Trading mode: execute spec only (no LLM calls)
      setMode('TRADING');
      appendHybridEvent(newUiEvent({ level: 'ok', kind: 'mode', message: 'Mode → TRADING (paper, no LLM calls)' }));

      const engine = new FastTradingEngine({
        maxLatencyMs: 10,
        enableCaching: true,
        maxCacheSize: 2000,
        dataRetentionMs: 1000 * 60 * 60,
        defaultRiskParams: strategy.riskParams,
        enableMetrics: true,
        logTrades: false,
      });
      engine.loadStrategy(strategy);

      // Simple paper PnL tracker (proxy, normalized)
      let position: { side: 'FLAT' | 'LONG'; entry: number; size: number } = {
        side: 'FLAT',
        entry: 0,
        size: 0,
      };
      let pnlPct = 0;
      let consecutiveLosses = 0;

      // Deterministic replay window (fast demo)
      const replay = historical.slice(-200);

      for (const bar of replay) {
        const decision = await engine.makeDecision(strategy.ticker, bar);
        if (!decision) continue;

        appendHybridEvent(
          newUiEvent({
            level: 'info',
            kind: 'trade',
            message: `Signal: ${decision.action} @ ${bar.close.toFixed(2)} (id=${decision.signalId})`,
          })
        );

        // Paper execution rules: only long entries/exits for demo
        if (decision.action === 'BUY' && position.side === 'FLAT') {
          position = { side: 'LONG', entry: bar.close, size: decision.positionSize };
          continue;
        }
        if (decision.action === 'SELL' && position.side === 'LONG') {
          const tradeRet = (bar.close / position.entry - 1) * position.size;
          pnlPct += tradeRet;
          consecutiveLosses = tradeRet < 0 ? consecutiveLosses + 1 : 0;
          position = { side: 'FLAT', entry: 0, size: 0 };

          // Gate #2: drift detection (obviously off)
          if (consecutiveLosses >= 3) {
            setMode('RESEARCH');
            appendHybridEvent(
              newUiEvent({
                level: 'warn',
                kind: 'drift',
                message: 'Gate #2 (something off?): 3 consecutive losses → back to RESEARCH',
              })
            );
            break;
          }

          // Gate #3: redline
          if (pnlPct <= -strategy.riskParams.maxDailyLoss) {
            setMode('PAUSED');
            appendHybridEvent(
              newUiEvent({
                level: 'error',
                kind: 'redline',
                message:
                  `Gate #3 (redline): pnl=${(pnlPct * 100).toFixed(2)}% ≤ -${(strategy.riskParams.maxDailyLoss * 100).toFixed(2)}% → PAUSED`,
              })
            );
            break;
          }
        }
      }

      const summary =
        `Hybrid run summary\n` +
        `${formatStrategySpec(strategy)}\n` +
        `\nBacktest\n` +
        `- trades: ${m.totalTrades}\n` +
        `- totalReturn: ${m.totalReturn.toFixed(2)}%\n` +
        `- maxDrawdown: ${m.maxDrawdown.toFixed(2)}%\n` +
        `\nTrading (paper)\n` +
        `- replayPoints: ${replay.length}\n` +
        `- pnlProxy: ${(pnlPct * 100).toFixed(2)}%\n`;

      handleAnswerComplete(summary);
    },
    [appendHybridEvent, compileStrategy, handleAnswerComplete]
  );

  const executeHybridQuery = useCallback(
    async (query: string) => {
      setState('running');
      try {
        await runHybridQuery(query);
      } catch (e) {
        if ((e as Error).message?.includes('interrupted')) {
          setStatusMessage('Operation cancelled.');
        } else {
          setStatusMessage(`Error: ${e}`);
        }
      } finally {
        setState('idle');
      }
    },
    [runHybridQuery]
  );

  /**
   * Wraps processQuery to handle state transitions and errors
   */
  const executeQuery = useCallback(
    async (query: string) => {
      setState('running');
      try {
        await processQuery(query);
      } catch (e) {
        if ((e as Error).message?.includes('interrupted')) {
          setStatusMessage('Operation cancelled.');
        } else {
          setStatusMessage(`Error: ${e}`);
        }
      } finally {
        setState('idle');
      }
    },
    [processQuery]
  );

  const shouldAutoRunHybrid = useCallback((query: string): boolean => {
    const q = query.toLowerCase();
    // English triggers
    if (
      q.includes('backtest') ||
      q.includes('paper') ||
      q.includes('replay') ||
      q.includes('maxdailyloss') ||
      q.includes('consecutive') ||
      q.includes('strategy spec') ||
      q.includes('compiled strategy') ||
      q.includes('gate')
    ) {
      return true;
    }
    // Chinese triggers
    if (query.includes('回测') || query.includes('纸上') || query.includes('回放') || query.includes('红线') || query.includes('连续亏')) {
      return true;
    }
    return false;
  }, []);

  /**
   * Process next queued query when state becomes idle
   */
  useEffect(() => {
    if (state === 'idle' && queryQueue.length > 0) {
      const nextQuery = queryQueue[0];
      shiftQueue();
      if (nextQuery.startsWith('/hybrid')) {
        const rest = nextQuery.replace(/^\/hybrid\s*/, '');
        executeHybridQuery(rest.trim());
      } else if (shouldAutoRunHybrid(nextQuery)) {
        executeHybridQuery(nextQuery);
      } else {
        executeQuery(nextQuery);
      }
    }
  }, [state, queryQueue, shiftQueue, executeQuery, executeHybridQuery, shouldAutoRunHybrid]);

  const handleSubmit = useCallback(
    (query: string) => {
      // Handle special commands even while running
      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        exit();
        return;
      }

      if (query === '/model') {
        setState('model_select');
        return;
      }

      if (query.startsWith('/hybrid')) {
        const rest = query.replace(/^\/hybrid\s*/, '');
        if (!rest.trim()) {
          setStatusMessage('Usage: /hybrid <query>');
          return;
        }

        // Queue the command if already running
        if (state === 'running') {
          enqueue(query);
          return;
        }

        executeHybridQuery(rest);
        return;
      }

      // Queue the query if already running
      if (state === 'running') {
        enqueue(query);
        return;
      }

      // Process immediately if idle
      if (shouldAutoRunHybrid(query)) {
        setStatusMessage('Detected hybrid request → running Research→Backtest→Trading flow. (Use /hybrid to force)');
        executeHybridQuery(query);
      } else {
        executeQuery(query);
      }
    },
    [state, exit, enqueue, executeQuery, executeHybridQuery, shouldAutoRunHybrid]
  );

  /**
   * Called when user selects a provider from the selector
   */
  const handleProviderSelect = useCallback((providerId: string | null) => {
    if (providerId) {
      setPendingProvider(providerId);
      setState('api_key_confirm');
    } else {
      setState('idle');
    }
  }, []);

  /**
   * Called when user confirms/declines setting API key
   */
  const handleApiKeyConfirm = useCallback((wantsToSet: boolean) => {
    if (wantsToSet) {
      setState('api_key_input');
    } else {
      // Check if existing key is available
      if (pendingProvider && checkApiKeyExistsForProvider(pendingProvider)) {
        // Use existing key, complete the provider switch
        setProvider(pendingProvider);
        setSetting('provider', pendingProvider);
        const newModel = getModelIdForProvider(pendingProvider);
        if (newModel) {
          messageHistoryRef.current.setModel(newModel);
        }
      } else {
        setStatusMessage(`Cannot use ${pendingProvider ? getProviderDisplayName(pendingProvider) : 'provider'} without an API key.`);
      }
      setPendingProvider(null);
      setState('idle');
    }
  }, [pendingProvider]);

  /**
   * Called when user submits API key
   */
  const handleApiKeySubmit = useCallback((apiKey: string | null) => {
    if (apiKey && pendingProvider) {
      const saved = saveApiKeyForProvider(pendingProvider, apiKey);
      if (saved) {
        setProvider(pendingProvider);
        setSetting('provider', pendingProvider);
        const newModel = getModelIdForProvider(pendingProvider);
        if (newModel) {
          messageHistoryRef.current.setModel(newModel);
        }
      } else {
        setStatusMessage('Failed to save API key.');
      }
    } else if (!apiKey && pendingProvider && checkApiKeyExistsForProvider(pendingProvider)) {
      // Cancelled but existing key available
      setProvider(pendingProvider);
      setSetting('provider', pendingProvider);
      const newModel = getModelIdForProvider(pendingProvider);
      if (newModel) {
        messageHistoryRef.current.setModel(newModel);
      }
    } else {
      setStatusMessage('API key not set. Provider unchanged.');
    }
    setPendingProvider(null);
    setState('idle');
  }, [pendingProvider]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (state === 'running') {
        setState('idle');
        cancelExecution();
        clearQueue();
        setStatusMessage('Operation cancelled. You can ask a new question or press Ctrl+C again to quit.');
      } else if (state === 'api_key_confirm' || state === 'api_key_input') {
        setPendingProvider(null);
        setState('idle');
        setStatusMessage('Cancelled.');
      } else {
        console.log('\nGoodbye!');
        exit();
      }
    }
  });

  if (state === 'model_select') {
    return (
      <Box flexDirection="column">
        <ProviderSelector provider={provider} onSelect={handleProviderSelect} />
      </Box>
    );
  }

  if (state === 'api_key_confirm' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ApiKeyConfirm 
          providerName={getProviderDisplayName(pendingProvider)} 
          onConfirm={handleApiKeyConfirm} 
        />
      </Box>
    );
  }

  if (state === 'api_key_input' && pendingProvider) {
    const apiKeyName = getApiKeyNameForProvider(pendingProvider) || '';
    return (
      <Box flexDirection="column">
        <ApiKeyInput 
          providerName={getProviderDisplayName(pendingProvider)}
          apiKeyName={apiKeyName}
          onSubmit={handleApiKeySubmit} 
        />
      </Box>
    );
  }

  // Combine intro and history into a single static stream
  const staticItems: Array<{ type: 'intro' } | { type: 'turn'; turn: CompletedTurn }> = [
    { type: 'intro' },
    ...history.map(h => ({ type: 'turn' as const, turn: h })),
  ];

  return (
    <Box flexDirection="column">
      <TopBar
        provider={provider}
        model={model}
        mode={mode}
        runState={state === 'running' ? 'running' : 'idle'}
        queued={queryQueue.length}
      />
      <EventLogView events={hybridEvents} />
      {/* Intro + completed history - each item rendered once, never re-rendered */}
      <Static items={staticItems}>
        {(item) =>
          item.type === 'intro' ? (
            <Intro key="static-intro" provider={provider} />
          ) : (
            <CompletedTurnView key={`static-turn-${item.turn.id}`} turn={item.turn} />
          )
        }
      </Static>

      {/* Render current in-progress conversation */}
      {currentTurn && (
        <Box flexDirection="column" marginBottom={1}>
          {/* Query + phase progress + task list */}
          <CurrentTurnView 
            query={currentTurn.query} 
            state={currentTurn.state} 
          />

          {/* Streaming answer (appears below progress) */}
          {answerStream && (
            <Box marginTop={1}>
              <AnswerBox
                stream={answerStream}
                onComplete={handleAnswerComplete}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Debug: Tool Errors */}
      <DebugSection errors={toolErrors} />

      {/* Queued queries */}
      <QueueDisplay queries={queryQueue} />

      {/* Status message */}
      <StatusMessage message={statusMessage} />

      {/* Input bar - always visible and interactive */}
      <Box marginTop={1}>
        <Input onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}
