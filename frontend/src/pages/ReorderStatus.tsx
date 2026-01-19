import { useState, useEffect } from 'react';
import { Product, ReorderStatus as ReorderStatusType, productsApi, reorderApi } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  RefreshCw,
  Package,
  TrendingDown,
  Clock
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface ProductReorderInfo {
  product: Product;
  reorderStatus: ReorderStatusType | null;
  isLoading: boolean;
  error: boolean;
}

export default function ReorderStatus() {
  const [productData, setProductData] = useState<ProductReorderInfo[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    
    try {
      const response = await productsApi.getAll(1, 100);
      
      // Initialize with loading states
      const initialData: ProductReorderInfo[] = response.products.map((product) => ({
        product,
        reorderStatus: null,
        isLoading: true,
        error: false,
      }));
      setProductData(initialData);
      setIsLoadingProducts(false);
      
      // Fetch reorder status for each product
      for (const product of response.products) {
        try {
          const reorderStatus = await reorderApi.check(product.id);
          setProductData((prev) =>
            prev.map((item) =>
              item.product.id === product.id
                ? { ...item, reorderStatus, isLoading: false }
                : item
            )
          );
        } catch {
          setProductData((prev) =>
            prev.map((item) =>
              item.product.id === product.id
                ? { ...item, isLoading: false, error: true }
                : item
            )
          );
        }
      }
    } catch (err) {
      console.error('Products fetch error:', err);
      setIsLoadingProducts(false);
    }
  };

  const refreshAll = () => {
    fetchProducts();
  };

  const requiresReorder = productData.filter(
    (item) => item.reorderStatus?.reorder_required
  );
  const inStock = productData.filter(
    (item) => item.reorderStatus && !item.reorderStatus.reorder_required
  );

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reorder Status</h1>
            <p className="text-sm text-muted-foreground">
              Monitor stock levels and reorder requirements
            </p>
          </div>
          <Button variant="outline" onClick={refreshAll} disabled={isLoadingProducts}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh All
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Products
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{productData.length}</div>
            </CardContent>
          </Card>
          <Card className={requiresReorder.length > 0 ? 'border-destructive/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Needs Reorder
              </CardTitle>
              <AlertTriangle className={cn(
                "h-4 w-4",
                requiresReorder.length > 0 ? "text-destructive" : "text-muted-foreground"
              )} />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                requiresReorder.length > 0 && "text-destructive"
              )}>
                {requiresReorder.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Well Stocked
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{inStock.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {isLoadingProducts && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Reorder Required Section */}
        {!isLoadingProducts && requiresReorder.length > 0 && (
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reorder Required
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {requiresReorder.map((item) => (
                <ReorderCard key={item.product.id} data={item} />
              ))}
            </div>
          </div>
        )}

        {/* Well Stocked Section */}
        {!isLoadingProducts && inStock.length > 0 && (
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-success">
              <CheckCircle2 className="h-5 w-5" />
              Well Stocked
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inStock.map((item) => (
                <ReorderCard key={item.product.id} data={item} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingProducts && productData.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No products to check</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function ReorderCard({ data }: { data: ProductReorderInfo }) {
  const { product, reorderStatus, isLoading, error } = data;
  const needsReorder = reorderStatus?.reorder_required;

  return (
    <Card className={cn(
      "transition-colors",
      needsReorder && "border-destructive/50 bg-destructive/5"
    )}>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-destructive">Failed to load status</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium leading-tight">{product.name}</h3>
              <Badge variant={needsReorder ? 'destructive' : 'secondary'}>
                {needsReorder ? 'Reorder' : 'OK'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Stock</p>
                  <p className={cn(
                    "font-medium",
                    needsReorder && "text-destructive"
                  )}>
                    {reorderStatus?.current_stock ?? product.stock}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Avg Daily Sales</p>
                  <p className="font-medium">
                    {reorderStatus?.average_daily_sales.toFixed(1) ?? '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Lead time:</span>
              <span className="font-medium">{product.lead_time} days</span>
            </div>

            {needsReorder && reorderStatus && reorderStatus.average_daily_sales > 0 && (
              <div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                Stock will run out in ~{Math.floor(reorderStatus.current_stock / reorderStatus.average_daily_sales)} days
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
