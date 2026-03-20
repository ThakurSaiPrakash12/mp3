import { useState, useEffect, useMemo } from 'react';
import { Product, productsApi } from '@/services/api';
import { List, RowComponentProps } from 'react-window';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Package,
  TrendingDown,
  Clock
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface ProductReorderInfo {
  product: Product;
}

export default function ReorderStatus() {
  const [productData, setProductData] = useState<ProductReorderInfo[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const VIRTUALIZATION_THRESHOLD = 120;
  const VIRTUAL_LIST_MAX_HEIGHT = 620;
  const VIRTUAL_ROW_HEIGHT = 190;

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    
    try {
      const response = await productsApi.getReorderData();
      const allProducts: Product[] = response.products;

      const finalData: ProductReorderInfo[] = allProducts.map((product) => ({
        product,
      }));
      setProductData(finalData);
      setIsLoadingProducts(false);
    } catch (err) {
      console.error('Products fetch error:', err);
      setIsLoadingProducts(false);
    }
  };

  const refreshAll = () => {
    fetchProducts();
  };

  const statusGroups = useMemo(() => ({
    OUT_OF_STOCK: productData.filter(i => i.product.status === 'OUT_OF_STOCK'),
    CRITICAL: productData.filter(i => i.product.status === 'CRITICAL'),
    LOW: productData.filter(i => i.product.status === 'LOW'),
    OK: productData.filter(i => i.product.status === 'OK')
  }), [productData]);
  
  const requiresReorder = [...statusGroups.OUT_OF_STOCK, ...statusGroups.CRITICAL];

  // Section configuration
  const sections = [
    { key: 'OUT_OF_STOCK', title: 'Out of Stock', icon: AlertTriangle, color: 'text-destructive' },
    { key: 'CRITICAL', title: 'Critical', icon: AlertTriangle, color: 'text-destructive' },
    { key: 'LOW', title: 'Low Stock', icon: TrendingDown, color: 'text-yellow-600' },
    { key: 'OK', title: 'Well Stocked', icon: CheckCircle2, color: 'text-success' }
  ] as const;

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
              <div className="text-2xl font-bold text-success">{statusGroups.OK.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Status Sections */}
        {!isLoadingProducts && sections.map(({ key, title, icon: Icon, color }) => {
          const items = statusGroups[key];
          return items.length > 0 ? (
            <div key={key} className="space-y-3">
              <h2 className={cn("flex items-center gap-2 text-lg font-semibold", color)}>
                <Icon className="h-5 w-5" />
                {title} ({items.length})
              </h2>
              {items.length >= VIRTUALIZATION_THRESHOLD ? (
                <Card>
                  <CardContent className="p-3">
                    <List
                      rowComponent={VirtualizedRow}
                      rowCount={items.length}
                      rowHeight={VIRTUAL_ROW_HEIGHT}
                      rowProps={{ items }}
                      overscanCount={8}
                      style={{ height: Math.min(VIRTUAL_LIST_MAX_HEIGHT, items.length * VIRTUAL_ROW_HEIGHT) }}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <ReorderCard key={item.product.id} data={item} />
                  ))}
                </div>
              )}
            </div>
          ) : null;
        })}

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

function VirtualizedRow({ index, style, items }: RowComponentProps<{ items: ProductReorderInfo[] }>) {
  const item = items[index];

  return (
    <div style={style} className="px-1 py-2">
      <ReorderCard data={item} />
    </div>
  );
}

function ReorderCard({ data }: { data: ProductReorderInfo }) {
  const { product } = data;
  const status = product.status;
  const needsReorder = status === 'CRITICAL' || status === 'OUT_OF_STOCK';

  const getBadgeProps = () => {
    const configs = {
      OUT_OF_STOCK: { variant: 'destructive' as const, label: 'Out of Stock', className: '' },
      CRITICAL: { variant: 'destructive' as const, label: 'Critical', className: '' },
      LOW: { variant: 'default' as const, label: 'Low', className: 'bg-yellow-500 hover:bg-yellow-600' },
      OK: { variant: 'secondary' as const, label: 'OK', className: '' }
    };
    return configs[status || 'OK'];
  };

  return (
    <Card className={cn(
      "transition-colors",
      status === 'OUT_OF_STOCK' && "border-destructive bg-destructive/10",
      needsReorder && status !== 'OUT_OF_STOCK' && "border-destructive/50 bg-destructive/5"
    )}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium leading-tight">{product.name}</h3>
            <Badge {...getBadgeProps()} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Stock</p>
                <p className={cn("font-medium", needsReorder && "text-destructive")}>
                  {product.stock}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Forecast Daily</p>
                <p className="font-medium">
                  {product.forecast_daily !== undefined ? product.forecast_daily.toFixed(1) : '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Lead time:</span>
            <span className="font-medium">{product.lead_time} days</span>
          </div>

          {needsReorder && product.days_of_inventory !== null && product.days_of_inventory !== undefined && (
            <div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              Stock will last ~{product.days_of_inventory.toFixed(1)} days
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
