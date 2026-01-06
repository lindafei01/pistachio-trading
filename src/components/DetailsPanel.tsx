import React from 'react';
import { Box, Text } from 'ink';
import type { CompiledStrategy } from '../trading/types.js';
import type { BacktestResult } from '../trading/backtesting.js';

interface DetailsPanelProps {
  strategy: CompiledStrategy | null;
  backtestResult: BacktestResult | null;
  diagnosis: string | null;
}

/**
 * Displays detailed information about the current strategy and backtest results
 */
export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  strategy,
  backtestResult,
  diagnosis,
}) => {
  if (!strategy && !backtestResult) {
    return null; // Nothing to show
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0} borderStyle="round" borderColor="gray">
      {/* Strategy Details */}
      {strategy && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">
            📋 Strategy Spec
          </Text>
          <Box flexDirection="column" marginLeft={2} marginTop={0}>
            <Text dimColor>
              Ticker: <Text color="white">{strategy.ticker}</Text>
              {' · '}
              Timeframe: <Text color="white">{strategy.timeframe}</Text>
              {' · '}
              Signals: <Text color="white">{strategy.signals.length}</Text>
            </Text>
            
            {/* Display signals */}
            {strategy.signals.slice(0, 3).map((signal, idx) => (
              <Box key={signal.id} flexDirection="column" marginTop={0}>
                <Text dimColor>
                  Signal {idx + 1} ({signal.action}):
                </Text>
                <Text dimColor color="gray" wrap="wrap">
                  {'  '}{signal.reasoning || (typeof signal.condition === 'string' ? signal.condition : 'Custom condition')}
                </Text>
              </Box>
            ))}
            
            {strategy.signals.length > 3 && (
              <Text dimColor>  ... and {strategy.signals.length - 3} more</Text>
            )}
            
            {/* Indicators */}
            {strategy.dataRequirements.indicators.length > 0 && (
              <Text dimColor>
                Indicators: {strategy.dataRequirements.indicators.join(', ')}
              </Text>
            )}
            
            {/* Risk params */}
            <Text dimColor>
              Risk: Stop Loss {(strategy.riskParams.stopLoss * 100).toFixed(1)}%
              {' · '}
              Take Profit {(strategy.riskParams.takeProfit * 100).toFixed(1)}%
            </Text>
          </Box>
        </Box>
      )}

      {/* Backtest Results */}
      {backtestResult && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            📊 Backtest Result
          </Text>
          <Box flexDirection="column" marginLeft={2} marginTop={0}>
            <Text>
              Trades: <Text color={backtestResult.metrics.totalTrades > 0 ? 'green' : 'red'}>
                {backtestResult.metrics.totalTrades}
              </Text>
              {' · '}
              Return: <Text color={backtestResult.metrics.totalReturn >= 0 ? 'green' : 'red'}>
                {backtestResult.metrics.totalReturn.toFixed(2)}%
              </Text>
              {' · '}
              Max DD: <Text color="yellow">
                {backtestResult.metrics.maxDrawdown.toFixed(2)}%
              </Text>
            </Text>
            
            {backtestResult.metrics.totalTrades > 0 && (
              <>
                <Text dimColor>
                  Win Rate: {backtestResult.metrics.winRate.toFixed(1)}%
                  {' · '}
                  Avg Win: {backtestResult.metrics.avgWin.toFixed(2)}%
                  {' · '}
                  Avg Loss: {backtestResult.metrics.avgLoss.toFixed(2)}%
                </Text>
                <Text dimColor>
                  Sharpe: {backtestResult.metrics.sharpeRatio.toFixed(2)}
                  {' · '}
                  Profit Factor: {backtestResult.metrics.profitFactor.toFixed(2)}
                </Text>
              </>
            )}
            
            {/* Diagnosis when no trades */}
            {diagnosis && (
              <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1}>
                <Text color="yellow" bold>⚠️  Diagnosis</Text>
                <Text wrap="wrap" color="yellow">
                  {diagnosis}
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      )}
      
      {/* Follow-up suggestions */}
      {diagnosis && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Text dimColor bold>💡 What's next?</Text>
          <Text dimColor>  • Type <Text color="cyan">/suggest</Text> - Let AI adjust the strategy</Text>
          <Text dimColor>  • Type <Text color="cyan">/manual &lt;your idea&gt;</Text> - Provide your own strategy</Text>
          <Text dimColor>  • Type <Text color="cyan">/retry</Text> - Try different parameters</Text>
        </Box>
      )}
    </Box>
  );
};

