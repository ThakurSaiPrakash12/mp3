import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  analyticsApi,
  dashboardApi,
  DashboardData,
  ProfitAnalytics,
} from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatIndianCurrency } from '@/utils/currency';

function formatTooltipValue(value: number | string) {
  return typeof value === 'number' ? formatIndianCurrency(value) : value;
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [profitData, setProfitData] = useState<ProfitAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [dashboard, analytics] = await Promise.all([
        dashboardApi.get(),
        analyticsApi.getProfit(),
      ]);

      setDashboardData(dashboard);
      setProfitData(analytics);
    } catch (err) {
      setError('Failed to load dashboard data. Make sure the backend is running.');
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const { isConnected } = useWebSocket({
    onProductAdded: fetchDashboardData,
    onStockUpdated: fetchDashboardData,
    onSaleRecorded: fetchDashboardData,
    onProductsImported: fetchDashboardData,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !dashboardData || !profitData) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="mt-4 text-muted-foreground">{error || 'No data available'}</p>
          <Button onClick={fetchDashboardData} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { summary, sales_trend, stock_levels, reorder_attention } = dashboardData;
  const productsToReorder = (reorder_attention && reorder_attention.length > 0)
    ? reorder_attention
    : stock_levels.filter((product) => product.reorder_required);
  const coverageCandidates = stock_levels
    .map((item) => item.days_of_inventory)
    .filter((value): value is number => value !== null && value !== undefined);
  const shortestCoverageDays = coverageCandidates.length > 0
    ? Math.min(...coverageCandidates)
    : null;
  const reorderRecommendation = summary.reorder_required_items > 0
    ? 'Reorder recommended'
    : 'No reorder needed';
  const topProfitProducts = profitData.top_profitable_products.slice(0, 5);
  const hasRevenue = profitData.total_revenue > 0;
  const hasUrgentStockIssue = summary.reorder_required_items > 0;

  const managerHeadline = hasUrgentStockIssue
    ? `${summary.reorder_required_items} item(s) need reordering today.`
    : 'Stock levels look stable today.';

  const managerSubtext = hasRevenue
    ? 'Focus on the items that need action and keep sales moving.'
    : 'You have purchase activity recorded, but little or no sales revenue yet.';

  const profitMessage = !hasRevenue && profitData.total_cost > 0
    ? 'You have bought stock, but sales have not covered those costs yet.'
    : profitData.total_profit < 0
      ? 'Costs are currently higher than revenue. Record sales or review pricing.'
      : 'Revenue is covering costs. Keep monitoring margin and fast-moving items.';

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
              <Badge
                variant={isConnected ? 'default' : 'secondary'}
                className={cn(
                  'text-xs',
                  isConnected ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400'
                )}
              >
                {isConnected ? 'Live updates' : 'Offline'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              A simple daily view of stock health, sales movement, and profit status.
            </p>
          </div>

          <Button variant="outline" onClick={fetchDashboardData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card className={cn(hasUrgentStockIssue && 'border-red-200 bg-red-50/30')}>
            <CardHeader>
              <CardTitle>What needs attention today</CardTitle>
              <CardDescription>Start here before checking deeper reports.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className={cn('text-xl font-semibold', hasUrgentStockIssue ? 'text-red-700' : 'text-green-700')}>
                  {managerHeadline}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{managerSubtext}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Products in stock</p>
                  <p className="mt-1 text-2xl font-bold">{summary.total_products}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Units sold this week</p>
                  <p className="mt-1 text-2xl font-bold">{summary.total_sales_last_7_days}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Items to reorder now</p>
                  <p className={cn('mt-1 text-2xl font-bold', hasUrgentStockIssue ? 'text-red-600' : 'text-green-600')}>
                    {summary.reorder_required_items}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Stock coverage</p>
                  <p className="mt-1 text-lg font-semibold">
                    {shortestCoverageDays !== null
                      ? `Stock will last ${shortestCoverageDays.toFixed(1)} days`
                      : 'Stock coverage unavailable'}
                  </p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Reorder recommendation</p>
                  <p className={cn(
                    'mt-1 text-lg font-semibold',
                    hasUrgentStockIssue ? 'text-red-600' : 'text-green-700'
                  )}>
                    {reorderRecommendation}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>Common tasks for a manager.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild variant="outline" className="justify-between">
                <Link to="/sales/add">
                  Record sale
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link to="/purchase-orders">
                  Purchase orders
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link to="/suppliers">
                  Suppliers
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link to="/reorder">
                  Reorder list
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold">{summary.total_products}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Total products tracked</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sales This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold">{summary.total_sales_last_7_days}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Units sold in 7 days</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(hasUrgentStockIssue && 'border-red-200 bg-red-50/30')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={cn('text-3xl font-bold', hasUrgentStockIssue ? 'text-red-600' : 'text-green-600')}>
                    {summary.low_stock_items}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Low-stock products</p>
                </div>
                <AlertTriangle className={cn('h-8 w-8', hasUrgentStockIssue ? 'text-red-500' : 'text-green-500')} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(profitData.total_profit < 0 && 'border-amber-200 bg-amber-50/30')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profit So Far</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={cn('text-3xl font-bold', profitData.total_profit < 0 ? 'text-amber-700' : 'text-green-700')}>
                    {formatIndianCurrency(profitData.total_profit)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Revenue minus cost</p>
                </div>
                {profitData.total_profit < 0 ? (
                  <TrendingDown className="h-8 w-8 text-amber-600" />
                ) : (
                  <TrendingUp className="h-8 w-8 text-green-600" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Sales trend</CardTitle>
              <CardDescription>How many units were sold over the last 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sales_trend}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="quantity"
                      stroke="hsl(var(--primary))"
                      fill="url(#salesGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Money summary</CardTitle>
              <CardDescription>Simple explanation of revenue, cost, and profit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Money earned</p>
                  <p className="mt-1 text-2xl font-bold text-green-700">{formatIndianCurrency(profitData.total_revenue)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Money spent on stock</p>
                  <p className="mt-1 text-2xl font-bold text-blue-700">{formatIndianCurrency(profitData.total_cost)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Profit so far</p>
                  <p className={cn('mt-1 text-2xl font-bold', profitData.total_profit < 0 ? 'text-amber-700' : 'text-green-700')}>
                    {formatIndianCurrency(profitData.total_profit)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Profit margin</p>
                  <p className="mt-1 text-2xl font-bold text-purple-700">{profitData.profit_margin.toFixed(1)}%</p>
                </div>
              </div>

              <div className={cn(
                'rounded-lg border p-4 text-sm',
                profitData.total_profit < 0 ? 'border-amber-200 bg-amber-50/40 text-amber-900' : 'border-green-200 bg-green-50/40 text-green-900'
              )}>
                <p className="font-medium">Manager note</p>
                <p className="mt-1 text-sm">{profitMessage}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Products that need action</CardTitle>
              <CardDescription>Items already at or below their reorder point.</CardDescription>
            </CardHeader>
            <CardContent>
              {productsToReorder.length === 0 ? (
                <div className="rounded-lg border border-green-200 bg-green-50/40 p-4 text-sm text-green-900">
                  All products are currently above reorder level.
                </div>
              ) : (
                <div className="space-y-3">
                  {productsToReorder.slice(0, 5).map((product) => (
                    <div key={product.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Current stock: {product.stock} | Minimum needed: {product.min_stock}
                        </p>
                        {product.days_of_inventory !== null && product.days_of_inventory !== undefined && (
                          <p className="text-xs text-muted-foreground">
                            Stock will last {product.days_of_inventory.toFixed(1)} day(s)
                          </p>
                        )}
                      </div>
                      <Badge variant="destructive">Reorder</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top profit contributors</CardTitle>
              <CardDescription>The products adding the most profit.</CardDescription>
            </CardHeader>
            <CardContent>
              {topProfitProducts.length === 0 ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  No sales recorded yet. Record sales to see which products are most profitable.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProfitProducts}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          formatter={formatTooltipValue}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="profit" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2">
                    {topProfitProducts.map((product) => (
                      <div key={product.product_id} className="flex items-center justify-between text-sm">
                        <span className="truncate pr-3">{product.name}</span>
                        <span className="font-medium">{formatIndianCurrency(product.profit)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
