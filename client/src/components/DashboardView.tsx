import React, { useState, useEffect } from 'react';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Ban,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  Percent,
  Sparkles,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
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
  Legend,
  Cell,
  ReferenceLine
} from 'recharts';
import { api, DashboardStats, ChartData, OrderItem } from '../api';

interface DashboardViewProps {
  onNavigateToOrder: (orderId: string) => void;
  onOpenWhatsApp: (orderId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToOrder,
  onOpenWhatsApp
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [highRiskOrders, setHighRiskOrders] = useState<OrderItem[]>([]);
  const [period, setPeriod] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, chartsData, ordersData] = await Promise.all([
        api.getDashboardStats(period, source),
        api.getDashboardCharts(),
        api.getOrders({ action: 'HOLD_CANCEL', limit: 5 })
      ]);
      setStats(statsData);
      setCharts(chartsData);
      setHighRiskOrders(ordersData.orders);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, source]);

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span>Loading operational intelligence...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <span>{error || 'Unable to load dashboard data.'}</span>
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const kpi = stats.kpi;
  const fin = stats.financials;

  const ACTION_COLORS: Record<string, string> = {
    SHIP_AS_IS: '#10B981',
    SHIP_AFTER_CONFIRMATION: '#F59E0B',
    NUDGE_TO_PREPAID: '#3B82F6',
    HOLD_CANCEL: '#EF4444'
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
      {/* Top Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time COD risk evaluation, RTO interception metrics, and financial impact.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Period Selector */}
          <div className="inline-flex rounded-lg bg-white p-1 border border-slate-200 shadow-sm text-xs font-medium">
            {[
              { id: 'all', label: 'All Time' },
              { id: '30d', label: 'Last 30D' },
              { id: '7d', label: 'Last 7D' },
              { id: 'yesterday', label: 'Yesterday' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setPeriod(item.id)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  period === item.id
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Source Selector */}
          <div className="inline-flex rounded-lg bg-white p-1 border border-slate-200 shadow-sm text-xs font-medium">
            {[
              { id: 'all', label: 'All Sources' },
              { id: 'imported', label: 'Historical (2k)' },
              { id: 'simulated', label: 'Simulated' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setSource(item.id)}
                className={`px-2.5 py-1.5 rounded-md transition-all ${
                  source === item.id
                    ? 'bg-slate-800 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchData}
            title="Refresh metrics"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Orders */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Orders</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">
              {kpi.total_orders.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Avg Risk: <span className="font-semibold text-slate-700">{kpi.avg_risk_score}/100</span>
          </div>
        </div>

        {/* Ship As-Is */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold">Ship As-Is</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-950">
              {kpi.ship_as_is.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-semibold text-emerald-600">
              ({kpi.total_orders > 0 ? ((kpi.ship_as_is / kpi.total_orders) * 100).toFixed(1) : 0}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium">
            Auto-dispatched immediately
          </div>
        </div>

        {/* Ship After Confirmation */}
        <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold">Confirmation</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-amber-950">
              {kpi.ship_after_confirmation.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-semibold text-amber-600">
              ({kpi.total_orders > 0 ? ((kpi.ship_after_confirmation / kpi.total_orders) * 100).toFixed(1) : 0}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-amber-700 font-medium">
            WhatsApp YES required
          </div>
        </div>

        {/* Nudge to Prepaid */}
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-semibold">Prepaid Nudge</span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-blue-950">
              {kpi.nudge_to_prepaid.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-semibold text-blue-600">
              ({kpi.total_orders > 0 ? ((kpi.nudge_to_prepaid / kpi.total_orders) * 100).toFixed(1) : 0}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-blue-700 font-medium">
            ₹50 discount offered
          </div>
        </div>

        {/* Hold / Cancel */}
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-semibold">Hold / Cancel</span>
            <Ban className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-rose-950">
              {kpi.hold_cancel.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-semibold text-rose-600">
              ({kpi.total_orders > 0 ? ((kpi.hold_cancel / kpi.total_orders) * 100).toFixed(1) : 0}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-rose-700 font-medium">
            High risk intercepted
          </div>
        </div>

        {/* Overall Historical RTO */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Baseline RTO</span>
            <Percent className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">{kpi.overall_rto_rate}%</span>
            <span className="text-xs text-slate-500 font-normal">
              ({kpi.total_rtos} / {kpi.total_delivered + kpi.total_rtos})
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Delivered: {kpi.total_delivered}
          </div>
        </div>
      </div>

      {/* Financial Impact Banner */}
      <div className="bg-linear-to-r from-blue-900 via-navy-900 to-slate-900 text-white rounded-2xl p-6 shadow-lg shadow-blue-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-medium border border-blue-400/20">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Unit Economics & Net Impact Engine</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Estimated Monthly Net Profit Impact
            </h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Based on monthly volume of {fin.assumptions.monthly_orders.toLocaleString('en-IN')} orders,
              ₹169.40 operational RTO loss (fwd/rev/pkg/damage), and ₹402.38 delivered margin at ₹649 AOV.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                Net Monthly Benefit
              </span>
              <div className="text-3xl font-extrabold text-emerald-400 flex items-center justify-end gap-1">
                +₹{Math.round(fin.interventions.net_financial_impact).toLocaleString('en-IN')}
                <ArrowUpRight className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-[11px] text-emerald-300 font-mono">
                {fin.interventions.roi_multiple}x Return on Discount/Sacrifice
              </span>
            </div>
          </div>
        </div>

        {/* Financial Sub-Metrics Breakdown Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10 text-xs">
          <div className="space-y-1">
            <div className="text-slate-400 font-medium flex items-center gap-1">
              <span>Prevented RTO Savings</span>
              <span title="Operational loss saved from intercepted and converted orders">
                <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
              </span>
            </div>
            <div className="text-base font-bold text-white">
              +₹{Math.round(fin.interventions.estimated_rto_savings).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400">
              At ₹169.40 / prevented RTO
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-slate-400 font-medium flex items-center gap-1">
              <span>Sacrificed Gross Margin</span>
              <span title="Estimated margin lost on genuine buyers mistakenly cancelled">
                <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
              </span>
            </div>
            <div className="text-base font-bold text-rose-300">
              -₹{Math.round(fin.interventions.sacrificed_gross_profit).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400">
              {fin.interventions.estimated_genuine_orders_lost} est. genuine orders
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-slate-400 font-medium flex items-center gap-1">
              <span>Prepaid Discounts Given</span>
              <span title="Incentive discounts funded to convert COD to online payment">
                <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
              </span>
            </div>
            <div className="text-base font-bold text-amber-300">
              -₹{Math.round(fin.interventions.prepaid_discounts_cost).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400">
              {fin.interventions.prepaid_conversions} buyers converted to prepaid
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-slate-400 font-medium flex items-center gap-1">
              <span>Baseline Monthly Loss</span>
              <span title="Total operational losses suffered without risk intervention">
                <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
              </span>
            </div>
            <div className="text-base font-bold text-slate-200">
              ₹{Math.round(fin.baseline.monthly_operational_rto_losses).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400">
              {fin.baseline.expected_monthly_rtos} baseline RTOs / mo
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily Orders by Action Category */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">
                Daily Order Volume by Decision Category
              </h4>
              <p className="text-xs text-slate-500">
                Timeline distribution of automated decision tiers across the 6-month period
              </p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.daily_trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="ship_as_is" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} name="Ship As-Is" />
                <Area type="monotone" dataKey="ship_after_confirmation" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} name="Confirm" />
                <Area type="monotone" dataKey="nudge_to_prepaid" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Prepaid" />
                <Area type="monotone" dataKey="hold_cancel" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} name="Hold/Cancel" />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Decision Distribution with Actual RTO Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">
                Decision Distribution vs. Realized RTO Rate
              </h4>
              <p className="text-xs text-slate-500">
                Higher risk score tiers exhibit monotonically increasing historical RTO rates
              </p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.decision_distribution || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="action"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  tickFormatter={a => a.replace('SHIP_', '').replace('_TO_', ' ')}
                />
                <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 10, fill: '#EF4444' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar yAxisId="left" dataKey="count" name="Order Volume" radius={[4, 4, 0, 0]}>
                  {charts?.decision_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={ACTION_COLORS[entry.action] || '#3B82F6'} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="actual_rto_rate" name="Realized RTO Rate %" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.8} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Courier RTO Rate Comparison */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">
                Historical RTO Rate by Courier
              </h4>
              <p className="text-xs text-slate-500">
                Comparison against the national baseline (28.41% dotted line)
              </p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.courier_rto || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="courier" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis unit="%" tick={{ fontSize: 10, fill: '#64748B' }} domain={[0, 40]} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'RTO Rate']}
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <ReferenceLine y={28.41} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: 'Avg 28.4%', fill: '#64748B', fontSize: 10 }} />
                <Bar dataKey="rto_rate" name="RTO Rate %" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                  {charts?.courier_rto.map((c, i) => (
                    <Cell
                      key={`c-${i}`}
                      fill={c.rto_rate > 30 ? '#EF4444' : c.rto_rate < 27 ? '#10B981' : '#3B82F6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: City RTO Rates */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">
                Geographic RTO Variance (Top 10 Cities)
              </h4>
              <p className="text-xs text-slate-500">
                Tier-3 destinations vs metro hubs (Empirical Bayes smoothed)
              </p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.city_rto || []} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis type="number" unit="%" tick={{ fontSize: 10, fill: '#64748B' }} domain={[0, 70]} />
                <YAxis type="category" dataKey="city" tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'RTO Rate']}
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="rto_rate" name="RTO Rate %" radius={[0, 4, 4, 0]}>
                  {charts?.city_rto.map((c, i) => (
                    <Cell
                      key={`city-${i}`}
                      fill={c.rto_rate > 40 ? '#EF4444' : c.rto_rate < 20 ? '#10B981' : '#F59E0B'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* High Risk Intercepted Orders Spotlight */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <h4 className="font-semibold text-slate-900 text-sm">
              Critical Risk Interceptions Spotlight (Hold / Cancel Queue)
            </h4>
          </div>
          <button
            onClick={() => onNavigateToOrder('')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            View All ({kpi.hold_cancel}) &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80 font-medium">
              <tr>
                <th className="py-2.5 px-4">Order ID</th>
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">Value</th>
                <th className="py-2.5 px-4">Risk Score</th>
                <th className="py-2.5 px-4">Primary Risk Factor</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {highRiskOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No critical risk orders currently in review queue.
                  </td>
                </tr>
              ) : (
                highRiskOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {order.order_id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{order.customer_name}</div>
                      <div className="text-[11px] text-slate-500">{order.phone}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{order.city || 'Unknown'}, {order.state}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{order.address}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      ₹{order.order_value.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                        {order.risk_score}/100
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={order.explanation}>
                      {order.explanation}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => onOpenWhatsApp(order.id)}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-medium hover:bg-emerald-700 transition-colors"
                      >
                        WhatsApp
                      </button>
                      <button
                        onClick={() => onNavigateToOrder(order.id)}
                        className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-[11px] font-medium hover:bg-slate-200 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
