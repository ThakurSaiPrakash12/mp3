/**
 * ForecastPage.tsx — Orchestrates the Demand Forecast page.
 * Replaces the monolithic DemandForecast.tsx.
 */

import { useState, useEffect, useCallback } from 'react';
import { ForecastData, ForecastHistoryItem, forecastApi, productsApi, Product } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Activity, Loader2, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { toast } from 'sonner';
import { ForecastChart } from './ForecastChart';
import { ForecastMetrics } from './ForecastMetrics';

export default function ForecastPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [history, setHistory] = useState<ForecastHistoryItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { isConnected } = useWebSocket({
    onForecastUpdated: (data) => {
      if (data.product_id === selectedProductId) {
        toast.info('Forecast updated — refreshing data');
        fetchForecast(data.product_id);
      }
    },
    onSaleRecorded: (data) => {
      if (data.product_id === selectedProductId) fetchForecast(data.product_id);
    },
  });

  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const res = await productsApi.getAll(1, 100);
      setProducts(res.products);
      if (res.products.length > 0) {
        setSelectedProductId((prev) => prev ?? res.products[0].id);
      }
    } catch {
      toast.error('Failed to load products');
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const fetchForecast = useCallback(async (productId: number) => {
    setIsLoadingForecast(true);
    try {
      const data = await forecastApi.getProductForecast(productId);
      setForecast(data);
    } catch {
      toast.error('Failed to load forecast');
    } finally {
      setIsLoadingForecast(false);
    }
  }, []);

  const fetchHistory = useCallback(async (productId: number) => {
    try {
      const res = await forecastApi.getForecastHistory(productId, 30);
      setHistory(res.history);
    } catch {
      // non-critical; chart will show without history
    }
  }, []);

  useEffect(() => { void fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    if (selectedProductId) { void fetchForecast(selectedProductId); void fetchHistory(selectedProductId); }
  }, [selectedProductId, fetchForecast, fetchHistory]);

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Demand Forecast</h1>
              <Badge variant={isConnected ? 'default' : 'secondary'} className={cn('text-xs', isConnected ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400')}>
                <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', isConnected ? 'bg-white animate-pulse' : 'bg-gray-200')} />
                {isConnected ? 'Live' : 'Offline'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Real-time intelligent demand forecasting with trend analysis</p>
          </div>
          <Button variant="outline" onClick={() => selectedProductId && (fetchForecast(selectedProductId), fetchHistory(selectedProductId))} disabled={!selectedProductId}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
        </div>

        {/* Product Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Product</CardTitle>
            <CardDescription>Choose a product to view demand forecast</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="product-search">Search Product</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="product-search" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
              </div>
              <div className="flex-1">
                <Label htmlFor="product-select">Product</Label>
                <Select value={selectedProductId?.toString() || ''} onValueChange={(v) => setSelectedProductId(parseInt(v))} disabled={isLoadingProducts}>
                  <SelectTrigger id="product-select"><SelectValue placeholder="Select a product" /></SelectTrigger>
                  <SelectContent>
                    {filteredProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name} (Stock: {p.stock})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {isLoadingForecast && <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

        {/* Forecast Data */}
        {!isLoadingForecast && forecast && (
          <>
            <ForecastMetrics forecast={forecast} />
            <ForecastChart forecast={forecast} history={history} />
          </>
        )}

        {/* Empty */}
        {!isLoadingForecast && !forecast && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Select a product to view forecast</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
