/**
 * salesApi.ts — Sales-related API calls.
 */

import { apiRequest } from './apiClient';
import { PaginationInfo } from './productApi';

export interface Sale {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  sale_date: string;
  created_at: string;
}

export interface SalesResponse {
  sales: Sale[];
  pagination: PaginationInfo;
  filters: {
    product_id?: number;
    start_date?: string;
    end_date?: string;
  };
}

export interface CreateSaleRequest {
  product_id: number;
  quantity: number;
}

export const salesApi = {
  getAll: (params: {
    page?: number;
    limit?: number;
    product_id?: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.product_id) searchParams.set('product_id', params.product_id.toString());
    if (params.start_date) searchParams.set('start_date', params.start_date);
    if (params.end_date) searchParams.set('end_date', params.end_date);
    return apiRequest<SalesResponse>(`/sales?${searchParams.toString()}`);
  },

  create: (sale: CreateSaleRequest) =>
    apiRequest<{ message: string; updated_stock: number }>('/sales', { method: 'POST', body: sale }),
};
