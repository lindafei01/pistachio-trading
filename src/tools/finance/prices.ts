import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { fetchYahooPrices } from './yahoo.js';

const PriceSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch the price snapshot for. For example, 'AAPL' for Apple."
    ),
});

export const getPriceSnapshot = new DynamicStructuredTool({
  name: 'get_price_snapshot',
  description: `Fetches the most recent price snapshot for a specific stock ticker, including the latest price, transaction volume, and other open, high, low, and close price data.`,
  schema: PriceSnapshotInputSchema,
  func: async (input) => {
    const params = { ticker: input.ticker };
    const { data, url } = await callApi('/prices/snapshot/', params);
    return formatToolResult(data.snapshot || {}, [url]);
  },
});

const PricesInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch aggregated prices for. For example, 'AAPL' for Apple."
    ),
  interval: z
    .enum(['minute', 'day', 'week', 'month', 'year'])
    .default('day')
    .describe("The time interval for price data. Defaults to 'day'."),
  interval_multiplier: z
    .number()
    .default(1)
    .describe('Multiplier for the interval. Defaults to 1.'),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Must be in past. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Must be today or in the past. Required.'),
});

export const getPrices = new DynamicStructuredTool({
  name: 'get_prices',
  description: `Retrieves historical price data for a stock over a specified date range, including open, high, low, close prices, and volume. 
IMPORTANT: end_date must be >= start_date. For minute-level data, date range must be <= 7 days. For longer periods, use 'day' interval.`,
  schema: PricesInputSchema,
  func: async (input) => {
    // Validate dates
    const startDate = new Date(input.start_date);
    const endDate = new Date(input.end_date);
    const now = new Date();
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error(`Invalid date format. Use YYYY-MM-DD. Got start_date=${input.start_date}, end_date=${input.end_date}`);
    }
    
    if (endDate < startDate) {
      throw new Error(`end_date (${input.end_date}) must be >= start_date (${input.start_date})`);
    }
    
    if (startDate > now || endDate > now) {
      throw new Error(`Dates must be in the past. Got start_date=${input.start_date}, end_date=${input.end_date}`);
    }
    
    // Validate data range for minute-level data
    if (input.interval === 'minute') {
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 7) {
        throw new Error(`For minute-level data, date range must be <= 7 days. Got ${daysDiff.toFixed(1)} days. Use 'day' interval instead.`);
      }
    }
    
    const hasPaidKey = Boolean(process.env.FINANCIAL_DATASETS_API_KEY);

    if (!hasPaidKey) {
      const { prices, sourceUrl } = await fetchYahooPrices({
        ticker: input.ticker,
        interval: input.interval,
        interval_multiplier: input.interval_multiplier,
        start_date: input.start_date,
        end_date: input.end_date,
      });
      return formatToolResult(prices, [sourceUrl]);
    }

    const params = {
      ticker: input.ticker,
      interval: input.interval,
      interval_multiplier: input.interval_multiplier,
      start_date: input.start_date,
      end_date: input.end_date,
    };
    const { data, url } = await callApi('/prices/', params);
    return formatToolResult(data.prices || [], [url]);
  },
});

