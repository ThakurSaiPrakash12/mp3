/**
 * purchaseApi.ts — Purchase orders + analytics API calls.
 */

import { apiRequest } from './apiClient';

export interface PurchaseOrderItemPayload {
  product_id: number;
  quantity: number;
  cost_price: number;
}

export interface PurchaseOrder {
  id: number;
  supplier_id: number;
  supplier_name: string;
  status: 'PENDING' | 'APPROVED' | 'DELIVERED' | 'CANCELLED';
  created_at: string;
  item_count: number;
  total_quantity: number;
  total_cost: number;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: Array<{
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    cost_price: number;
    line_total: number;
  }>;
}

export interface PurchaseOrdersResponse {
  purchase_orders: PurchaseOrder[];
  total: number;
}

export interface ProfitAnalytics {
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  profit_margin: number;
  monthly_profit: Array<{ month: string; revenue: number; cost: number; profit: number }>;
  top_profitable_products: Array<{
    product_id: number;
    name: string;
    quantity_sold: number;
    revenue: number;
    profit: number;
  }>;
}

export const purchaseOrdersApi = {
  getAll: () => apiRequest<PurchaseOrdersResponse>('/purchase-orders'),

  getById: (orderId: number) => apiRequest<PurchaseOrderDetail>(`/purchase-orders/${orderId}`),

  create: (order: { supplier_id: number; items: PurchaseOrderItemPayload[] }) =>
    apiRequest<{ id: number; supplier_id: number; supplier_name: string; status: string; created_at: string }>(
      '/purchase-orders',
      { method: 'POST', body: order }
    ),

  updateStatus: (orderId: number, statusValue: PurchaseOrder['status']) =>
    apiRequest<{
      id: number;
      supplier_id: number;
      status: string;
      created_at: string;
      stock_updates: Array<{ product_id: number; previous_stock: number; quantity_added: number; new_stock: number }>;
    }>(`/purchase-orders/${orderId}/status`, { method: 'PUT', body: { status: statusValue } }),
};

export const analyticsApi = {
  getProfit: () => apiRequest<ProfitAnalytics>('/analytics/profit'),
};
