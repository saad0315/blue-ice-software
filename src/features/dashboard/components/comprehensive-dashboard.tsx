'use client';

import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays } from 'date-fns';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  Droplet,
  Minus,
  Package,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useComprehensiveDashboard } from '@/features/dashboard/api/use-comprehensive-dashboard';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Custom Glass Tooltip
const GlassTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card border-white/40 p-3 text-sm">
        <p className="mb-1 font-semibold">{label}</p>
        {payload.map((p: any, index: number) => (
          <p key={index} style={{ color: p.color }} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ComprehensiveDashboard() {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return {
          startDate: format(startOfDay(now), 'yyyy-MM-dd'),
          endDate: format(endOfDay(now), 'yyyy-MM-dd'),
        };
      case 'week':
        return {
          startDate: format(subDays(now, 7), 'yyyy-MM-dd'),
          endDate: format(now, 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      case 'custom':
        return {
          startDate: customStart,
          endDate: customEnd,
        };
    }
  };

  const { startDate, endDate } = getDateRange();
  const { data, isLoading, isError } = useComprehensiveDashboard({ startDate, endDate });

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="glass h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="glass h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="glass h-96" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="glass-card flex h-96 flex-col items-center justify-center gap-6">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Failed to load dashboard data</h2>
        <p className="text-muted-foreground">Please check your connection and try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent dark:from-blue-400 dark:to-teal-300">
            Overview
          </h1>
          <p className="font-medium text-muted-foreground">Business Intelligence & Analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="glass border-primary/20 text-xs text-primary">
            <Activity className="mr-1 h-3 w-3 animate-pulse" />
            Live Updates
          </Badge>
        </div>
      </div>

      {/* Date Range Filter - Floating Glass Bar */}
      <Card className="glass-card sticky top-4 z-20 border-white/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex flex-wrap gap-2">
            {['today', 'week', 'month'].map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setDateRange(range as any)}
                className={`capitalize ${dateRange === range ? 'bg-primary/80 backdrop-blur-sm' : 'hover:bg-white/20'}`}
              >
                {range === 'week' ? 'Last 7 Days' : range === 'month' ? 'This Month' : 'Today'}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white/30 p-1 dark:bg-black/20">
            <Input
              type="date"
              className="h-8 w-36 border-none bg-transparent text-xs focus-visible:ring-0"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setDateRange('custom');
              }}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              className="h-8 w-36 border-none bg-transparent text-xs focus-visible:ring-0"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setDateRange('custom');
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Overview KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card transition-transform duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="rounded-full bg-green-100/50 p-2 dark:bg-green-900/30">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-2xl font-bold text-transparent">
              PKR {data?.overview.totalRevenue.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs font-medium">
              {getTrendIcon(data?.overview.revenueChange || 0)}
              <span className={getTrendColor(data?.overview.revenueChange || 0)}>
                {Math.abs(data?.overview.revenueChange || 0).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs prev</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card transition-transform duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <div className="rounded-full bg-blue-100/50 p-2 dark:bg-blue-900/30">
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data?.overview.totalOrders}</div>
            <div className="mt-1 flex items-center gap-1 text-xs font-medium">
              {getTrendIcon(data?.overview.ordersChange || 0)}
              <span className={getTrendColor(data?.overview.ordersChange || 0)}>
                {Math.abs(data?.overview.ordersChange || 0).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs prev</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card transition-transform duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Customers</CardTitle>
            <div className="rounded-full bg-purple-100/50 p-2 dark:bg-purple-900/30">
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data?.overview.totalCustomers}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                +{data?.overview.newCustomers} New
              </Badge>
              <span>this period</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card transition-transform duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
            <div className="rounded-full bg-orange-100/50 p-2 dark:bg-orange-900/30">
              <BarChart3 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              PKR {data?.overview.avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Per completed order</p>
          </CardContent>
        </Card>
      </div>

      {/* Profitability & Asset Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Net Profit Card */}
        <Card className="glass-card transition-transform duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">PKR {(data?.overview.netProfit || 0).toLocaleString()}</div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="font-medium text-emerald-800">Revenue: PKR {(data?.overview.totalRevenue || 0).toLocaleString()}</span>
              <span className="font-medium text-red-600">Exp: PKR {(data?.overview.totalExpenses || 0).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Market Receivables Card */}
        <Card
          className="cursor-pointer glass-card transition-transform duration-300 hover:scale-[1.02]"
          onClick={() => (window.location.href = '/customers?filter=debt')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Market Receivables</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">PKR {(data?.overview.totalReceivables || 0).toLocaleString()}</div>
            <p className="mt-1 text-xs text-orange-800">Total Outstanding (Udhaar) in Market</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Click to view details</p>
          </CardContent>
        </Card>

        {/* Bottles with Customers Card */}
        <Card className="glass-card transition-transform duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Bottles with Customers</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{(data?.bottleStats.netDifference || 0).toLocaleString()}</div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-foreground">Sent: {(data?.bottleStats.filledGiven || 0).toLocaleString()}</span>
              <span className="text-foreground">Ret: {(data?.bottleStats.emptyTaken || 0).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Order Trends */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Daily revenue performance (Last 30 Days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data?.trends.revenue || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0088FE" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#0088FE" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'transparent' }} />
                <Area type="monotone" dataKey="revenue" stroke="#0088FE" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Completion vs Cancellations</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.trends.orders || []} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis hide />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                <Legend iconType="circle" />
                <Bar dataKey="COMPLETED" fill="#00C49F" name="Completed" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="PENDING" fill="#FFBB28" name="Pending" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="CANCELLED" fill="#FF8042" name="Cancelled" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Order Statistics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Current period breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-8 md:flex-row">
              <div className="h-[200px] w-full md:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.orderStats.byStatus || []}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                    >
                      {(data?.orderStats.byStatus || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<GlassTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-3 md:w-1/2">
                {(data?.orderStats.byStatus || []).map((stat, index) => (
                  <div key={stat.status} className="group flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full ring-2 ring-transparent transition-all group-hover:ring-offset-1"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{stat.status}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{stat.count}</div>
                      <div className="text-xs text-muted-foreground">PKR {stat.amount.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Revenue source breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Using native HTML progress bars styled with Tailwind for a change */}
              {(data?.orderStats.byPaymentMethod || []).map((stat, index) => {
                const total = data?.orderStats.byPaymentMethod.reduce((acc, curr) => acc + curr.amount, 0) || 1;
                const percent = (stat.amount / total) * 100;
                return (
                  <div key={stat.method} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className={`h-4 w-1 rounded-full ${index % 2 === 0 ? 'bg-blue-500' : 'bg-teal-500'}`} />
                        {stat.method}
                      </span>
                      <span className="font-mono text-muted-foreground">{stat.count} orders</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary/50">
                        <div
                          className={`h-full rounded-full ${index % 2 === 0 ? 'bg-blue-500' : 'bg-teal-500'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-xs font-bold">{Math.round(percent)}%</span>
                    </div>
                    <p className="text-right text-xs text-muted-foreground">PKR {stat.amount.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Management */}
      <Card className="glass-card bg-gradient-to-br from-white/60 to-emerald-50/30 dark:from-slate-900/60 dark:to-emerald-900/10">
        <CardHeader>
          <CardTitle>Cash Flow</CardTitle>
          <CardDescription>Collection & Handover Status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2 rounded-xl border border-white/20 bg-white/40 p-4 dark:bg-black/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collected</span>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(
                    data?.cashManagement.totalCashCollected || 0,
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">From {data?.cashManagement.cashOrders} orders</p>
            </div>

            <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-yellow-500/20 bg-white/40 p-4 dark:bg-black/40">
              <div className="absolute right-0 top-0 p-2 opacity-10">
                <Clock className="h-16 w-16 text-yellow-500" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Handover</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {data?.cashManagement.pendingHandovers.count}
                </span>
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                  Action Needed
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                PKR {(data?.cashManagement.pendingHandovers.amount || 0).toLocaleString()} waiting
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-green-500/20 bg-white/40 p-4 dark:bg-black/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verified</span>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                  PKR {data?.cashManagement.verifiedCash?.toLocaleString() ?? '0'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Safely deposited</p>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-blue-500/20 bg-white/40 p-4 dark:bg-black/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collection Rate</span>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {(data?.cashManagement?.cashOrders || 0) > 0
                    ? (((data?.cashManagement.totalCashCollected || 0) / (data?.overview.totalRevenue || 1)) * 100).toFixed(1)
                    : '0'}
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Cash vs Total Revenue</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Driver & Inventory Split */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Top Drivers</CardTitle>
            <CardDescription>Performance Leaderboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data?.driverPerformance || []).slice(0, 5).map((driver, index) => (
                <div key={driver.driverId} className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-white/10">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-md ${index === 0
                      ? 'bg-yellow-400 text-yellow-900'
                      : index === 1
                        ? 'bg-gray-300 text-gray-900'
                        : index === 2
                          ? 'bg-amber-600 text-white'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-semibold">{driver.driverName}</span>
                      <Badge variant="outline" className="text-xs">
                        PKR {driver.revenue.toLocaleString()}
                      </Badge>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/30">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${(driver.revenue / (data?.driverPerformance[0]?.revenue || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card border-blue-200/50 bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Droplet className="h-5 w-5 text-blue-500" />
                Bottle Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 divide-x divide-white/20 text-center">
                <div className="p-2">
                  <div className="text-xs uppercase text-muted-foreground">Given</div>
                  <div className="text-xl font-bold text-blue-600">{data?.bottleStats.filledGiven}</div>
                </div>
                <div className="p-2">
                  <div className="text-xs uppercase text-muted-foreground">Returned</div>
                  <div className="text-xl font-bold text-teal-600">{data?.bottleStats.emptyTaken}</div>
                </div>
                <div className="p-2">
                  <div className="text-xs uppercase text-muted-foreground">Loss/Net</div>
                  <div className={`text-xl font-bold ${data?.bottleStats.netDifference > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                    {data?.bottleStats.netDifference}
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-white/20 pt-4">
                <div className="mb-1 flex justify-between text-xs">
                  <span>Return Rate</span>
                  <span className="font-bold">
                    {data?.bottleStats.filledGiven ? ((data?.bottleStats.emptyTaken / data?.bottleStats.filledGiven) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-teal-400"
                    style={{
                      width: `${data?.bottleStats.filledGiven ? (data?.bottleStats.emptyTaken / data?.bottleStats.filledGiven) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle>Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="custom-scrollbar max-h-[200px] space-y-2 overflow-y-auto pr-2">
                {(data?.inventory || []).filter((p) => p.stockFilled < 50).length === 0 ? (
                  <div className="py-8 text-center text-2xl text-muted-foreground">Inventory looks healthy!😃</div>
                ) : (
                  (data?.inventory || [])
                    .filter((p) => p.stockFilled < 50)
                    .map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between rounded border border-red-100 bg-red-50/50 p-2 dark:border-red-900/30 dark:bg-red-900/10"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{product.name}</span>
                          <span className="text-xs text-red-600 dark:text-red-400">Only {product.stockFilled} left</span>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 border-red-200 text-xs hover:bg-red-100">
                          Restock
                        </Button>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Customer Segments & Alerts */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card md:col-span-2">
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(data?.customerAnalytics.topCustomers || []).slice(0, 6).map((c, i) => (
                <div
                  key={c.customerId}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 text-xs font-bold text-white">
                      {c.customerName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.customerName}</p>
                      <p className="text-xs text-muted-foreground">{c.orderCount} Orders</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-semibold">
                    {new Intl.NumberFormat('en-PK', {
                      compactDisplay: 'short',
                      notation: 'compact',
                      style: 'currency',
                      currency: 'PKR',
                    }).format(c.totalRevenue)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-red-200/50 dark:border-red-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.alerts.failedOrders.slice(0, 3).map((order) => (
                <div
                  key={order.id}
                  className="rounded border border-red-100 bg-red-50 p-2 text-xs dark:border-red-900/30 dark:bg-red-900/20"
                >
                  <div className="flex justify-between font-semibold text-red-700 dark:text-red-300">
                    <span>Order #{order.readableId}</span>
                    <span>Failed</span>
                  </div>
                  <div className="mt-1 flex justify-between text-red-600/80">
                    <span>{order.customerName}</span>
                    <span>PKR {order.amount}</span>
                  </div>
                </div>
              ))}
              {data?.alerts.highCreditCustomers.slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className="rounded border border-orange-100 bg-orange-50 p-2 text-xs dark:border-orange-900/30 dark:bg-orange-900/20"
                >
                  <div className="flex justify-between font-semibold text-orange-700 dark:text-orange-300">
                    <span>{c.name}</span>
                    <span>Credit Limit</span>
                  </div>
                  <div className="mt-1 text-orange-600/80">Used: {c.utilizationPercent.toFixed(0)}%</div>
                </div>
              ))}
              {!data?.alerts.failedOrders.length && !data?.alerts.highCreditCustomers.length && (
                <div className="flex flex-col items-center py-4 text-center text-green-600">
                  <CheckCircle className="mb-2 h-8 w-8 opacity-50" />
                  <span className="text-sm">All systems normal</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
