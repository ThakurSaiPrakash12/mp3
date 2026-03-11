import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Loader2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const COLORS = ['hsl(var(--success))', 'hsl(var(--destructive))'];

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // WebSocket for real-time updates
  const { isConnected } = useWebSocket({
    onProductAdded: () => fetchDashboardData(),
    onStockUpdated: () => fetchDashboardData(),
    onSaleRecorded: () => fetchDashboardData(),
    onProductsImported: () => fetchDashboardData(),
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await dashboardApi.get();
      setDashboardData(data);
    } catch (err) {
      setError('Failed to load dashboard data. Make sure the backend is running.');
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !dashboardData) {
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

  const { summary, sales_trend, stock_distribution, stock_levels } = dashboardData;

  const pieData = [
    { name: 'Well Stocked', value: stock_distribution.well_stocked },
    { name: 'Reorder Required', value: stock_distribution.reorder_required },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
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
              Overview of your inventory and sales performance
            </p>
          </div>
          <Button variant="outline" onClick={fetchDashboardData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Products
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_products}</div>
              <Link
                to="/products"
                className="mt-1 inline-flex items-center text-xs text-muted-foreground hover:text-primary"
              >
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sales
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_sales_last_7_days}</div>
              <Link
                to="/sales"
                className="mt-1 inline-flex items-center text-xs text-muted-foreground hover:text-primary"
              >
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className={summary.low_stock_items > 0 ? 'border-warning/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Stock Items
              </CardTitle>
              <AlertTriangle
                className={cn(
                  'h-4 w-4',
                  summary.low_stock_items > 0 ? 'text-warning' : 'text-muted-foreground'
                )}
              />
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', summary.low_stock_items > 0 && 'text-warning')}>
                {summary.low_stock_items}
              </div>
              <Link
                to="/reorder"
                className="mt-1 inline-flex items-center text-xs text-muted-foreground hover:text-primary"
              >
                Check reorder <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className={summary.reorder_required_items > 0 ? 'border-destructive/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reorder Required
              </CardTitle>
              <TrendingUp
                className={cn(
                  'h-4 w-4',
                  summary.reorder_required_items > 0 ? 'text-destructive' : 'text-muted-foreground'
                )}
              />
            </CardHeader>
            <CardContent>
              <div
                className={cn('text-2xl font-bold', summary.reorder_required_items > 0 && 'text-destructive')}
              >
                {summary.reorder_required_items}
              </div>
              {summary.reorder_required_items > 0 && (
                <Badge variant="destructive" className="mt-1">
                  Action needed
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sales Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
              <CardDescription>Quantity sold over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sales_trend}>
                    <defs>
                      <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
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
                      fillOpacity={1}
                      fill="url(#colorQuantity)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Stock Levels Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Levels</CardTitle>
              <CardDescription>Current stock vs minimum threshold</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stock_levels} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={80}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar
                      dataKey="stock"
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                      name="Current Stock"
                    />
                    <Bar
                      dataKey="minStock"
                      fill="hsl(var(--muted-foreground))"
                      radius={[0, 4, 4, 0]}
                      opacity={0.4}
                      name="Min Stock"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Stock Distribution Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Distribution</CardTitle>
              <CardDescription>Healthy vs low stock ratio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-success" />
                  <span className="text-sm text-muted-foreground">Well Stocked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-sm text-muted-foreground">Low Stock</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button asChild variant="outline" className="h-auto justify-start p-4">
                  <Link to="/products/add">
                    <Package className="mr-3 h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Add Product</div>
                      <div className="text-xs text-muted-foreground">
                        Add new items to inventory
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto justify-start p-4">
                  <Link to="/sales/add">
                    <ShoppingCart className="mr-3 h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Record Sale</div>
                      <div className="text-xs text-muted-foreground">
                        Log a new sale transaction
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto justify-start p-4">
                  <Link to="/reorder">
                    <AlertTriangle className="mr-3 h-5 w-5 text-warning" />
                    <div className="text-left">
                      <div className="font-medium">Check Reorder</div>
                      <div className="text-xs text-muted-foreground">
                        View items needing restock
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto justify-start p-4">
                  <Link to="/products">
                    <TrendingUp className="mr-3 h-5 w-5 text-success" />
                    <div className="text-left">
                      <div className="font-medium">View Inventory</div>
                      <div className="text-xs text-muted-foreground">
                        Browse all products
                      </div>
                    </div>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
