function toEpochSeconds(dateStr: string): number {
  // Interpret as UTC midnight to avoid local timezone shifts.
  const d = new Date(`${dateStr}T00:00:00Z`);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return Math.floor(ms / 1000);
}

export function mapPricesIntervalToYahoo(interval: string, multiplier: number): string {
  const m = multiplier || 1;
  // Yahoo supports: 1m,2m,5m,15m,30m,60m,90m,1h,1d,5d,1wk,1mo,3mo
  if (interval === 'minute') {
    if (m === 1) return '1m';
    if (m === 2) return '2m';
    if (m === 5) return '5m';
    if (m === 15) return '15m';
    if (m === 30) return '30m';
    if (m === 60) return '60m';
    return '60m';
  }
  if (interval === 'day') return m === 5 ? '5d' : '1d';
  if (interval === 'week') return '1wk';
  if (interval === 'month') return '1mo';
  if (interval === 'year') return '1mo';
  return '1d';
}

export async function fetchYahooPrices(params: {
  ticker: string;
  start_date: string;
  end_date: string;
  interval: string;
  interval_multiplier: number;
}): Promise<{ prices: Array<Record<string, unknown>>; sourceUrl: string }> {
  const ticker = params.ticker.toUpperCase();
  const interval = mapPricesIntervalToYahoo(params.interval, params.interval_multiplier);
  const period1 = toEpochSeconds(params.start_date);
  const period2 = toEpochSeconds(params.end_date);

  const sourceUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?` +
    `period1=${period1}&period2=${period2}&interval=${encodeURIComponent(interval)}`;

  const resp = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!resp.ok) {
    throw new Error(`Yahoo price request failed: ${resp.status} ${resp.statusText}`);
  }

  const json = await resp.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] | undefined = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];

  if (!result || !Array.isArray(ts) || !quote) {
    throw new Error('Yahoo price response missing expected fields');
  }

  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < ts.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];
    if (
      ts[i] == null ||
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      volume == null
    ) {
      continue;
    }
    out.push({
      ticker,
      timestamp: ts[i] * 1000,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return { prices: out, sourceUrl };
}

export async function fetchYahooNewsRss(params: {
  ticker: string;
  limit: number;
}): Promise<{ news: Array<Record<string, unknown>>; sourceUrl: string }> {
  const ticker = params.ticker.toUpperCase();
  // Yahoo Finance RSS feed for headlines
  const sourceUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`;

  const resp = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!resp.ok) {
    throw new Error(`Yahoo news RSS request failed: ${resp.status} ${resp.statusText}`);
  }

  const xml = await resp.text();

  // Very small RSS parser (no external deps): extract <item> blocks and a few fields.
  const items = xml.split(/<item>/g).slice(1);
  const out: Array<Record<string, unknown>> = [];

  for (const raw of items) {
    if (out.length >= params.limit) break;
    const itemXml = raw.split(/<\/item>/g)[0] || '';

    const getTag = (tag: string): string | null => {
      const m = itemXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : null;
    };

    const title = getTag('title');
    const link = getTag('link');
    const pubDate = getTag('pubDate');
    const description = getTag('description');

    out.push({
      ticker,
      title,
      url: link,
      published_at: pubDate,
      summary: description,
      source: 'Yahoo Finance RSS',
    });
  }

  return { news: out, sourceUrl };
}


