import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/index.js';
import { computeFinancialImpact } from '../engine/financial.js';

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/api/dashboard/stats', async (request, reply) => {
    const db = getDatabase();
    const query = request.query as {
      period?: 'all' | 'yesterday' | '7d' | '30d';
      source?: 'all' | 'imported' | 'simulated';
    };

    let dateFilterSql = '';
    const now = '2026-09-30 23:59:59'; // End of historical dataset

    if (query.period === 'yesterday') {
      dateFilterSql = `AND o.order_datetime >= '2026-09-29 00:00:00' AND o.order_datetime <= '2026-09-29 23:59:59'`;
    } else if (query.period === '7d') {
      dateFilterSql = `AND o.order_datetime >= '2026-09-23 00:00:00'`;
    } else if (query.period === '30d') {
      dateFilterSql = `AND o.order_datetime >= '2026-09-01 00:00:00'`;
    }

    let sourceFilterSql = '';
    if (query.source === 'imported') {
      sourceFilterSql = `AND o.is_imported_historical = 1`;
    } else if (query.source === 'simulated') {
      sourceFilterSql = `AND o.is_imported_historical = 0`;
    }

    const baseSql = `
      FROM orders o
      LEFT JOIN decisions d ON d.order_id = o.id
      WHERE 1=1 ${dateFilterSql} ${sourceFilterSql}
    `;

    // 1. KPI Counts
    const totals = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN d.action = 'SHIP_AS_IS' THEN 1 ELSE 0 END) as ship_as_is,
        SUM(CASE WHEN d.action = 'SHIP_AFTER_CONFIRMATION' THEN 1 ELSE 0 END) as ship_after_confirmation,
        SUM(CASE WHEN d.action = 'NUDGE_TO_PREPAID' THEN 1 ELSE 0 END) as nudge_to_prepaid,
        SUM(CASE WHEN d.action = 'HOLD_CANCEL' THEN 1 ELSE 0 END) as hold_cancel,
        SUM(CASE WHEN o.final_status = 'RTO' THEN 1 ELSE 0 END) as total_rtos,
        SUM(CASE WHEN o.final_status = 'DELIVERED' THEN 1 ELSE 0 END) as total_delivered,
        SUM(CASE WHEN o.final_status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as total_in_transit,
        ROUND(AVG(d.risk_score), 1) as avg_risk_score,
        SUM(CASE WHEN d.ai_used = 1 THEN 1 ELSE 0 END) as ai_evaluated_orders,
        SUM(CASE WHEN d.is_manual_override = 1 THEN 1 ELSE 0 END) as manual_overrides
      ${baseSql}
    `).get() as any;

    const completed = (totals.total_delivered || 0) + (totals.total_rtos || 0);
    const overallRtoRate = completed > 0 ? (totals.total_rtos / completed) * 100 : 0;

    // Fetch financial settings
    const finSetting = db.prepare(`SELECT value FROM settings WHERE key = 'financial_assumptions'`).get() as any;
    const finAssumptions = finSetting ? JSON.parse(finSetting.value) : undefined;

    // Financial engine calculations based on live decision distribution
    const finMetrics = computeFinancialImpact(finAssumptions, {
      total_orders: totals.total_orders || 0,
      ship_as_is: totals.ship_as_is || 0,
      ship_after_confirmation: totals.ship_after_confirmation || 0,
      nudge_to_prepaid: totals.nudge_to_prepaid || 0,
      hold_cancel: totals.hold_cancel || 0
    });

    return {
      kpi: {
        total_orders: totals.total_orders || 0,
        ship_as_is: totals.ship_as_is || 0,
        ship_after_confirmation: totals.ship_after_confirmation || 0,
        nudge_to_prepaid: totals.nudge_to_prepaid || 0,
        hold_cancel: totals.hold_cancel || 0,
        total_rtos: totals.total_rtos || 0,
        total_delivered: totals.total_delivered || 0,
        overall_rto_rate: Number(overallRtoRate.toFixed(2)),
        avg_risk_score: totals.avg_risk_score || 0,
        ai_evaluated_orders: totals.ai_evaluated_orders || 0,
        manual_overrides: totals.manual_overrides || 0
      },
      financials: finMetrics
    };
  });

  fastify.get('/api/dashboard/charts', async (request, reply) => {
    const db = getDatabase();

    // 1. Daily order trend by decision action
    const dailyTrend = db.prepare(`
      SELECT
        substr(o.order_datetime, 1, 10) as date,
        COUNT(*) as total,
        SUM(CASE WHEN d.action = 'SHIP_AS_IS' THEN 1 ELSE 0 END) as ship_as_is,
        SUM(CASE WHEN d.action = 'SHIP_AFTER_CONFIRMATION' THEN 1 ELSE 0 END) as ship_after_confirmation,
        SUM(CASE WHEN d.action = 'NUDGE_TO_PREPAID' THEN 1 ELSE 0 END) as nudge_to_prepaid,
        SUM(CASE WHEN d.action = 'HOLD_CANCEL' THEN 1 ELSE 0 END) as hold_cancel,
        SUM(CASE WHEN o.final_status = 'RTO' THEN 1 ELSE 0 END) as rtos
      FROM orders o
      JOIN decisions d ON d.order_id = o.id
      GROUP BY substr(o.order_datetime, 1, 10)
      ORDER BY date ASC
    `).all();

    // 2. RTO by Courier
    const courierRto = db.prepare(`
      SELECT
        o.courier,
        COUNT(*) as total,
        SUM(CASE WHEN o.final_status = 'RTO' THEN 1 ELSE 0 END) as rtos,
        ROUND(AVG(CASE WHEN o.final_status = 'RTO' THEN 1.0 ELSE 0.0 END) * 100, 2) as rto_rate,
        ROUND(AVG(d.risk_score), 1) as avg_risk_score
      FROM orders o
      JOIN decisions d ON d.order_id = o.id
      WHERE o.courier IS NOT NULL
      GROUP BY o.courier
      ORDER BY total DESC
    `).all();

    // 3. RTO by City (Top 10)
    const cityRto = db.prepare(`
      SELECT
        o.city,
        COUNT(*) as total,
        SUM(CASE WHEN o.final_status = 'RTO' THEN 1 ELSE 0 END) as rtos,
        ROUND(AVG(CASE WHEN o.final_status = 'RTO' THEN 1.0 ELSE 0.0 END) * 100, 2) as rto_rate,
        ROUND(AVG(d.risk_score), 1) as avg_risk_score
      FROM orders o
      JOIN decisions d ON d.order_id = o.id
      WHERE o.city IS NOT NULL AND o.city != ''
      GROUP BY o.city
      ORDER BY total DESC
      LIMIT 10
    `).all();

    // 4. UTM Source Breakdown
    const utmStats = db.prepare(`
      SELECT
        o.utm_source,
        COUNT(*) as total,
        SUM(CASE WHEN o.final_status = 'RTO' THEN 1 ELSE 0 END) as rtos,
        ROUND(AVG(CASE WHEN o.final_status = 'RTO' THEN 1.0 ELSE 0.0 END) * 100, 2) as rto_rate,
        ROUND(AVG(d.risk_score), 1) as avg_risk_score
      FROM orders o
      JOIN decisions d ON d.order_id = o.id
      GROUP BY o.utm_source
      ORDER BY total DESC
    `).all();

    // 5. Decision Distribution
    const decisionDist = db.prepare(`
      SELECT
        d.action,
        COUNT(*) as count,
        ROUND(AVG(d.risk_score), 1) as avg_score,
        ROUND(AVG(CASE WHEN o.final_status = 'RTO' THEN 1.0 ELSE 0.0 END) * 100, 2) as actual_rto_rate
      FROM decisions d
      JOIN orders o ON d.order_id = o.id
      GROUP BY d.action
      ORDER BY avg_score ASC
    `).all();

    return {
      daily_trend: dailyTrend,
      courier_rto: courierRto,
      city_rto: cityRto,
      utm_stats: utmStats,
      decision_distribution: decisionDist
    };
  });
}
