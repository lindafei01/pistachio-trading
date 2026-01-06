import type { MarketData } from '../types.js';

interface YahooChartResult {
  timestamp: number[];
  indicators: {
    quote: Array<{
      open: Array<number | null>;
      high: Array<number | null>;
      low: Array<number | null>;
      close: Array<number | null>;
      volume: Array<number | null>;
    }>;
  };
}

export async function fetchYahooHistoricalData(options: {
  ticker: string;
  range?: string; // 1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max
  interval?: string; // 1m,2m,5m,15m,30m,60m,90m,1h,1d,5d,1wk,1mo,3mo
}): Promise<MarketData[]> {
  const ticker = options.ticker.toUpperCase();
  const range = options.range ?? '3mo';
  const interval = options.interval ?? '1h';

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?` +
    `period1=0&period2=9999999999&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!resp.ok) {
    throw new Error(`Yahoo Finance chart fetch failed (${resp.status}): ${resp.statusText}`);
  }

  const json = await resp.json();
  const result: YahooChartResult | undefined = json?.chart?.result?.[0];
  if (!result || !Array.isArray(result.timestamp) || result.timestamp.length === 0) {
    throw new Error('Yahoo Finance chart returned no data');
  }

  const quotes = result.indicators?.quote?.[0];
  if (!quotes) {
    throw new Error('Yahoo Finance chart missing quote data');
  }

  const out: MarketData[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const ts = result.timestamp[i];
    const close = quotes.close?.[i];
    const open = quotes.open?.[i];
    const high = quotes.high?.[i];
    const low = quotes.low?.[i];
    const volume = quotes.volume?.[i];

    if (
      ts == null ||
      close == null ||
      open == null ||
      high == null ||
      low == null ||
      volume == null
    ) {
      continue;
    }
    if ([close, open, high, low, volume].some((v) => Number.isNaN(v))) continue;

    out.push({
      ticker,
      timestamp: ts * 1000,
      price: close,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  if (out.length === 0) {
    throw new Error('Yahoo Finance chart returned only invalid points');
  }

  return out;
}

export function timeframeToYahooInterval(timeframe: string | undefined): string {
  const tf = (timeframe ?? '').trim().toLowerCase();
  if (!tf) return '1h';

  // Common normalization
  if (tf === '1day' || tf === '1_day') return '1d';
  if (tf === '1h' || tf === '60m' || tf === '60min' || tf === 'hour' || tf === 'hourly') return '1h';
  if (tf === '30m' || tf === '30min') return '30m';
  if (tf === '15m' || tf === '15min') return '15m';
  if (tf === '5m' || tf === '5min') return '5m';
  if (tf === '1d' || tf === 'day' || tf === 'daily') return '1d';

  // Best effort: Yahoo accepts "60m" and "1h", but we'll keep simple.
  return '1h';
}


