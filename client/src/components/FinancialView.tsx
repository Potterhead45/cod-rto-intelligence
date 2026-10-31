import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Calculator,
  Sliders,
  CheckCircle2,
  Info
} from 'lucide-react';
import { api, DashboardStats } from '../api';

export const FinancialView: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulatedData, setSimulatedData] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  // Scenario Simulator Inputs
  const [simMonthlyOrders, setSimMonthlyOrders] = useState<number>(3000);
  const [simCodShare, setSimCodShare] = useState<number>(55);
  const [simPrepaidDiscount, setSimPrepaidDiscount] = useState<number>(50);
  const [simDamageRate, setSimDamageRate] = useState<number>(8);
  const [simForwardShipping, setSimForwardShipping] = useState<number>(65);
  const [simReturnShipping, setSimReturnShipping] = useState<number>(65);

  const fetchFinancials = async () => {
    try {
      setLoading(true);
      const res = await api.getFinancialOverview();
      setData(res);
      setSimMonthlyOrders(res.assumptions.monthly_orders);
      setSimCodShare(res.assumptions.cod_share_pct);
      setSimDamageRate(res.assumptions.product_damage_pct);
      setSimForwardShipping(res.assumptions.forward_shipping);
      setSimReturnShipping(res.assumptions.return_shipping);
    } catch (err) {
      console.error('Error fetching financial overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const runSimulation = async () => {
    try {
      setSimLoading(true);
      const res = await api.simulateFinancials({
        monthly_orders: simMonthlyOrders,
        cod_share_pct: simCodShare,
        product_damage_pct: simDamageRate,
        forward_shipping: simForwardShipping,
        return_shipping: simReturnShipping
      });
      setSimulatedData(res);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
        <span>Loading financial engine model...</span>
      </div>
    );
  }

  const b = data.baseline;
  const i = data.interventions;
  const a = data.assumptions;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Financial Impact & Unit Economics Engine
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Grounded in exact take-home assignment business assumptions and trade-off economics.
          </p>
        </div>
      </div>

      {/* Core Unit Economics Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Operational RTO Loss Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              Operational Cost per RTO Order
            </span>
            <span className="text-2xl font-black text-rose-600 font-mono">
              ₹{b.operational_rto_loss_per_rto.toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Every Cash-on-Delivery parcel that fails delivery and returns to the warehouse triggers four distinct cost centers:
          </p>

          <div className="space-y-2 text-xs pt-1">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-700">Forward Shipping Charge:</span>
              <span className="font-mono font-bold text-slate-900">₹{a.forward_shipping.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-700">Return Reverse Shipping Charge:</span>
              <span className="font-mono font-bold text-slate-900">₹{a.return_shipping.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-700">Packaging, Label & Handling:</span>
              <span className="font-mono font-bold text-slate-900">₹{a.packaging_handling.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50/60 border border-rose-100">
              <div>
                <span className="text-rose-950 font-medium">Product Damage / Transit Shrinkage:</span>
                <span className="block text-[10px] text-rose-700">8% damage rate &times; ₹180 average product cost</span>
              </div>
              <span className="font-mono font-bold text-rose-900">₹{b.damage_cost_per_rto.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 italic border-t border-slate-100 pt-3">
            * Note: As specified, the 8% damage applies per returned RTO item, not total monthly sales.
          </div>
        </div>

        {/* Card 2: Delivered Order Gross Profit & Trade-Off Threshold */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Delivered Gross Profit & Breakeven
            </span>
            <span className="text-2xl font-black text-emerald-600 font-mono">
              ₹{b.gross_profit_per_delivered_order.toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            A delivered ₹649 AOV order delivers 62% gross profit. The Operations vs Marketing trade-off dictates:
          </p>

          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 space-y-2 text-xs">
            <div className="font-bold flex items-center gap-1.5 text-blue-900">
              <Scale className="w-4 h-4 text-blue-600" />
              <span>The 70.36% Breakeven Cancellation Rule</span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Cancelling a genuine order destroys <strong>₹402.38</strong> in gross profit.
              Preventing an RTO saves <strong>₹169.40</strong>.
              Therefore, cancelling is ONLY financially rational if predicted RTO risk exceeds:
            </p>
            <div className="font-mono font-bold text-center text-sm bg-white p-1.5 rounded-md border border-blue-200 text-blue-900">
              ₹402.38 / (₹402.38 + ₹169.40) = 70.36%
            </div>
            <p className="text-[11px] text-blue-800">
              This mathematical reality proves why first-time customers must NEVER be blocked automatically, and why WhatsApp Confirmation and Prepaid Nudging are far superior interventions!
            </p>
          </div>
        </div>
      </div>

      {/* Net Financial Impact Summary Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Intervention Ledger: Honest Financial Accounting
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              Net Financial Benefit Breakdown
            </h3>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium">Net Estimated Gain</span>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              +₹{Math.round(i.net_financial_impact).toLocaleString('en-IN')}{' '}
              <span className="text-xs text-emerald-700 font-sans font-bold">/ month</span>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Financial Flow Component</th>
                <th className="py-2.5 px-4">Driver / Mechanism</th>
                <th className="py-2.5 px-4">Assumptions & Basis</th>
                <th className="py-2.5 px-4 text-right">Net Impact (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* Savings */}
              <tr className="bg-emerald-50/30">
                <td className="py-3 px-4 font-semibold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Prevented RTO Shipping Savings</span>
                </td>
                <td className="py-3 px-4">
                  Intercepted chronic RTO buyers + converted prepaid orders (4% RTO)
                </td>
                <td className="py-3 px-4 text-slate-500">
                  ₹169.40 operational loss avoided per prevented return
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                  +₹{Math.round(i.estimated_rto_savings).toLocaleString('en-IN')}
                </td>
              </tr>

              {/* Sacrificed Gross Profit */}
              <tr>
                <td className="py-3 px-4 font-semibold text-rose-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Sacrificed Gross Margin (Genuine Orders)</span>
                </td>
                <td className="py-3 px-4">
                  Unavoidable false-positive cancellation leakage
                </td>
                <td className="py-3 px-4 text-slate-500">
                  {i.estimated_genuine_orders_lost} estimated genuine orders &times; ₹402.38 margin
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                  -₹{Math.round(i.sacrificed_gross_profit).toLocaleString('en-IN')}
                </td>
              </tr>

              {/* Prepaid Discounts */}
              <tr>
                <td className="py-3 px-4 font-semibold text-amber-950 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                  <span>Prepaid Conversion Discounts</span>
                </td>
                <td className="py-3 px-4">
                  Incentives paid to convert COD buyers to online prepaid
                </td>
                <td className="py-3 px-4 text-slate-500">
                  {i.prepaid_conversions} buyers &times; ₹50 instant discount
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                  -₹{Math.round(i.prepaid_discounts_cost).toLocaleString('en-IN')}
                </td>
              </tr>

              {/* CAC Loss */}
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  <span>Wasted Meta Ads Acquisition Cost</span>
                </td>
                <td className="py-3 px-4">
                  Marketing ad spend lost on cancelled genuine buyers
                </td>
                <td className="py-3 px-4 text-slate-500">
                  40% Meta Ads share &times; ₹300 CAC
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                  -₹{Math.round(i.sacrificed_cac_loss).toLocaleString('en-IN')}
                </td>
              </tr>

              {/* Total Row */}
              <tr className="bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-300">
                <td colSpan={3} className="py-3 px-4 text-sm">
                  Net Estimated Monthly Bottom-Line Gain:
                </td>
                <td className="py-3 px-4 text-right font-mono text-base text-emerald-700">
                  +₹{Math.round(i.net_financial_impact).toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Scenario Simulator */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Interactive What-If Scenario Simulator
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Simulate Changes to Volume, COD Share, & Shipping Costs
            </h3>
          </div>
          <button
            onClick={runSimulation}
            disabled={simLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            <Calculator className="w-4 h-4" />
            <span>{simLoading ? 'Simulating...' : 'Recalculate Scenario'}</span>
          </button>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-slate-600">Monthly Orders:</span>
              <span className="font-mono font-bold text-slate-900">{simMonthlyOrders.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={simMonthlyOrders}
              onChange={e => setSimMonthlyOrders(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-slate-600">COD Share %:</span>
              <span className="font-mono font-bold text-slate-900">{simCodShare}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="90"
              step="5"
              value={simCodShare}
              onChange={e => setSimCodShare(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-slate-600">Transit Damage Rate %:</span>
              <span className="font-mono font-bold text-slate-900">{simDamageRate}%</span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              step="1"
              value={simDamageRate}
              onChange={e => setSimDamageRate(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-slate-600">Forward Shipping (₹):</span>
              <span className="font-mono font-bold text-slate-900">₹{simForwardShipping}</span>
            </div>
            <input
              type="range"
              min="40"
              max="120"
              step="5"
              value={simForwardShipping}
              onChange={e => setSimForwardShipping(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-slate-600">Return Shipping (₹):</span>
              <span className="font-mono font-bold text-slate-900">₹{simReturnShipping}</span>
            </div>
            <input
              type="range"
              min="40"
              max="120"
              step="5"
              value={simReturnShipping}
              onChange={e => setSimReturnShipping(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-slate-600">Prepaid Discount (₹):</span>
              <span className="font-mono font-bold text-slate-900">₹{simPrepaidDiscount}</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="10"
              value={simPrepaidDiscount}
              onChange={e => setSimPrepaidDiscount(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        {/* Simulation Output Comparison */}
        {simulatedData && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mt-4 space-y-3">
            <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Simulation Comparison Results:
            </h5>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Operational RTO Loss:</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  ₹{simulatedData.simulated_scenario.baseline.operational_rto_loss_per_rto.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Delta: {simulatedData.difference.operational_loss_per_rto_delta > 0 ? '+' : ''}
                  ₹{simulatedData.difference.operational_loss_per_rto_delta.toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Simulated RTO Savings:</span>
                <span className="text-base font-bold text-emerald-700 font-mono">
                  ₹{Math.round(simulatedData.simulated_scenario.interventions.estimated_rto_savings).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">
                  Delta: {simulatedData.difference.rto_savings_delta > 0 ? '+' : ''}
                  ₹{Math.round(simulatedData.difference.rto_savings_delta).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Net Monthly Impact:</span>
                <span className="text-base font-bold text-blue-700 font-mono">
                  +₹{Math.round(simulatedData.simulated_scenario.interventions.net_financial_impact).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-blue-600 block mt-0.5">
                  Delta: {simulatedData.difference.net_financial_delta > 0 ? '+' : ''}
                  ₹{Math.round(simulatedData.difference.net_financial_delta).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
