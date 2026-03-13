/**
 * api.ts — Barrel re-export for backward compatibility.
 *
 * All code that previously imported from '@/services/api' continues to work.
 * New code should import directly from the specific module.
 */

export type { ApiError } from './apiClient';
export { apiRequest } from './apiClient';

// Product
export type { Product, PaginationInfo, ProductsResponse, CreateProductRequest } from './productApi';
export { productsApi } from './productApi';

// Sales
export type { Sale, SalesResponse, CreateSaleRequest } from './salesApi';
export { salesApi } from './salesApi';

// Forecast
export type {
  ForecastData,
  ForecastHistoryItem,
  ForecastHistoryResponse,
  AllForecastsResponse,
  CriticalAlertsResponse,
} from './forecastApi';
export { forecastApi } from './forecastApi';

// Supplier
export type { Supplier, SupplierPayload, SuppliersResponse } from './supplierApi';
export { suppliersApi } from './supplierApi';

// Purchase
export type {
  PurchaseOrderItemPayload,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrdersResponse,
  ProfitAnalytics,
} from './purchaseApi';
export { purchaseOrdersApi, analyticsApi } from './purchaseApi';

// ── Auth (kept inline — lightweight) ─────────────────────────────────────────
import { apiRequest as _apiRequest } from './apiClient';
import { type Product as _Product } from './productApi';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: string;
}

export const authApi = {
  login: (credentials: LoginRequest) =>
    _apiRequest<LoginResponse>('/login', {
      method: 'POST',
      body: credentials,
      requiresAuth: false,
    }),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardData {
  summary: {
    total_products: number;
    total_sales_last_7_days: number;
    low_stock_items: number;
    reorder_required_items: number;
  };
  sales_trend: Array<{ date: string; quantity: number }>;
  stock_distribution: { well_stocked: number; reorder_required: number };
  stock_levels: _Product[];
  reorder_attention: _Product[];
}

export const dashboardApi = {
  /** Canonical name */
  getData: () => _apiRequest<DashboardData>('/dashboard'),
  /** Alias kept for backward compatibility with Dashboard.tsx */
  get: () => _apiRequest<DashboardData>('/dashboard'),
};

// ── Reorder check ─────────────────────────────────────────────────────────────

export interface ReorderCheckResponse {
  stock: number;
  min_stock: number;
  reorder_required: boolean;
  reorder_level: number;
  forecast_daily: number;
  safety_stock: number;
  reorder_point: number;
  days_of_inventory: number | null;
}

export const reorderApi = {
  check: (productId: number) =>
    _apiRequest<ReorderCheckResponse>(`/reorder-check/${productId}`),
};
