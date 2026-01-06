/**
 * Backtesting Engine
 * 
 * Tests compiled trading strategies against historical market data
 * Simulates high-frequency trading with realistic order execution
 */

import type { MarketData, CompiledStrategy, TradeDecision } from './types.js';
import { FastTradingEngine } from './fast-engine.js';

// ============================================================================
// Types
// ============================================================================

export interface BacktestConfig {
  initialCapital: number;
  commission: number; // Per trade commission (e.g., 0.001 = 0.1%)
  slippage: number; // Price slippage (e.g., 0.0005 = 0.05%)
  leverage: number; // Maximum leverage (e.g., 1 = no leverage, 2 = 2x)
}

export interface Position {
  ticker: string;
  entry: number;
  quantity: number;
  entryTime: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Trade {
  ticker: string;
  action: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  timestamp: number;
  pnl?: number; // Only for closing trades
  commission: number;
  reason: string;
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  totalReturn: number; // Percentage
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgHoldingTime: number; // In milliseconds
  totalCommissions: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: { timestamp: number; equity: number }[];
  positions: Position[];
  finalCapital: number;
}

// ============================================================================
// Backtesting Engine
// ============================================================================

export class BacktestEngine {
  private config: BacktestConfig;
  private tradingEngine: FastTradingEngine;
  private strategy: CompiledStrategy | null = null;
  
  // State
  private capital: number;
  private positions: Map<string, Position> = new Map();
  private trades: Trade[] = [];
  private equityCurve: { timestamp: number; equity: number }[] = [];
  
  constructor(config: Partial<BacktestConfig> = {}) {
    this.config = {
      initialCapital: 100000,
      commission: 0.001,
      slippage: 0.0005,
      leverage: 1,
      ...config,
    };
    
    this.capital = this.config.initialCapital;
    this.tradingEngine = new FastTradingEngine({
      maxLatencyMs: 10,
      enableCaching: false, // Disable caching for backtesting
      logTrades: false,
    });
  }
  
  /**
   * Load a compiled strategy for backtesting
   */
  loadStrategy(strategy: CompiledStrategy): void {
    this.strategy = strategy;
    this.tradingEngine.loadStrategy(strategy);
  }
  
  /**
   * Run backtest on historical data
   */
  async runBacktest(historicalData: MarketData[]): Promise<BacktestResult> {
    if (!this.strategy) {
      throw new Error('No strategy loaded. Call loadStrategy() first.');
    }
    
    // Reset state
    this.capital = this.config.initialCapital;
    this.positions.clear();
    this.trades = [];
    this.equityCurve = [];
    
    console.log('\n🔄 Starting backtest...');
    console.log(`  Initial Capital: $${this.config.initialCapital.toLocaleString()}`);
    console.log(`  Data Points: ${historicalData.length}`);
    console.log(`  Strategy: ${this.strategy.ticker} (${this.strategy.signals.length} signals)\n`);
    
    // Process each data point
    for (let i = 0; i < historicalData.length; i++) {
      const data = historicalData[i];
      
      // Get trading decision from fast engine
      const decision = await this.tradingEngine.makeDecision(data.ticker, data);
      
      // Execute trade if signal exists
      if (decision) {
        this.executeTrade(data, decision);
      }
      
      // Update positions (check stop loss / take profit)
      this.updatePositions(data);
      
      // Record equity curve every 100 data points
      if (i % 100 === 0 || i === historicalData.length - 1) {
        const equity = this.calculateEquity(data);
        this.equityCurve.push({ timestamp: data.timestamp, equity });
        
        // Progress indicator
        const progress = ((i / historicalData.length) * 100).toFixed(1);
        console.log(`  Progress: ${progress}% | Equity: $${equity.toLocaleString()} | Trades: ${this.trades.length}`);
      }
    }
    
    // Close all remaining positions at the end
    const lastData = historicalData[historicalData.length - 1];
    this.closeAllPositions(lastData);
    
    // Calculate metrics
    const metrics = this.calculateMetrics();
    
    return {
      config: this.config,
      metrics,
      trades: this.trades,
      equityCurve: this.equityCurve,
      positions: Array.from(this.positions.values()),
      finalCapital: this.capital,
    };
  }
  
  /**
   * Execute a trade based on trading decision
   */
  private executeTrade(data: MarketData, decision: TradeDecision): void {
    const position = this.positions.get(data.ticker);
    
    // Apply slippage
    const executionPrice = decision.action === 'BUY'
      ? data.price * (1 + this.config.slippage)
      : data.price * (1 - this.config.slippage);
    
    if (decision.action === 'BUY' && !position) {
      // Open new position
      const positionSize = this.config.initialCapital * 0.1; // 10% of initial capital
      const quantity = Math.floor(positionSize / executionPrice);
      const cost = quantity * executionPrice;
      const commission = cost * this.config.commission;
      
      if (cost + commission <= this.capital) {
        this.capital -= (cost + commission);
        
        this.positions.set(data.ticker, {
          ticker: data.ticker,
          entry: executionPrice,
          quantity,
          entryTime: data.timestamp,
          stopLoss: executionPrice * (1 - (this.strategy?.riskParams.stopLoss || 0.02)),
          takeProfit: executionPrice * (1 + (this.strategy?.riskParams.takeProfit || 0.04)),
        });
        
        this.trades.push({
          ticker: data.ticker,
          action: 'BUY',
          price: executionPrice,
          quantity,
          timestamp: data.timestamp,
          commission,
          reason: decision.reasoning || `Signal ${decision.signalId}`,
        });
      }
    } else if (decision.action === 'SELL' && position) {
      // Close existing position
      const proceeds = position.quantity * executionPrice;
      const commission = proceeds * this.config.commission;
      const cost = position.quantity * position.entry;
      const pnl = proceeds - cost - commission;
      
      this.capital += (proceeds - commission);
      this.positions.delete(data.ticker);
      
      this.trades.push({
        ticker: data.ticker,
        action: 'SELL',
        price: executionPrice,
        quantity: position.quantity,
        timestamp: data.timestamp,
        pnl,
        commission,
        reason: decision.reasoning || `Signal ${decision.signalId}`,
      });
    }
  }
  
  /**
   * Update positions - check stop loss and take profit
   */
  private updatePositions(data: MarketData): void {
    const position = this.positions.get(data.ticker);
    
    if (position) {
      // Check stop loss
      if (position.stopLoss && data.price <= position.stopLoss) {
        this.closePosition(data, position, 'Stop Loss');
      }
      // Check take profit
      else if (position.takeProfit && data.price >= position.takeProfit) {
        this.closePosition(data, position, 'Take Profit');
      }
    }
  }
  
  /**
   * Close a position
   */
  private closePosition(data: MarketData, position: Position, reason: string): void {
    const executionPrice = data.price * (1 - this.config.slippage);
    const proceeds = position.quantity * executionPrice;
    const commission = proceeds * this.config.commission;
    const cost = position.quantity * position.entry;
    const pnl = proceeds - cost - commission;
    
    this.capital += (proceeds - commission);
    this.positions.delete(data.ticker);
    
    this.trades.push({
      ticker: data.ticker,
      action: 'SELL',
      price: executionPrice,
      quantity: position.quantity,
      timestamp: data.timestamp,
      pnl,
      commission,
      reason,
    });
  }
  
  /**
   * Close all open positions
   */
  private closeAllPositions(data: MarketData): void {
    for (const position of this.positions.values()) {
      this.closePosition(data, position, 'End of backtest');
    }
  }
  
  /**
   * Calculate current equity (cash + position values)
   */
  private calculateEquity(data: MarketData): number {
    let equity = this.capital;
    
    const position = this.positions.get(data.ticker);
    if (position) {
      equity += position.quantity * data.price;
    }
    
    return equity;
  }
  
  /**
   * Calculate performance metrics
   */
  private calculateMetrics(): BacktestMetrics {
    const totalTrades = this.trades.filter(t => t.action === 'SELL').length;
    const wins = this.trades.filter(t => t.pnl && t.pnl > 0);
    const losses = this.trades.filter(t => t.pnl && t.pnl < 0);
    
    const totalPnL = this.trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalCommissions = this.trades.reduce((sum, t) => sum + t.commission, 0);
    const totalReturn = ((this.capital - this.config.initialCapital) / this.config.initialCapital) * 100;
    
    const avgWin = wins.length > 0 
      ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length 
      : 0;
    const avgLoss = losses.length > 0 
      ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length)
      : 0;
    
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    // Calculate Sharpe Ratio (simplified)
    const returns = this.equityCurve.map((point, i) => {
      if (i === 0) return 0;
      return (point.equity - this.equityCurve[i - 1].equity) / this.equityCurve[i - 1].equity;
    });
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    
    // Calculate maximum drawdown
    let maxEquity = this.config.initialCapital;
    let maxDrawdown = 0;
    for (const point of this.equityCurve) {
      if (point.equity > maxEquity) {
        maxEquity = point.equity;
      }
      const drawdown = ((maxEquity - point.equity) / maxEquity) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    // Average holding time
    const buyTrades = this.trades.filter(t => t.action === 'BUY');
    const sellTrades = this.trades.filter(t => t.action === 'SELL');
    let totalHoldingTime = 0;
    for (let i = 0; i < Math.min(buyTrades.length, sellTrades.length); i++) {
      totalHoldingTime += sellTrades[i].timestamp - buyTrades[i].timestamp;
    }
    const avgHoldingTime = buyTrades.length > 0 ? totalHoldingTime / buyTrades.length : 0;
    
    return {
      totalTrades,
      winningTrades: wins.length,
      losingTrades: losses.length,
      totalPnL,
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      avgHoldingTime,
      totalCommissions,
    };
  }
}


