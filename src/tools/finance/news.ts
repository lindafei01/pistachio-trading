import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { fetchYahooNewsRss } from './yahoo.js';

const NewsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch news for. For example, 'AAPL' for Apple."),
  start_date: z
    .string()
    .optional()
    .describe('The start date to fetch news from (YYYY-MM-DD).'),
  end_date: z.string().optional().describe('The end date to fetch news to (YYYY-MM-DD).'),
  limit: z
    .number()
    .default(10)
    .describe('The number of news articles to retrieve. Max is 100.'),
});

export const getNews = new DynamicStructuredTool({
  name: 'get_news',
  description: `Retrieves recent news articles for a given company ticker, covering financial announcements, market trends, and other significant events. Useful for staying up-to-date with market-moving information and investor sentiment.`,
  schema: NewsInputSchema,
  func: async (input) => {
    const hasPaidKey = Boolean(process.env.FINANCIAL_DATASETS_API_KEY);
    if (!hasPaidKey) {
      const { news, sourceUrl } = await fetchYahooNewsRss({
        ticker: input.ticker,
        limit: Math.min(100, Math.max(1, input.limit ?? 10)),
      });
      // Note: Yahoo RSS doesn't support start/end date filtering; we return latest items.
      return formatToolResult(news, [sourceUrl]);
    }

    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker,
      limit: input.limit,
      start_date: input.start_date,
      end_date: input.end_date,
    };
    const { data, url } = await callApi('/news/', params);
    return formatToolResult(data.news || [], [url]);
  },
});
