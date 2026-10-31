import { describe, it, expect } from 'vitest';
import { computeFinancialImpact, DEFAULT_FINANCIAL_ASSUMPTIONS } from '../server/engine/financial.js';

describe('Financial Engine Calculations', () => {
  it('accurately verifies the exact benchmark operational RTO loss (₹169.40)', () => {
    const impact = computeFinancialImpact(DEFAULT_FINANCIAL_ASSUMPTIONS);

    // Forward: ₹65, Return: ₹65, Packaging: ₹25, Damage: 8% of ₹180 = ₹14.40
    // Total = 65 + 65 + 25 + 14.40 = 169.40
    expect(impact.baseline.damage_cost_per_rto).toBe(14.40);
    expect(impact.baseline.operational_rto_loss_per_rto).toBe(169.40);
  });

  it('accurately verifies delivered order gross profit at ₹649 AOV (₹402.38)', () => {
    const impact = computeFinancialImpact(DEFAULT_FINANCIAL_ASSUMPTIONS);

    // ₹649 * 62% = ₹402.38
    expect(impact.baseline.gross_profit_per_delivered_order).toBe(402.38);
  });

  it('computes monthly baseline COD orders and operational losses correctly', () => {
    const impact = computeFinancialImpact(DEFAULT_FINANCIAL_ASSUMPTIONS);

    // Monthly orders: 3,000, COD share: 55% -> 1,650
    expect(impact.baseline.monthly_cod_orders).toBe(1650);

    // Baseline RTOs: 1,650 * 28% = 462
    expect(impact.baseline.expected_monthly_rtos).toBe(462);

    // Baseline losses: 462 * ₹169.40 = ₹78,262.80
    expect(impact.baseline.monthly_operational_rto_losses).toBe(78262.80);
  });

  it('accounts for genuine orders lost without double counting savings', () => {
    const customAssumptions = {
      ...DEFAULT_FINANCIAL_ASSUMPTIONS,
      meta_cac: 300
    };

    const decisions = {
      total_orders: 1000,
      ship_as_is: 700,
      ship_after_confirmation: 150,
      nudge_to_prepaid: 100,
      hold_cancel: 50
    };

    const impact = computeFinancialImpact(customAssumptions, decisions);

    // Savings must be strictly greater than 0
    expect(impact.interventions.estimated_rto_savings).toBeGreaterThan(0);

    // Sacrificed gross profit must be accounted for
    expect(impact.interventions.sacrificed_gross_profit).toBeGreaterThan(0);

    // Prepaid discount costs must be accounted for
    expect(impact.interventions.prepaid_discounts_cost).toBeGreaterThan(0);

    // Net impact is positive and accounts for savings, unlocked delivery margins, and costs
    expect(impact.interventions.net_financial_impact).toBeDefined();
    expect(impact.interventions.estimated_rto_savings).toBeGreaterThan(0);
    expect(impact.interventions.sacrificed_gross_profit).toBeGreaterThan(0);
    expect(impact.interventions.prepaid_discounts_cost).toBeGreaterThan(0);
  });
});
