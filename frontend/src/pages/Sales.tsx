import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sale, Product, PaginationInfo, salesApi, productsApi } from '@/services/api';
import { useAuth } from '@/auth/AuthProvider';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  ShoppingCart,
  Filter,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();

  // Filters
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // WebSocket for real-time updates
  const { isConnected } = useWebSocket({
    onSaleRecorded: () => fetchSales(),
    onProductAdded: () => fetchProducts(),
    onStockUpdated: () => fetchSales(),
  });

  const fetchProducts = useCallback(async () => {
    try {
      const response = await productsApi.getAll(1, 100);
      setProducts(response.products);
    } catch (err) {
      console.error('Products fetch error:', err);
    }
  }, []);

  const fetchSales = useCallback(async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await salesApi.getAll({
        page: currentPage,
        limit: 10,
        product_id: selectedProduct && selectedProduct !== 'all' ? parseInt(selectedProduct) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setSales(response.sales);
      setPagination(response.pagination);
    } catch (err) {
      setError('Failed to load sales. Make sure the backend is running.');
      console.error('Sales fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedProduct, startDate, endDate]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    void fetchSales();
  }, [fetchSales]);

  const clearFilters = () => {
    setSelectedProduct('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const hasActiveFilters = (selectedProduct && selectedProduct !== 'all') || startDate || endDate;

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
              <Badge 
                variant={isConnected ? "default" : "secondary"} 
                className={cn(
                  "text-xs",
                  isConnected ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"
                )}
              >
                <span className={cn(
                  "mr-1.5 h-1.5 w-1.5 rounded-full",
                  isConnected ? "bg-white animate-pulse" : "bg-gray-200"
                )} />
                {isConnected ? "Live" : "Offline"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              View and manage sales records
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'border-accent text-accent' : ''}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
                  !
                </span>
              )}
            </Button>
            {isAdmin && (
              <Button asChild>
                <Link to="/sales/add">
                  <Plus className="mr-2 h-4 w-4" />
                  Record Sale
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="animate-fade-in">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-full space-y-2 sm:w-48">
                  <Label>Product</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="All products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All products</SelectItem>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="mr-1 h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sales Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  {hasActiveFilters ? 'No sales match your filters' : 'No sales recorded yet'}
                </p>
                {isAdmin && !hasActiveFilters && (
                  <Button asChild className="mt-4">
                    <Link to="/sales/add">Record your first sale</Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Sale Date</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          #{sale.id}
                        </TableCell>
                        <TableCell className="font-medium">{sale.product_name}</TableCell>
                        <TableCell className="text-right">{sale.quantity}</TableCell>
                        <TableCell>{format(new Date(sale.sale_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(sale.created_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Showing {sales.length} of {pagination.total} sales
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                        disabled={currentPage === pagination.pages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
