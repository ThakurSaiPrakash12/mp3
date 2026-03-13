/**
 * forecastApi.ts — Demand forecast API calls.
 */

import { apiRequest } from './apiClient';

export interface ForecastData {
  product_id: number;
  product_name: string;
  current_stock: number;
  min_stock: number;
  lead_time: number;
  sales_3d: number;
  sales_7d: number;
  sales_30d: number;
  avg_daily_3d: number;
  avg_daily_7d: number;
  avg_daily_30d: number;
  sales_today?: number;
  sales_yesterday?: number;
  sales_two_days_ago?: number;
  forecast_daily: number;
  forecast_next_7_days: number;
  forecast_next_30_days: number;
  forecast_method?: string;
  trend: 'increasing' | 'stable' | 'decreasing';
  safety_stock: number;
  reorder_point: number;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK';
  reorder_required: boolean;
  days_until_stockout: number | null;
  stock_coverage_days: number | null;
  days_of_inventory?: number | null;
  forecast_timestamp: string;
}

export interface ForecastHistoryItem {
  date: string;
  quantity: number;
}

export interface ForecastHistoryResponse {
  product_id: number;
  product_name: string;
  days: number;
  history: ForecastHistoryItem[];
  total_sales: number;
}

export interface AllForecastsResponse {
  forecasts: ForecastData[];
  total_products: number;
  timestamp: string;
}

export interface CriticalAlertsResponse {
  critical_products: ForecastData[];
  total_critical: number;
  timestamp: string;
}

export const forecastApi = {
  getProductForecast: (productId: number) =>
    apiRequest<ForecastData>(`/forecast/${productId}`),

  getAllForecasts: () =>
    apiRequest<AllForecastsResponse>('/forecast'),

  getCriticalAlerts: () =>
    apiRequest<CriticalAlertsResponse>('/forecast/critical/alerts'),

  getForecastHistory: (productId: number, days = 30) =>
    apiRequest<ForecastHistoryResponse>(`/forecast/${productId}/history?days=${days}`),
};
