/**
 * ForecastMetrics.tsx — KPI cards + insights + detailed metrics table.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Activity, Calendar, Clock, Package, Info,
} from 'lucide-react';
import { ForecastData } from '@/services/api';
import { cn } from '@/utils/cn';

// ── Helpers ───────────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'increasing') return <TrendingUp className="h-5 w-5 text-green-500" />;
  if (trend === 'decreasing') return <TrendingDown className="h-5 w-5 text-red-500" />;
  return <Minus className="h-5 w-5 text-gray-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'destructive' | 'default'; label: string; icon: typeof AlertTriangle }> = {
    OUT_OF_STOCK: { variant: 'destructive', label: 'Out of Stock', icon: AlertTriangle },
    CRITICAL: { variant: 'destructive', label: 'Critical', icon: AlertTriangle },
    LOW: { variant: 'default', label: 'Low Stock', icon: Activity },
    OK: { variant: 'default', label: 'Healthy', icon: CheckCircle2 },
  };
  const cfg = config[status] ?? config.OK;
  const Icon = cfg.icon;
  return (
    <Badge
      variant={cfg.variant}
      className={cn('flex items-center gap-1',
        status === 'OK' && 'bg-green-500 hover:bg-green-600',
        status === 'LOW' && 'bg-yellow-500 hover:bg-yellow-600'
      )}
    >
      <Icon className="h-3 w-3" />{cfg.label}
    </Badge>
  );
}

function generateInsights(f: ForecastData): string[] {
  const insights: string[] = [];
  if (f.trend === 'increasing') insights.push('📈 Demand is increasing — consider increasing reorder quantity');
  else if (f.trend === 'decreasing') insights.push('📉 Demand is decreasing — monitor for overstocking');
  if (f.days_until_stockout !== null) {
    if (f.days_until_stockout === 0) insights.push('🚨 Out of stock — immediate reorder required!');
    else if (f.days_until_stockout <= 7) insights.push(`⚠️ Stock will run out in ~${f.days_until_stockout} days`);
    else insights.push(`✅ Current stock sufficient for ${f.days_until_stockout} days`);
  }
  if (f.reorder_required) insights.push('🔔 Reorder point reached — place order now');
  if (f.current_stock > f.safety_stock * 2) insights.push('💰 Stock levels healthy — well above safety threshold');
  return insights;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ForecastMetrics({ forecast }: { forecast: ForecastData }) {
  return (
    <>
      {/* KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{forecast.current_stock}</div>
            <p className="text-xs text-muted-foreground mt-1">Min Stock: {forecast.min_stock}</p>
            <StatusBadge status={forecast.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Forecast</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{forecast.forecast_daily}</div>
            <div className="flex items-center gap-2 mt-2">
              <TrendIcon trend={forecast.trend} />
              <span className="text-sm capitalize">{forecast.trend}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Forecast Daily Demand</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{forecast.forecast_daily}</div>
            <p className="text-xs text-muted-foreground mt-1">7-Day: {forecast.forecast_next_7_days}</p>
          </CardContent>
        </Card>

        <Card className={cn(forecast.reorder_required && 'border-destructive/50 bg-destructive/5')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reorder Point</CardTitle>
            {forecast.reorder_required && <AlertTriangle className="h-4 w-4 text-destructive" />}
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', forecast.reorder_required && 'text-destructive')}>
              {forecast.reorder_point}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Safety Stock: {forecast.safety_stock}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Days of Inventory</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {forecast.days_of_inventory ?? forecast.stock_coverage_days ?? 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {forecast.reorder_required ? 'Reorder recommended' : 'No reorder needed'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <CardTitle>Forecast Insights</CardTitle>
          </div>
          <CardDescription>AI-powered recommendations based on demand patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {generateInsights(forecast).map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="mt-0.5">•</div>
                <div>{insight}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Forecast Metrics</CardTitle>
          <CardDescription>Complete breakdown of forecast calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Sales (3 days)', value: `${forecast.sales_3d} units` },
              { label: 'Sales (7 days)', value: `${forecast.sales_7d} units` },
              { label: 'Sales (30 days)', value: `${forecast.sales_30d} units` },
              { label: 'Lead Time', value: `${forecast.lead_time} days` },
              {
                label: 'Stock Coverage',
                value: forecast.stock_coverage_days !== null ? `${forecast.stock_coverage_days} days` : 'N/A',
              },
              {
                label: 'Forecast Updated',
                value: new Date(forecast.forecast_timestamp).toLocaleString(),
                isSmall: true,
              },
            ].map(({ label, value, isSmall }) => (
              <div key={label} className="space-y-1">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={isSmall ? 'text-sm font-medium' : 'text-lg font-semibold'}>{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
