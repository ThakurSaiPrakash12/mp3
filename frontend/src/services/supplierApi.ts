/**
 * supplierApi.ts — Supplier CRUD API calls.
 */

import { apiRequest } from './apiClient';

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string | null;
  products_supplied: number;
  product_names: string[];
}

export interface SupplierPayload {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface SuppliersResponse {
  suppliers: Supplier[];
  total: number;
}

export const suppliersApi = {
  getAll: () => apiRequest<SuppliersResponse>('/suppliers'),

  create: (supplier: SupplierPayload) =>
    apiRequest<Supplier>('/suppliers', { method: 'POST', body: supplier }),

  update: (supplierId: number, supplier: Partial<SupplierPayload>) =>
    apiRequest<Supplier>(`/suppliers/${supplierId}`, { method: 'PUT', body: supplier }),

  delete: (supplierId: number) =>
    apiRequest<{ message: string }>(`/suppliers/${supplierId}`, { method: 'DELETE' }),
};
