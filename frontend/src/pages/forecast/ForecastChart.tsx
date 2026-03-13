/**
 * ForecastChart.tsx — Sales history + 7-day projection line chart.
 * Also renders the multi-window bar chart.
 */

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ForecastData, ForecastHistoryItem } from '@/services/api';

interface ForecastChartProps {
  forecast: ForecastData;
  history: ForecastHistoryItem[];
}

function buildChartData(history: ForecastHistoryItem[], forecast: ForecastData) {
  type ChartPoint = { date: string; actual: number | null; forecast: number | null; reorderThreshold: number | null };
  const historicalPoints: ChartPoint[] = history.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    actual: item.quantity,
    forecast: null,
    reorderThreshold: null,
  }));

  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const future = new Date(today);
    future.setDate(today.getDate() + i);
    historicalPoints.push({
      date: future.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      actual: null,
      forecast: forecast.forecast_daily,
      reorderThreshold: forecast.reorder_point,
    });
  }
  return historicalPoints.slice(-30);
}

export function ForecastChart({ forecast, history }: ForecastChartProps) {
  const chartData = buildChartData(history, forecast);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Line: historical + projected */}
      <Card>
        <CardHeader>
          <CardTitle>Demand Forecast</CardTitle>
          <CardDescription>Historical sales and 7-day forecast projection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Actual Sales" />
                <Line type="monotone" dataKey="forecast" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Forecast" />
                <Line type="monotone" dataKey="reorderThreshold" stroke="hsl(var(--warning, 35 92% 51%))" strokeWidth={2} strokeDasharray="3 3" dot={false} connectNulls name="Reorder Threshold" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bar: multi-window averages */}
      <Card>
        <CardHeader>
          <CardTitle>Multi-Window Analysis</CardTitle>
          <CardDescription>Average daily sales by time window</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { window: '3 Days', avg: forecast.avg_daily_3d },
                { window: '7 Days', avg: forecast.avg_daily_7d },
                { window: '30 Days', avg: forecast.avg_daily_30d },
              ]}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="window" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
