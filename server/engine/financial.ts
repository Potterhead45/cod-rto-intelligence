import { FinancialAssumptions } from './types.js';

export const DEFAULT_FINANCIAL_ASSUMPTIONS: FinancialAssumptions = {
  monthly_orders: 3000,
  cod_share_pct: 55.0,
  cod_rto_rate_pct: 28.0,
  prepaid_rto_rate_pct: 4.0,
  aov: 649.0,
  gross_margin_pct: 62.0,
  forward_shipping: 65.0,
  return_shipping: 65.0,
  packaging_handling: 25.0,
  product_damage_pct: 8.0,
  avg_product_cost: 180.0,
  meta_cac: 300.0
};

export interface FinancialImpactMetrics {
  assumptions: FinancialAssumptions;
  baseline: {
    monthly_cod_orders: number;
    expected_monthly_rtos: number;
    damage_cost_per_rto: number; // ₹14.40
    operational_rto_loss_per_rto: number; // ₹169.40
    gross_profit_per_delivered_order: number; // ₹402.38
    monthly_operational_rto_losses: number; // ₹78,262.80
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
  backtest_summary?: {
    total_orders_analyzed: number;
    ship_as_is_count: number;
    ship_after_confirmation_count: number;
    nudge_to_prepaid_count: number;
    hold_cancel_count: number;
    historical_rtos_intercepted: number;
    historical_delivered_impacted: number;
  };
}

export function computeFinancialImpact(
  assumptions: FinancialAssumptions = DEFAULT_FINANCIAL_ASSUMPTIONS,
  decisionsSummary?: {
    total_orders: number;
    ship_as_is: number;
    ship_after_confirmation: number;
    nudge_to_prepaid: number;
    hold_cancel: number;
    intercepted_rtos?: number;
    intercepted_delivered?: number;
  }
): FinancialImpactMetrics {
  const codShare = assumptions.cod_share_pct / 100.0;
  const codRtoRate = assumptions.cod_rto_rate_pct / 100.0;
  const grossMargin = assumptions.gross_margin_pct / 100.0;
  const damageRate = assumptions.product_damage_pct / 100.0;

  // 1. Core unit economics
  const monthlyCodOrders = assumptions.monthly_orders * codShare; // 1,650
  const expectedMonthlyRtos = monthlyCodOrders * codRtoRate; // 462
  const damageCostPerRto = damageRate * assumptions.avg_product_cost; // 0.08 * 180 = ₹14.40
  const operationalRtoLossPerRto =
    assumptions.forward_shipping +
    assumptions.return_shipping +
    assumptions.packaging_handling +
    damageCostPerRto; // 65 + 65 + 25 + 14.40 = ₹169.40

  const grossProfitPerDeliveredOrder = assumptions.aov * grossMargin; // 649 * 0.62 = ₹402.38
  const monthlyBaselineLosses = expectedMonthlyRtos * operationalRtoLossPerRto; // ₹78,262.80

  // 2. Decision distribution scaling
  let cancelRate = 0.06; // Default ~6% cancel
  let prepaidRate = 0.18; // Default ~18% prepaid nudge
  let confirmRate = 0.28; // Default ~28% confirmation

  let totalBacktestOrders = decisionsSummary?.total_orders || 2018;

  if (decisionsSummary && decisionsSummary.total_orders > 0) {
    cancelRate = decisionsSummary.hold_cancel / decisionsSummary.total_orders;
    prepaidRate = decisionsSummary.nudge_to_prepaid / decisionsSummary.total_orders;
    confirmRate = decisionsSummary.ship_after_confirmation / decisionsSummary.total_orders;
  }

  // Monthly scaled intervention volumes
  const monthlyCancelled = monthlyCodOrders * cancelRate;
  const monthlyPrepaidNudged = monthlyCodOrders * prepaidRate;
  const monthlyConfirmed = monthlyCodOrders * confirmRate;

  // Expected RTO prevention:
  // In cancelled orders (with average 74% empirical RTO probability in HOLD_CANCEL bucket):
  const cancelledRtoProb = 0.74;
  const preventedRtosFromCancel = monthlyCancelled * cancelledRtoProb;
  const genuineOrdersCancelled = monthlyCancelled * (1 - cancelledRtoProb);

  // In Prepaid Nudge (converts ~35% of nudged orders to prepaid, dropping RTO from 28% to 4%):
  const prepaidConversionRate = 0.35;
  const actualPrepaidConverted = monthlyPrepaidNudged * prepaidConversionRate;
  const rtoReductionInPrepaid = (assumptions.cod_rto_rate_pct - assumptions.prepaid_rto_rate_pct) / 100.0; // 0.24
  const preventedRtosFromPrepaid = actualPrepaidConverted * rtoReductionInPrepaid;
  // Margin gained from previously doomed COD orders that successfully deliver under prepaid:
  const marginGainedFromPrepaidDelivery = preventedRtosFromPrepaid * grossProfitPerDeliveredOrder;

  // In WhatsApp Confirmation (filters ~15% unresponsive/declined buyers before dispatch):
  const confirmationDropoffRate = 0.15;
  const unconfirmedOrders = monthlyConfirmed * confirmationDropoffRate;
  // These dropoffs have an ~70% RTO rate
  const preventedRtosFromConfirmation = unconfirmedOrders * 0.70;
  const genuineLostFromConfirmation = unconfirmedOrders * 0.30;

  // Total Prevented RTOs
  const totalPreventedRtos =
    preventedRtosFromCancel + preventedRtosFromPrepaid + preventedRtosFromConfirmation;
  const estimatedRtoSavings = totalPreventedRtos * operationalRtoLossPerRto;

  // Costs and Sacrifices:
  // 1. Prepaid discount cost (avg ₹50 per converted order)
  const discountAmount = 50.0;
  const prepaidDiscountsCost = actualPrepaidConverted * discountAmount;

  // 2. Genuine orders lost gross profit sacrificed
  const totalGenuineOrdersLost = genuineOrdersCancelled + genuineLostFromConfirmation;
  const sacrificedGrossProfit = totalGenuineOrdersLost * grossProfitPerDeliveredOrder;

  // 3. Informational CAC attribution (sunk marketing acquisition on unfulfilled orders)
  const metaShare = 0.40;
  const sacrificedCacLoss = totalGenuineOrdersLost * metaShare * assumptions.meta_cac;

  // Net Financial Impact = (Operational Savings + Unlocked Gross Margin on Converted Deliveries) - (Prepaid Discounts + Sacrificed Margin)
  const netFinancialImpact =
    estimatedRtoSavings + marginGainedFromPrepaidDelivery - prepaidDiscountsCost - sacrificedGrossProfit;

  const totalCost = prepaidDiscountsCost + sacrificedGrossProfit;
  const roiMultiple = totalCost > 0 ? (estimatedRtoSavings + marginGainedFromPrepaidDelivery) / totalCost : 1.0;

  return {
    assumptions,
    baseline: {
      monthly_cod_orders: Math.round(monthlyCodOrders),
      expected_monthly_rtos: Math.round(expectedMonthlyRtos),
      damage_cost_per_rto: Number(damageCostPerRto.toFixed(2)),
      operational_rto_loss_per_rto: Number(operationalRtoLossPerRto.toFixed(2)),
      gross_profit_per_delivered_order: Number(grossProfitPerDeliveredOrder.toFixed(2)),
      monthly_operational_rto_losses: Number(monthlyBaselineLosses.toFixed(2))
    },
    interventions: {
      orders_prevented_or_cancelled: Math.round(monthlyCancelled),
      estimated_rto_savings: Number(estimatedRtoSavings.toFixed(2)),
      prepaid_conversions: Math.round(actualPrepaidConverted),
      prepaid_discounts_cost: Number(prepaidDiscountsCost.toFixed(2)),
      estimated_genuine_orders_lost: Number(totalGenuineOrdersLost.toFixed(1)),
      sacrificed_gross_profit: Number(sacrificedGrossProfit.toFixed(2)),
      sacrificed_cac_loss: Number(sacrificedCacLoss.toFixed(2)),
      net_financial_impact: Number(netFinancialImpact.toFixed(2)),
      roi_multiple: Number(roiMultiple.toFixed(2))
    },
    backtest_summary: decisionsSummary
      ? {
          total_orders_analyzed: decisionsSummary.total_orders,
          ship_as_is_count: decisionsSummary.ship_as_is,
          ship_after_confirmation_count: decisionsSummary.ship_after_confirmation,
          nudge_to_prepaid_count: decisionsSummary.nudge_to_prepaid,
          hold_cancel_count: decisionsSummary.hold_cancel,
          historical_rtos_intercepted: decisionsSummary.intercepted_rtos || 0,
          historical_delivered_impacted: decisionsSummary.intercepted_delivered || 0
        }
      : undefined
  };
}
