/**
 * productApi.ts — Product-related API calls.
 */

import { apiRequest, API_BASE_URL, ApiError } from './apiClient';

export interface Product {
  id: number;
  name: string;
  stock: number;
  min_stock: number;
  lead_time: number;
  supplier_id?: number | null;
  cost_price?: number | null;
  selling_price?: number | null;
  created_at: string;
  updated_at: string;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK';
  reorder_required: boolean;
  reorder_level: number;
  forecast_daily?: number;
  safety_stock?: number;
  reorder_point?: number;
  days_of_inventory?: number | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ProductsResponse {
  products: Product[];
  pagination: PaginationInfo;
}

export interface ReorderProductsResponse {
  products: Product[];
}

export interface CreateProductRequest {
  name: string;
  stock: number;
  min_stock: number;
  lead_time: number;
  supplier_id?: number | null;
  cost_price?: number | null;
  selling_price?: number | null;
}

export const productsApi = {
  getAll: (page = 1, limit = 10, search = '') => {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    return apiRequest<ProductsResponse>(`/products?page=${page}&limit=${limit}${searchParam}`);
  },

  create: (product: CreateProductRequest) =>
    apiRequest<{ message: string }>('/products', { method: 'POST', body: product }),

  reorderReset: (productId: number, newStock: number) =>
    apiRequest<{ message: string; previous_stock: number; current_stock: number }>(
      `/products/${productId}/reorder-reset`,
      { method: 'POST', body: { new_stock: newStock } }
    ),

  uploadCSV: async (file: File, mode: 'skip' | 'update_stock' = 'skip') => {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/products/upload-csv?mode=${mode}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      let message = response.statusText || 'Upload failed';
      try {
        const json = await response.json();
        if (json?.detail) {
          message = typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail);
        }
      } catch {
        // ignore parse errors
      }
      const error: ApiError = { message, status: response.status };
      throw error;
    }

    return response.json();
  },

  getReorderData: () => apiRequest<ReorderProductsResponse>('/products/reorder-data'),
};
