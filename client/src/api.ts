const API_BASE = '/api';

export interface DashboardStats {
  kpi: {
    total_orders: number;
    ship_as_is: number;
    ship_after_confirmation: number;
    nudge_to_prepaid: number;
    hold_cancel: number;
    total_rtos: number;
    total_delivered: number;
    overall_rto_rate: number;
    avg_risk_score: number;
    ai_evaluated_orders: number;
    manual_overrides: number;
  };
  financials: {
    assumptions: any;
    baseline: {
      monthly_cod_orders: number;
      expected_monthly_rtos: number;
      damage_cost_per_rto: number;
      operational_rto_loss_per_rto: number;
      gross_profit_per_delivered_order: number;
      monthly_operational_rto_losses: number;
    };
    interventions: {
      orders_prevented_or_cancelled: number;
      estimated_rto_savings: number;
      prepaid_conversions: number;
      prepaid_discounts_cost: number;
      estimated_genuine_orders_lost: number;
      sacrificed_gross_profit: number;
      sacrificed_cac_loss: number;
      net_financial_impact: number;
      roi_multiple: number;
    };
  };
}

export interface ChartData {
  daily_trend: Array<{
    date: string;
    total: number;
    ship_as_is: number;
    ship_after_confirmation: number;
    nudge_to_prepaid: number;
    hold_cancel: number;
    rtos: number;
  }>;
  courier_rto: Array<{
    courier: string;
    total: number;
    rtos: number;
    rto_rate: number;
    avg_risk_score: number;
  }>;
  city_rto: Array<{
    city: string;
    total: number;
    rtos: number;
    rto_rate: number;
    avg_risk_score: number;
  }>;
  utm_stats: Array<{
    utm_source: string;
    total: number;
    rtos: number;
    rto_rate: number;
    avg_risk_score: number;
  }>;
  decision_distribution: Array<{
    action: string;
    count: number;
    avg_score: number;
    actual_rto_rate: number;
  }>;
}

export interface OrderItem {
  id: string;
  order_id: string;
  order_datetime: string;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  order_value: number;
  items: string;
  num_items: number;
  customer_prior_orders: number;
  customer_prior_rto: number;
  utm_source: string;
  courier: string;
  payment_method: string;
  final_status: string;
  is_imported_historical: number;
  risk_score: number;
  action: 'SHIP_AS_IS' | 'SHIP_AFTER_CONFIRMATION' | 'NUDGE_TO_PREPAID' | 'HOLD_CANCEL';
  explanation: string;
  ai_used: number;
  is_manual_override: number;
  override_action?: string;
  override_reason?: string;
  override_by?: string;
  override_at?: string;
  factors?: Array<{
    category: string;
    name: string;
    score_delta: number;
    severity: string;
    description: string;
  }>;
  ai_reasoning?: string;
  whatsapp?: any;
}

export const api = {
  async getDashboardStats(period: string = 'all', source: string = 'all'): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/dashboard/stats?period=${period}&source=${source}`);
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  async getDashboardCharts(): Promise<ChartData> {
    const res = await fetch(`${API_BASE}/dashboard/charts`);
    if (!res.ok) throw new Error('Failed to fetch dashboard charts');
    return res.json();
  },

  async getOrders(params: {
    search?: string;
    action?: string;
    status?: string;
    source?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_dir?: string;
  }): Promise<{ orders: OrderItem[]; pagination: any }> {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.action) qs.set('action', params.action);
    if (params.status) qs.set('status', params.status);
    if (params.source) qs.set('source', params.source);
    if (params.page) qs.set('page', params.page.toString());
    if (params.limit) qs.set('limit', params.limit.toString());
    if (params.sort_by) qs.set('sort_by', params.sort_by);
    if (params.sort_dir) qs.set('sort_dir', params.sort_dir);

    const res = await fetch(`${API_BASE}/orders?${qs.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  async getOrder(id: string): Promise<OrderItem> {
    const res = await fetch(`${API_BASE}/orders/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch order ${id}`);
    return res.json();
  },

  async createOrder(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create order');
    }
    return res.json();
  },

  async overrideDecision(id: string, payload: { override_action: string; override_reason: string; override_by: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/orders/${id}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to override decision');
    }
    return res.json();
  },

  // WhatsApp
  async getWhatsApp(orderId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/whatsapp`);
    if (!res.ok) return null;
    return res.json();
  },

  async startWhatsApp(orderId: string, payload: { workflow_type: string; language: string; discount_amount: number }): Promise<any> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/whatsapp/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to start WhatsApp simulation');
    return res.json();
  },

  async sendWhatsAppReply(orderId: string, text: string): Promise<any> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/whatsapp/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('Failed to send reply');
    return res.json();
  },

  async triggerMockPayment(orderId: string, outcome: 'SUCCESS' | 'FAILED'): Promise<any> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/whatsapp/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome })
    });
    if (!res.ok) throw new Error('Failed to trigger payment');
    return res.json();
  },

  async triggerWhatsAppTimeout(orderId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/whatsapp/timeout`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to trigger timeout');
    return res.json();
  },

  // Settings
  async getSettings(): Promise<any> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSetting(key: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update setting');
    }
    return res.json();
  },

  // Financial
  async getFinancialOverview(): Promise<any> {
    const res = await fetch(`${API_BASE}/financial/overview`);
    if (!res.ok) throw new Error('Failed to fetch financial overview');
    return res.json();
  },

  async simulateFinancials(assumptions: any): Promise<any> {
    const res = await fetch(`${API_BASE}/financial/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assumptions })
    });
    if (!res.ok) throw new Error('Failed to simulate financials');
    return res.json();
  }
};
