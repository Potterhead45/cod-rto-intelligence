import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/index.js';
import { computeFinancialImpact, DEFAULT_FINANCIAL_ASSUMPTIONS } from '../engine/financial.js';

export async function financialRoutes(fastify: FastifyInstance) {
  const db = getDatabase();

  // Get current financial overview
  fastify.get('/api/financial/overview', async (request, reply) => {
    const finSetting = db.prepare(`SELECT value FROM settings WHERE key = 'financial_assumptions'`).get() as any;
    const assumptions = finSetting ? JSON.parse(finSetting.value) : DEFAULT_FINANCIAL_ASSUMPTIONS;

    // Get live decision breakdown
    const totals = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN action = 'SHIP_AS_IS' THEN 1 ELSE 0 END) as ship_as_is,
        SUM(CASE WHEN action = 'SHIP_AFTER_CONFIRMATION' THEN 1 ELSE 0 END) as ship_after_confirmation,
        SUM(CASE WHEN action = 'NUDGE_TO_PREPAID' THEN 1 ELSE 0 END) as nudge_to_prepaid,
        SUM(CASE WHEN action = 'HOLD_CANCEL' THEN 1 ELSE 0 END) as hold_cancel
      FROM decisions
    `).get() as any;

    const impact = computeFinancialImpact(assumptions, totals);
    return impact;
  });

  // What-If Financial Scenario Simulator
  fastify.post('/api/financial/simulate', async (request, reply) => {
    const body = (request.body || {}) as any;

    const finSetting = db.prepare(`SELECT value FROM settings WHERE key = 'financial_assumptions'`).get() as any;
    const baseAssumptions = finSetting ? JSON.parse(finSetting.value) : DEFAULT_FINANCIAL_ASSUMPTIONS;

    // Merge custom assumptions
    const simulatedAssumptions = {
      ...baseAssumptions,
      ...body.assumptions
    };

    // Get live decisions or allow simulated decision distribution
    const totals = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN action = 'SHIP_AS_IS' THEN 1 ELSE 0 END) as ship_as_is,
        SUM(CASE WHEN action = 'SHIP_AFTER_CONFIRMATION' THEN 1 ELSE 0 END) as ship_after_confirmation,
        SUM(CASE WHEN action = 'NUDGE_TO_PREPAID' THEN 1 ELSE 0 END) as nudge_to_prepaid,
        SUM(CASE WHEN action = 'HOLD_CANCEL' THEN 1 ELSE 0 END) as hold_cancel
      FROM decisions
    `).get() as any;

    const baseImpact = computeFinancialImpact(baseAssumptions, totals);
    const scenarioImpact = computeFinancialImpact(simulatedAssumptions, totals);

    return {
      baseline_scenario: baseImpact,
      simulated_scenario: scenarioImpact,
      difference: {
        net_financial_delta: Number(
          (scenarioImpact.interventions.net_financial_impact - baseImpact.interventions.net_financial_impact).toFixed(2)
        ),
        rto_savings_delta: Number(
          (scenarioImpact.interventions.estimated_rto_savings - baseImpact.interventions.estimated_rto_savings).toFixed(2)
        ),
        operational_loss_per_rto_delta: Number(
          (scenarioImpact.baseline.operational_rto_loss_per_rto - baseImpact.baseline.operational_rto_loss_per_rto).toFixed(2)
        )
      }
    };
  });
}
