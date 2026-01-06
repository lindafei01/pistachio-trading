import { StructuredToolInterface } from '@langchain/core/tools';
import {
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  getFilings,
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
  getPriceSnapshot,
  getPrices,
  getFinancialMetricsSnapshot,
  getFinancialMetrics,
  getNews,
  getAnalystEstimates,
  getSegmentedRevenues,
  getCryptoPriceSnapshot,
  getCryptoPrices,
  getCryptoTickers,
  getInsiderTrades,
} from './finance/index.js';

// Note: Tavily search is not included by default to avoid requiring TAVILY_API_KEY
// To enable web search, set TAVILY_API_KEY environment variable and manually import tavilySearch

export const TOOLS: StructuredToolInterface[] = [
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
  getFilings,
  getPriceSnapshot,
  getPrices,
  getCryptoPriceSnapshot,
  getCryptoPrices,
  getCryptoTickers,
  getFinancialMetricsSnapshot,
  getFinancialMetrics,
  getNews,
  getAnalystEstimates,
  getSegmentedRevenues,
  getInsiderTrades,
  // Tavily search removed to make it optional
];

export {
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  getFilings,
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
  getPriceSnapshot,
  getPrices,
  getCryptoPriceSnapshot,
  getCryptoPrices,
  getCryptoTickers,
  getFinancialMetricsSnapshot,
  getFinancialMetrics,
  getNews,
  getAnalystEstimates,
  getSegmentedRevenues,
  getInsiderTrades,
};

// Tavily search is optional - import separately if needed:
// import { tavilySearch } from './tools/search/index.js';
