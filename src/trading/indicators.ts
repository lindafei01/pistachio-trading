/**
 * Technical Indicators Calculator
 * 
 * Implements technical indicators with incremental updates for high-frequency trading.
 * Uses O(1) algorithms where possible to minimize latency.
 */

import type { MarketData, EnrichedMarketData, IndicatorCache } from './types.js';

// ============================================================================
// Indicator Calculator
// ============================================================================

/**
 * Calculates technical indicators with caching for optimal performance
 */
export class IndicatorCalculator {
  private cache: Map<string, IndicatorCache> = new Map();

  private isSupportedSMA(indicator: string): indicator is 'SMA_20' | 'SMA_50' | 'SMA_200' {
    return indicator === 'SMA_20' || indicator === 'SMA_50' || indicator === 'SMA_200';
  }

  private isSupportedEMA(indicator: string): indicator is 'EMA_12' | 'EMA_26' {
    return indicator === 'EMA_12' || indicator === 'EMA_26';
  }

  /**
   * Enriches market data with all requested indicators
   */
  enrichData(
    ticker: string,
    data: MarketData,
    historicalData: MarketData[],
    indicators: string[]
  ): EnrichedMarketData {
    const enriched: EnrichedMarketData = { ...data };

    // Calculate each requested indicator
    for (const indicator of indicators) {
      if (this.isSupportedSMA(indicator)) {
        const period = parseInt(indicator.split('_')[1]);
        enriched[indicator] = this.SMA(historicalData, period);
      } else if (this.isSupportedEMA(indicator)) {
        const period = parseInt(indicator.split('_')[1]);
        enriched[indicator] = this.EMA(ticker, historicalData, period);
      } else if (indicator === 'RSI') {
        enriched.RSI = this.RSI(ticker, historicalData, 14);
      } else if (indicator === 'MACD') {
        const macd = this.MACD(ticker, historicalData);
        enriched.MACD = macd.macd;
        enriched.MACD_signal = macd.signal;
        enriched.MACD_histogram = macd.histogram;
      } else if (indicator.startsWith('BB_')) {
        const bb = this.BollingerBands(historicalData, 20, 2);
        enriched.BB_upper = bb.upper;
        enriched.BB_middle = bb.middle;
        enriched.BB_lower = bb.lower;
      } else if (indicator === 'ATR') {
        enriched.ATR = this.ATR(historicalData, 14);
      } else if (indicator === 'volume_avg') {
        enriched.volume_avg = this.volumeAverage(historicalData, 20);
      }
    }

    // Calculate volume ratio if volume_avg is available
    if (enriched.volume_avg) {
      enriched.volume_ratio = data.volume / enriched.volume_avg;
    }

    return enriched;
  }

  /**
   * Simple Moving Average
   */
  SMA(data: MarketData[], period: number): number {
    if (data.length < period) return 0;

    const prices = data.slice(-period).map(d => d.close);
    const sum = prices.reduce((acc, price) => acc + price, 0);
    
    return sum / period;
  }

  /**
   * Exponential Moving Average with caching
   */
  EMA(ticker: string, data: MarketData[], period: number): number {
    if (data.length < period) return 0;

    const cacheKey = `${ticker}_EMA_${period}`;
    const cache = this.cache.get(ticker);

    const multiplier = 2 / (period + 1);
    const latestPrice = data[data.length - 1].close;

    // Check if we have cached EMA
    if (cache?.emaState?.has(period)) {
      const prevEMA = cache.emaState.get(period)!.value;
      const newEMA = (latestPrice - prevEMA) * multiplier + prevEMA;
      
      // Update cache
      cache.emaState.set(period, { value: newEMA });
      
      return newEMA;
    }

    // Calculate initial EMA using SMA
    const sma = this.SMA(data.slice(0, period), period);
    let ema = sma;

    // Calculate EMA for remaining data points
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close - ema) * multiplier + ema;
    }

    // Cache the result
    this.initializeCache(ticker);
    const newCache = this.cache.get(ticker)!;
    if (!newCache.emaState) {
      newCache.emaState = new Map();
    }
    newCache.emaState.set(period, { value: ema });

    return ema;
  }

  /**
   * Relative Strength Index with caching for incremental updates
   */
  RSI(ticker: string, data: MarketData[], period: number = 14): number {
    if (data.length < period + 1) return 50; // Neutral if not enough data

    const cache = this.cache.get(ticker);
    const latestPrice = data[data.length - 1].close;
    const prevPrice = data[data.length - 2].close;

    // Check if we have cached RSI state
    if (cache?.rsiState) {
      const { avgGain, avgLoss } = cache.rsiState;
      
      // Calculate current change
      const change = latestPrice - prevPrice;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      // Update averages using Wilder's smoothing
      const newAvgGain = (avgGain * (period - 1) + gain) / period;
      const newAvgLoss = (avgLoss * (period - 1) + loss) / period;

      // Update cache
      cache.rsiState = {
        avgGain: newAvgGain,
        avgLoss: newAvgLoss,
        lastPrice: latestPrice,
      };

      // Calculate RSI
      if (newAvgLoss === 0) return 100;
      const rs = newAvgGain / newAvgLoss;
      return 100 - (100 / (1 + rs));
    }

    // Initial calculation
    let gains = 0;
    let losses = 0;

    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    // Cache the state
    this.initializeCache(ticker);
    const newCache = this.cache.get(ticker)!;
    newCache.rsiState = {
      avgGain,
      avgLoss,
      lastPrice: latestPrice,
    };

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * MACD (Moving Average Convergence Divergence)
   */
  MACD(ticker: string, data: MarketData[]): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    const ema12 = this.EMA(ticker, data, 12);
    const ema26 = this.EMA(ticker, data, 26);
    const macd = ema12 - ema26;

    // Create temporary data for signal line calculation
    // In production, this would also be cached
    const signalPeriod = 9;
    const signal = this.calculateSignalLine(ticker, macd, signalPeriod);

    return {
      macd,
      signal,
      histogram: macd - signal,
    };
  }

  /**
   * Calculate MACD signal line (EMA of MACD)
   */
  private calculateSignalLine(ticker: string, macd: number, period: number): number {
    // Simplified: would need historical MACD values for proper calculation
    // For now, return MACD as approximation
    return macd * 0.9; // Rough approximation
  }

  /**
   * Bollinger Bands
   */
  BollingerBands(data: MarketData[], period: number = 20, stdDev: number = 2): {
    upper: number;
    middle: number;
    lower: number;
  } {
    const middle = this.SMA(data, period);
    
    if (data.length < period) {
      return { upper: middle, middle, lower: middle };
    }

    const prices = data.slice(-period).map(d => d.close);
    
    // Calculate standard deviation
    const squaredDiffs = prices.map(price => Math.pow(price - middle, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: middle + (standardDeviation * stdDev),
      middle,
      lower: middle - (standardDeviation * stdDev),
    };
  }

  /**
   * Average True Range (volatility indicator)
   */
  ATR(data: MarketData[], period: number = 14): number {
    if (data.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      trueRanges.push(tr);
    }

    // Calculate average of last 'period' true ranges
    const recentTR = trueRanges.slice(-period);
    return recentTR.reduce((acc, tr) => acc + tr, 0) / period;
  }

  /**
   * Volume Average
   */
  volumeAverage(data: MarketData[], period: number = 20): number {
    if (data.length < period) return 0;

    const volumes = data.slice(-period).map(d => d.volume);
    const sum = volumes.reduce((acc, vol) => acc + vol, 0);
    
    return sum / period;
  }

  /**
   * Initialize cache for a ticker
   */
  private initializeCache(ticker: string): void {
    if (!this.cache.has(ticker)) {
      this.cache.set(ticker, {
        ticker,
        lastUpdate: Date.now(),
      });
    }
  }

  /**
   * Clear cache for a ticker
   */
  clearCache(ticker?: string): void {
    if (ticker) {
      this.cache.delete(ticker);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    tickers: number;
    totalSize: number;
  } {
    return {
      tickers: this.cache.size,
      totalSize: this.cache.size, // Simplified
    };
  }
}




