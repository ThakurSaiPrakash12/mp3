import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Product, PaginationInfo, productsApi } from '@/services/api';
import { useAuth } from '@/auth/AuthProvider';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Package, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  Loader2,
  Upload,
  Search,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { toast } from 'sonner';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // CSV Upload state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Reorder Reset state
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newStockValue, setNewStockValue] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // WebSocket for real-time updates
  const { isConnected, connectionStatus } = useWebSocket({
    onProductAdded: (data) => {
      console.log('🆕 Product added:', data);
      toast.success(`New product added: ${data.name}`);
      fetchProducts(); // Refresh list
    },
    onStockUpdated: (data) => {
      console.log('📦 Stock updated:', data);
      toast.info(`Stock updated for product #${data.product_id}`);
      fetchProducts(); // Refresh list
    },
    onSaleRecorded: (data) => {
      console.log('💰 Sale recorded:', data);
      toast.info(`Sale recorded: ${data.quantity} units sold`);
      fetchProducts(); // Refresh list
    },
    onProductsImported: (data) => {
      console.log('📥 Products imported:', data);
      toast.success(`${data.count} products imported`);
      fetchProducts(); // Refresh list
    },
    onConnected: () => {
      console.log('🔗 Real-time updates connected');
    },
    onDisconnected: () => {
      console.log('🔌 Real-time updates disconnected');
    }
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchProducts();
  }, [currentPage, debouncedSearch]);

  const fetchProducts = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await productsApi.getAll(currentPage, 10, debouncedSearch);
      setProducts(response.products);
      setPagination(response.pagination);
    } catch (err) {
      setError('Failed to load products. Make sure the backend is running.');
      console.error('Products fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadCSV = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setIsUploading(true);

    try {
      const result = await productsApi.uploadCSV(selectedFile);
      
      // Show success message
      if (result.inserted > 0) {
        toast.success(`Successfully uploaded ${result.inserted} product(s)`);
      }
      
      if (result.skipped > 0) {
        toast.info(`Skipped ${result.skipped} duplicate product(s)`);
      }
      
      if (result.updated > 0) {
        toast.success(`Updated ${result.updated} existing product(s)`);
      }

      // Show errors if any
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((error: { row: number; error: string }) => {
          toast.error(`Row ${error.row}: ${error.error}`);
        });
      }

      // Reset dialog state
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      
      // Refresh products list
      await fetchProducts();
      
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload CSV file');
      console.error('CSV upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetStock = async () => {
    if (!selectedProduct || !newStockValue) {
      toast.error('Please enter a valid stock quantity');
      return;
    }

    const stockNum = parseInt(newStockValue, 10);
    if (isNaN(stockNum) || stockNum <= 0) {
      toast.error('Stock must be a positive number');
      return;
    }

    setIsResetting(true);

    try {
      const result = await productsApi.reorderReset(selectedProduct.id, stockNum);
      toast.success(
        `Stock added: ${result.previous_stock} + ${stockNum} = ${result.current_stock}`
      );
      
      // Reset dialog state
      setIsResetDialogOpen(false);
      setSelectedProduct(null);
      setNewStockValue('');
      
      // Refresh products list
      await fetchProducts();
      
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reset stock');
      console.error('Stock reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const openResetDialog = (product: Product) => {
    setSelectedProduct(product);
    setNewStockValue('');
    setIsResetDialogOpen(true);
  };

  // REMOVED: Frontend reorder calculation - Backend is single source of truth
  // All reorder logic now comes from product.reorder_required and product.reorder_reason

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
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
              Manage your inventory and stock levels
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsUploadDialogOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV
              </Button>
              <Button asChild>
                <Link to="/products/add">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Products
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pagination?.total ?? '-'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Stock Items
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {products.filter(p => p.status === 'CRITICAL' || p.status === 'OUT_OF_STOCK').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentPage} / {pagination?.pages ?? 1}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No products found</p>
                {isAdmin && (
                  <Button asChild className="mt-4">
                    <Link to="/products/add">Add your first product</Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Min Stock</TableHead>
                      <TableHead className="text-right">Lead Time</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className={cn(
                          "text-right",
                          product.reorder_required && "text-destructive font-medium"
                        )}>
                          {product.stock}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {product.min_stock}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {product.lead_time} days
                        </TableCell>
                        <TableCell>
                          {product.status === 'OUT_OF_STOCK' ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Out of Stock
                            </Badge>
                          ) : product.status === 'CRITICAL' ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Critical
                            </Badge>
                          ) : product.status === 'LOW' ? (
                            <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {(product.status === 'CRITICAL' || product.status === 'OUT_OF_STOCK') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openResetDialog(product)}
                              >
                                <RefreshCw className="mr-2 h-3 w-3" />
                                Add Stock
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Showing {products.length} of {pagination.total} products
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

      {/* CSV Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Products CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import products. The CSV must have headers: name, stock, min_stock, lead_time
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isUploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  file:cursor-pointer cursor-pointer"
              />
            </div>
            
            {selectedFile && (
              <div className="text-sm text-muted-foreground">
                Selected: {selectedFile.name}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadDialogOpen(false);
                setSelectedFile(null);
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUploadCSV} 
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reorder Reset Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock - Reorder Replenishment</DialogTitle>
            <DialogDescription>
              {selectedProduct && (
                <>
                  Add stock to <strong>{selectedProduct.name}</strong>. Current stock: {selectedProduct.stock}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-stock">Quantity to Add</Label>
              <Input
                id="new-stock"
                type="number"
                min="1"
                placeholder="Enter quantity to add to current stock"
                value={newStockValue}
                onChange={(e) => setNewStockValue(e.target.value)}
                disabled={isResetting}
                className="mt-2"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                This will ADD to the current stock (not replace it).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsResetDialogOpen(false);
                setSelectedProduct(null);
                setNewStockValue('');
              }}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResetStock} 
              disabled={!newStockValue || isResetting}
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Stock...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Add Stock
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
