import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Eye,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Ban,
  Clock,
  Sparkles,
  Edit3,
  X,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  History,
  Tag
} from 'lucide-react';
import { api, OrderItem } from '../api';

interface OrdersViewProps {
  onOpenWhatsApp: (orderId: string) => void;
  selectedOrderId?: string;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onOpenWhatsApp, selectedOrderId }) => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 20, total_pages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);

  // Detail Modal / Drawer
  const [inspectingOrder, setInspectingOrder] = useState<OrderItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Manual Override Form State
  const [overrideAction, setOverrideAction] = useState<string>('SHIP_AS_IS');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideBy, setOverrideBy] = useState<string>('Senior Operations Lead');
  const [overrideSubmitting, setOverrideSubmitting] = useState<boolean>(false);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState<string | null>(null);

  // Simulate Order Modal
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [simForm, setSimForm] = useState({
    customer_name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    order_value: 649,
    items: 'Satin Pillowcase',
    num_items: 1,
    customer_prior_orders: 0,
    customer_prior_rto: 0,
    utm_source: 'meta_ads'
  });
  const [simSubmitting, setSimSubmitting] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getOrders({
        search: searchTerm,
        action: actionFilter,
        status: statusFilter,
        source: sourceFilter === 'ALL' ? undefined : sourceFilter,
        page,
        limit: 20
      });
      setOrders(res.orders);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, actionFilter, statusFilter, sourceFilter]);

  // Handle selectedOrderId prop if passed
  useEffect(() => {
    if (selectedOrderId) {
      openDetail(selectedOrderId);
    }
  }, [selectedOrderId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setOverrideSuccessMsg(null);
      const order = await api.getOrder(id);
      setInspectingOrder(order);
      setOverrideAction(order.action);
    } catch (err: any) {
      alert(`Error opening order: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingOrder) return;
    if (!overrideReason.trim()) {
      alert('Please provide a reason for the manual decision override.');
      return;
    }

    try {
      setOverrideSubmitting(true);
      await api.overrideDecision(inspectingOrder.id, {
        override_action: overrideAction as any,
        override_reason: overrideReason,
        override_by: overrideBy
      });

      setOverrideSuccessMsg('Decision successfully overridden and logged into audit trail.');
      // Refresh order
      const refreshed = await api.getOrder(inspectingOrder.id);
      setInspectingOrder(refreshed);
      fetchOrders();
    } catch (err: any) {
      alert(`Override failed: ${err.message}`);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const loadPreset = (presetType: 'safe' | 'rto_repeat' | 'fake_address' | 'invalid_phone') => {
    if (presetType === 'safe') {
      setSimForm({
        customer_name: 'Priya Sharma',
        phone: '9876543210',
        address: 'Flat 402, Lotus Residency, MG Road, near Metro Station',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        order_value: 1249,
        items: 'Satin Pillowcase|Claw Clip Set',
        num_items: 2,
        customer_prior_orders: 4,
        customer_prior_rto: 0,
        utm_source: 'direct'
      });
    } else if (presetType === 'rto_repeat') {
      setSimForm({
        customer_name: 'Rahul Verma',
        phone: '9822334455',
        address: 'House 44, Gali 2, Main Market',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '226001',
        order_value: 899,
        items: 'Hair Oil 100ml',
        num_items: 1,
        customer_prior_orders: 2,
        customer_prior_rto: 2,
        utm_source: 'meta_ads'
      });
    } else if (presetType === 'fake_address') {
      setSimForm({
        customer_name: 'Amit Kumar',
        phone: '9811223344',
        address: '.', // period
        city: 'Patna',
        state: 'Bihar',
        pincode: '800001',
        order_value: 749,
        items: 'Scrunchies 6pk',
        num_items: 1,
        customer_prior_orders: 0,
        customer_prior_rto: 0,
        utm_source: 'meta_ads'
      });
    } else if (presetType === 'invalid_phone') {
      setSimForm({
        customer_name: 'Komal Mishra',
        phone: '723013610', // 9 digits
        address: 'House 14, Sector 15, Near City Park',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        order_value: 649,
        items: 'Claw Clip Set',
        num_items: 1,
        customer_prior_orders: 0,
        customer_prior_rto: 0,
        utm_source: 'instagram_organic'
      });
    }
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSimSubmitting(true);
      const res = await api.createOrder(simForm);
      setSimResult(res);
      fetchOrders();
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimSubmitting(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'SHIP_AS_IS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Ship As-Is
          </span>
        );
      case 'SHIP_AFTER_CONFIRMATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Confirmation
          </span>
        );
      case 'NUDGE_TO_PREPAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CreditCard className="w-3 h-3 text-blue-600" />
            Prepaid Nudge
          </span>
        );
      case 'HOLD_CANCEL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Ban className="w-3 h-3 text-rose-600" />
            Hold / Cancel
          </span>
        );
      default:
        return <span>{action}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100/70 text-emerald-800">
            Delivered
          </span>
        );
      case 'RTO':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800">
            RTO
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200 text-slate-800">
            Cancelled
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800">
            In Transit
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score <= 24) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score <= 44) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (score <= 69) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* Top Header */}
      <div className="p-6 pb-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Orders & Risk Engine</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit risk explanations, trigger simulated WhatsApp flows, or execute manual overrides.
          </p>
        </div>

        <button
          onClick={() => {
            setSimResult(null);
            setShowSimulateModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Simulate New Shopify COD Order</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer Name, or Phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 shrink-0"
          >
            Search
          </button>
        </form>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Action:</span>
            <select
              value={actionFilter}
              onChange={e => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden"
            >
              <option value="ALL">All Actions</option>
              <option value="SHIP_AS_IS">Ship As-Is</option>
              <option value="SHIP_AFTER_CONFIRMATION">Ship After Confirmation</option>
              <option value="NUDGE_TO_PREPAID">Nudge to Prepaid</option>
              <option value="HOLD_CANCEL">Hold / Cancel</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="RTO">RTO</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="IN_TRANSIT">In Transit</option>
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Source:</span>
            <select
              value={sourceFilter}
              onChange={e => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden"
            >
              <option value="ALL">All Orders</option>
              <option value="imported">Historical (2,018)</option>
              <option value="simulated">Simulated New</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setActionFilter('ALL');
              setStatusFilter('ALL');
              setSourceFilter('ALL');
              setPage(1);
            }}
            className="text-slate-500 hover:text-slate-800 text-xs px-2 py-1"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100/80 text-slate-600 sticky top-0 z-10 border-b border-slate-200 font-semibold shadow-xs">
            <tr>
              <th className="py-2.5 px-4">Order ID & Date</th>
              <th className="py-2.5 px-4">Customer & Location</th>
              <th className="py-2.5 px-4">Basket & Value</th>
              <th className="py-2.5 px-4">Prior History</th>
              <th className="py-2.5 px-4">Risk Score</th>
              <th className="py-2.5 px-4">Action Decision</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  <span>Loading orders...</span>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No orders match your current filters.
                </td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Order ID & Date */}
                  <td className="py-3 px-4">
                    <div className="font-mono font-semibold text-slate-900 flex items-center gap-1.5">
                      <span>{order.order_id}</span>
                      {order.is_imported_historical === 0 && (
                        <span className="text-[9px] bg-purple-100 text-purple-700 font-sans px-1 rounded font-medium">
                          SIMULATED
                        </span>
                      )}
                      {order.is_manual_override === 1 && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 font-sans px-1 rounded font-medium" title={`Overridden by ${order.override_by}`}>
                          OVERRIDDEN
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{order.order_datetime}</div>
                  </td>

                  {/* Customer & Location */}
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{order.customer_name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span>{order.phone}</span>
                      <span>&bull;</span>
                      <span>{order.city || 'Unknown'}, {order.state}</span>
                    </div>
                  </td>

                  {/* Basket & Value */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">
                      ₹{order.order_value.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[180px]" title={order.items}>
                      {order.num_items} item(s): {order.items}
                    </div>
                  </td>

                  {/* Prior History */}
                  <td className="py-3 px-4 text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px]">
                        Orders: <strong className="text-slate-900">{order.customer_prior_orders}</strong>
                      </span>
                      <span className="text-[11px]">
                        RTOs:{' '}
                        <strong className={order.customer_prior_rto > 0 ? 'text-rose-600 font-bold' : 'text-slate-900'}>
                          {order.customer_prior_rto}
                        </strong>
                      </span>
                    </div>
                  </td>

                  {/* Risk Score */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono border ${getRiskScoreColor(
                        order.risk_score
                      )}`}
                    >
                      {order.risk_score}/100
                    </span>
                  </td>

                  {/* Decision Action */}
                  <td className="py-3 px-4">
                    {getActionBadge(order.is_manual_override === 1 && order.override_action ? order.override_action : order.action)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    {getStatusBadge(order.final_status)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      onClick={() => onOpenWhatsApp(order.id)}
                      title="Launch WhatsApp Simulator"
                      className="p-1.5 rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors inline-flex items-center"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDetail(order.id)}
                      className="px-2.5 py-1 rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 text-xs font-medium transition-colors"
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

      {/* Pagination Footer */}
      <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing {orders.length > 0 ? (page - 1) * pagination.limit + 1 : 0} to{' '}
          {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} orders
        </div>
        <div className="flex items-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
          >
            Previous
          </button>
          <span className="px-2 font-medium text-slate-700">
            Page {page} of {pagination.total_pages || 1}
          </span>
          <button
            disabled={page >= pagination.total_pages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
          >
            Next
          </button>
        </div>
      </div>

      {/* Order Details Drawer / Modal */}
      {inspectingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>Order #{inspectingOrder.order_id}</span>
                    {inspectingOrder.is_imported_historical === 0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 font-sans px-1.5 py-0.5 rounded font-semibold">
                        SIMULATED
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">{inspectingOrder.order_datetime}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Decision Action Summary Banner */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getActionBadge(inspectingOrder.is_manual_override === 1 && inspectingOrder.override_action ? inspectingOrder.override_action : inspectingOrder.action)}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono border ${getRiskScoreColor(inspectingOrder.risk_score)}`}>
                      Score: {inspectingOrder.risk_score}/100
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>{inspectingOrder.ai_used === 1 ? 'Groq AI' : 'Deterministic Heuristic'}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200/70 font-medium leading-relaxed">
                  {inspectingOrder.explanation}
                </div>

                {inspectingOrder.is_manual_override === 1 && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Manual Override Applied</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Reason: "{inspectingOrder.override_reason}" (by {inspectingOrder.override_by} at {inspectingOrder.override_at})
                    </p>
                  </div>
                )}
              </div>

              {/* Customer Profile & Address */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Customer & Shipping Details</span>
                </h4>
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-400">Customer Name:</span>
                      <div className="font-semibold text-slate-900 text-sm mt-0.5">{inspectingOrder.customer_name}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Phone Number:</span>
                      <div className="font-semibold text-slate-900 font-mono mt-0.5">{inspectingOrder.phone}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-400">Shipping Address:</span>
                    <div className="font-medium text-slate-800 mt-0.5 flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        {inspectingOrder.address}, {inspectingOrder.city || 'Unknown'}, {inspectingOrder.state} — {inspectingOrder.pincode || 'No PIN'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400">Prior Orders:</span>
                      <div className="font-semibold text-slate-800">{inspectingOrder.customer_prior_orders}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Prior RTOs:</span>
                      <div className={`font-semibold ${inspectingOrder.customer_prior_rto > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {inspectingOrder.customer_prior_rto}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Channel / UTM:</span>
                      <div className="font-semibold text-slate-800">{inspectingOrder.utm_source}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explainable Risk Factors Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Explainable Risk Factors Breakdown</span>
                </h4>

                <div className="space-y-2">
                  {(!inspectingOrder.factors || inspectingOrder.factors.length === 0) ? (
                    <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg">
                      No discrete factor anomalies recorded. Baseline safe parameters.
                    </div>
                  ) : (
                    inspectingOrder.factors.map((f, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                          f.score_delta > 0
                            ? f.severity === 'CRITICAL'
                              ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                              : 'bg-amber-50/50 border-amber-200 text-amber-950'
                            : 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold flex items-center gap-1.5">
                            <span>{f.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-medium opacity-80 uppercase">
                              {f.category}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80 leading-relaxed">{f.description}</p>
                        </div>
                        <span
                          className={`font-mono font-bold text-xs shrink-0 px-2 py-0.5 rounded ${
                            f.score_delta > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {f.score_delta > 0 ? `+${f.score_delta}` : `${f.score_delta}`} pts
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* WhatsApp Action Shortcut */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                <div>
                  <h5 className="font-semibold text-emerald-950 text-xs">Simulate WhatsApp Communication</h5>
                  <p className="text-[11px] text-emerald-800">
                    Test buyer confirmation, discount offers, and simulated UPI/Card payment.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const id = inspectingOrder.id;
                    setInspectingOrder(null);
                    onOpenWhatsApp(id);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Open Simulator
                </button>
              </div>

              {/* Manual Override Section */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <h4 className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Manual Operations Decision Override</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Override the automated engine decision with full audit logging for compliance.
                </p>

                {overrideSuccessMsg && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium">
                    {overrideSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleManualOverride} className="space-y-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      New Decision Action:
                    </label>
                    <select
                      value={overrideAction}
                      onChange={e => setOverrideAction(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden"
                    >
                      <option value="SHIP_AS_IS">SHIP_AS_IS — Dispatched Immediately</option>
                      <option value="SHIP_AFTER_CONFIRMATION">SHIP_AFTER_CONFIRMATION — Require WhatsApp YES</option>
                      <option value="NUDGE_TO_PREPAID">NUDGE_TO_PREPAID — Offer Prepaid Discount</option>
                      <option value="HOLD_CANCEL">HOLD_CANCEL — Cancel Order to Prevent Loss</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Reason for Override (Audit Log):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Spoke to customer directly; verified landmark address"
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Operator / Reviewer:
                    </label>
                    <input
                      type="text"
                      value={overrideBy}
                      onChange={e => setOverrideBy(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={overrideSubmitting}
                    className="w-full py-2 bg-slate-900 hover:bg-black text-white font-semibold rounded-lg text-xs transition-colors shadow-xs disabled:opacity-50"
                  >
                    {overrideSubmitting ? 'Recording Override...' : 'Confirm Decision Override'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simulate New Shopify Order Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Simulate New Shopify COD Order
                </h3>
                <p className="text-xs text-slate-500">
                  Input mock order attributes or load realistic test personas to test decisioning.
                </p>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Presets Bar */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Quick Load Test Personas:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => loadPreset('safe')}
                    className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-medium hover:bg-emerald-100"
                  >
                    Safe Repeat Buyer (Mumbai)
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('rto_repeat')}
                    className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-medium hover:bg-rose-100"
                  >
                    2-RTO Repeat Buyer (UP)
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('fake_address')}
                    className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-medium hover:bg-amber-100"
                  >
                    Garbage Address (".")
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('invalid_phone')}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-medium hover:bg-blue-100"
                  >
                    Invalid 9-Digit Phone
                  </button>
                </div>
              </div>

              {simResult && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950 text-xs">
                      Simulation Complete: Order #{simResult.order.order_id}
                    </span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                      Score: {simResult.decision.risk_score}/100
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getActionBadge(simResult.decision.action)}
                    <span className="text-xs text-slate-700 font-medium">
                      {simResult.decision.explanation}
                    </span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSimulateSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={simForm.customer_name}
                      onChange={e => setSimForm({ ...simForm, customer_name: e.target.value })}
                      placeholder="e.g. Priya Sharma"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={simForm.phone}
                      onChange={e => setSimForm({ ...simForm, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={simForm.address}
                    onChange={e => setSimForm({ ...simForm, address: e.target.value })}
                    placeholder="e.g. Flat 402, Lotus Residency, MG Road"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">City</label>
                    <input
                      type="text"
                      value={simForm.city}
                      onChange={e => setSimForm({ ...simForm, city: e.target.value })}
                      placeholder="e.g. Mumbai"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">State</label>
                    <input
                      type="text"
                      value={simForm.state}
                      onChange={e => setSimForm({ ...simForm, state: e.target.value })}
                      placeholder="e.g. Maharashtra"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">PIN Code</label>
                    <input
                      type="text"
                      value={simForm.pincode}
                      onChange={e => setSimForm({ ...simForm, pincode: e.target.value })}
                      placeholder="e.g. 400001"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Order Value (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={simForm.order_value}
                      onChange={e => setSimForm({ ...simForm, order_value: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Prior Deliveries</label>
                    <input
                      type="number"
                      min={0}
                      value={simForm.customer_prior_orders}
                      onChange={e => setSimForm({ ...simForm, customer_prior_orders: parseInt(e.target.value, 10) || 0 })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Prior RTOs</label>
                    <input
                      type="number"
                      min={0}
                      value={simForm.customer_prior_rto}
                      onChange={e => setSimForm({ ...simForm, customer_prior_rto: parseInt(e.target.value, 10) || 0 })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowSimulateModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={simSubmitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {simSubmitting ? 'Evaluating Risk...' : 'Run Decision Engine & Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
