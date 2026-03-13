/**
 * ProductsPage.tsx — Orchestrates product listing with real-time updates.
 * Replaces the monolithic Products.tsx.
 */

import { useState, useEffect, useCallback } from 'react';
import { Product, PaginationInfo, productsApi } from '@/services/api';
import { useAuth } from '@/auth/AuthProvider';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { toast } from 'sonner';
import { ProductFilters } from './ProductFilters';
import { ProductsTable } from './ProductsTable';
import { CsvUploadDialog, AddStockDialog } from './ProductForm';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const { isAdmin } = useAuth();

  const { isConnected } = useWebSocket({
    onProductAdded: (data) => { toast.success(`New product added: ${data.name}`); void fetchProducts(); },
    onStockUpdated: (data) => { toast.info(`Stock updated for product #${data.product_id}`); void fetchProducts(); },
    onSaleRecorded: (data) => { toast.info(`Sale recorded: ${data.quantity} units sold`); void fetchProducts(); },
    onProductsImported: (data) => { toast.success(`${data.count} products imported`); void fetchProducts(); },
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await productsApi.getAll(currentPage, 10, debouncedSearch);
      setProducts(res.products);
      setPagination(res.pagination);
    } catch {
      toast.error('Failed to load products. Make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => { void fetchProducts(); }, [fetchProducts]);

  const openAddStock = (product: Product) => { setSelectedProduct(product); setIsAddStockOpen(true); };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
              <Badge
                variant={isConnected ? 'default' : 'secondary'}
                className={cn('text-xs', isConnected ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400')}
              >
                <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', isConnected ? 'bg-white animate-pulse' : 'bg-gray-200')} />
                {isConnected ? 'Live' : 'Offline'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Manage your inventory and stock levels</p>
          </div>
        </div>

        {/* Filters */}
        <ProductFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isAdmin={isAdmin}
          onOpenUpload={() => setIsUploadOpen(true)}
        />

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{pagination?.total ?? '-'}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {products.filter((p) => p.status === 'CRITICAL' || p.status === 'OUT_OF_STOCK').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentPage} / {pagination?.pages ?? 1}</div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <ProductsTable
          products={products}
          pagination={pagination}
          currentPage={currentPage}
          isLoading={isLoading}
          isAdmin={isAdmin}
          onPageChange={setCurrentPage}
          onAddStock={openAddStock}
        />

        {/* Dialogs */}
        <CsvUploadDialog open={isUploadOpen} onOpenChange={setIsUploadOpen} onSuccess={fetchProducts} />
        <AddStockDialog
          open={isAddStockOpen}
          product={selectedProduct}
          onOpenChange={(v) => { setIsAddStockOpen(v); if (!v) setSelectedProduct(null); }}
          onSuccess={fetchProducts}
        />
      </div>
    </AppLayout>
  );
}
