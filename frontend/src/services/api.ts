const API_BASE_URL = 'http://localhost:5000';

interface RequestOptions {
  method?: string;
  body?: unknown;
  requiresAuth?: boolean;
}

export interface ApiError {
  message: string;
  status: number;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, requiresAuth = true } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const error: ApiError = {
      message: response.statusText || 'Request failed',
      status: response.status,
    };
    throw error;
  }

  return response.json();
}

// Auth endpoints
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: 'admin' | 'read-only';
}

export const authApi = {
  login: (credentials: LoginRequest) =>
    apiRequest<LoginResponse>('/login', {
      method: 'POST',
      body: credentials,
      requiresAuth: false,
    }),
};

// Products endpoints
export interface Product {
  id: number;
  name: string;
  stock: number;
  min_stock: number;
  lead_time: number;
  created_at: string;
  updated_at: string;
  // Backend-calculated reorder status (single source of truth)
  status: 'OK' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK';
  reorder_required: boolean; // True only for CRITICAL or OUT_OF_STOCK
  reorder_level: number; // Demand-based reorder point
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

export interface CreateProductRequest {
  name: string;
  stock: number;
  min_stock: number;
  lead_time: number;
}

export const productsApi = {
  getAll: (page = 1, limit = 10, search = '') => {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    return apiRequest<ProductsResponse>(`/products?page=${page}&limit=${limit}${searchParam}`);
  },
  create: (product: CreateProductRequest) =>
    apiRequest<{ message: string }>('/products', {
      method: 'POST',
      body: product,
    }),
  reorderReset: (productId: number, newStock: number) =>
    apiRequest<{ message: string; previous_stock: number; current_stock: number }>(
      `/products/${productId}/reorder-reset`,
      {
        method: 'POST',
        body: { new_stock: newStock },
      }
    ),
  uploadCSV: async (file: File, mode: 'skip' | 'update_stock' = 'skip') => {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/products/upload-csv?mode=${mode}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = {
        message: response.statusText || 'Upload failed',
        status: response.status,
      };
      throw error;
    }

    return response.json();
  },
};

// Sales endpoints
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
    apiRequest<{ message: string; updated_stock: number }>('/sales', {
      method: 'POST',
      body: sale,
    }),
};

// Reorder endpoints
export interface ReorderStatus {
  stock: number;
  min_stock: number;
  average_daily_sales: number;
  lead_time: number;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK';
  reorder_required: boolean; // True only for CRITICAL or OUT_OF_STOCK
  reorder_level: number; // Demand-based reorder point
}

export const reorderApi = {
  check: (productId: number) =>
    apiRequest<ReorderStatus>(`/reorder-check/${productId}`),
};

// Dashboard endpoints
export interface DashboardData {
  summary: {
    total_products: number;
    total_sales_last_7_days: number;
    low_stock_items: number;
    reorder_required_items: number;
  };
  sales_trend: Array<{
    date: string;
    quantity: number;
  }>;
  stock_distribution: {
    well_stocked: number;
    reorder_required: number;
  };
  stock_levels: Array<{
    id: number;
    name: string;
    stock: number;
    min_stock: number;
    reorder_required: boolean;
  }>;
}

export const dashboardApi = {
  get: () => apiRequest<DashboardData>('/dashboard'),
};
