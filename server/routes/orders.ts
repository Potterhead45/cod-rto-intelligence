import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../db/index.js';
import { evaluateOrderRisk } from '../engine/risk-scoring.js';

const CreateOrderSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  phone: z.string().min(8, 'Phone number is required'),
  address: z.string().min(3, 'Address is required'),
  city: z.string().default(''),
  state: z.string().default(''),
  pincode: z.string().default(''),
  order_value: z.number().min(0, 'Order value must be positive'),
  items: z.string().min(1, 'Item description is required'),
  num_items: z.number().int().min(1).default(1),
  customer_prior_orders: z.number().int().min(0).default(0),
  customer_prior_rto: z.number().int().min(0).default(0),
  utm_source: z.string().default('meta_ads'),
  courier: z.string().optional()
});

const OverrideSchema = z.object({
  override_action: z.enum(['SHIP_AS_IS', 'SHIP_AFTER_CONFIRMATION', 'NUDGE_TO_PREPAID', 'HOLD_CANCEL']),
  override_reason: z.string().min(3, 'Reason is required for audit trail'),
  override_by: z.string().default('Ops Manager')
});

export async function orderRoutes(fastify: FastifyInstance) {
  const db = getDatabase();

  // List orders with filtering and search
  fastify.get('/api/orders', async (request, reply) => {
    const query = request.query as {
      search?: string;
      action?: string;
      status?: string;
      source?: string;
      page?: string;
      limit?: string;
      sort_by?: string;
      sort_dir?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push('(o.order_id LIKE ? OR o.customer_name LIKE ? OR o.phone LIKE ?)');
      params.push(term, term, term);
    }

    if (query.action && query.action !== 'ALL') {
      conditions.push('d.action = ?');
      params.push(query.action);
    }

    if (query.status && query.status !== 'ALL') {
      conditions.push('o.final_status = ?');
      params.push(query.status);
    }

    if (query.source === 'imported') {
      conditions.push('o.is_imported_historical = 1');
    } else if (query.source === 'simulated') {
      conditions.push('o.is_imported_historical = 0');
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN decisions d ON d.order_id = o.id
      WHERE ${whereClause}
    `;
    const totalCount = (db.prepare(countSql).get(...params) as any).total;

    // Sort order
    let orderBy = 'o.order_datetime DESC';
    if (query.sort_by === 'risk_score') {
      orderBy = `d.risk_score ${query.sort_dir === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (query.sort_by === 'order_value') {
      orderBy = `o.order_value ${query.sort_dir === 'asc' ? 'ASC' : 'DESC'}`;
    }

    const selectSql = `
      SELECT
        o.id,
        o.order_id,
        o.order_datetime,
        o.customer_name,
        o.phone,
        o.address,
        o.city,
        o.state,
        o.pincode,
        o.order_value,
        o.items,
        o.num_items,
        o.customer_prior_orders,
        o.customer_prior_rto,
        o.utm_source,
        o.courier,
        o.payment_method,
        o.final_status,
        o.is_imported_historical,
        d.id as decision_id,
        d.risk_score,
        d.action,
        d.explanation,
        d.ai_used,
        d.is_manual_override,
        d.override_action,
        d.override_reason,
        d.override_by,
        d.override_at
      FROM orders o
      LEFT JOIN decisions d ON d.order_id = o.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const orders = db.prepare(selectSql).all(...params, limit, offset);

    return {
      orders,
      pagination: {
        total: totalCount,
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit)
      }
    };
  });

  // Get single order with complete risk factor breakdown & WhatsApp status
  fastify.get('/api/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const orderSql = `
      SELECT
        o.*,
        d.id as decision_id,
        d.risk_score,
        d.action,
        d.explanation,
        d.factors_json,
        d.ai_used,
        d.ai_reasoning,
        d.is_manual_override,
        d.override_action,
        d.override_reason,
        d.override_by,
        d.override_at
      FROM orders o
      LEFT JOIN decisions d ON d.order_id = o.id
      WHERE o.id = ? OR o.order_id = ?
    `;
    const order = db.prepare(orderSql).get(id, id) as any;

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    let factors = [];
    try {
      factors = order.factors_json ? JSON.parse(order.factors_json) : [];
    } catch {
      factors = [];
    }

    // Check if WhatsApp conversation exists
    const conversation = db
      .prepare('SELECT * FROM whatsapp_conversations WHERE order_id = ?')
      .get(order.id) as any;

    return {
      ...order,
      factors,
      whatsapp: conversation || null
    };
  });

  // Simulate a new Shopify COD order
  fastify.post('/api/orders', async (request, reply) => {
    const bodyResult = CreateOrderSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Invalid order input', details: bodyResult.error.flatten() });
    }

    const data = bodyResult.data;
    const nowIso = new Date().toISOString();
    const cleanDateTime = nowIso.replace('T', ' ').substring(0, 16);
    const newOrderId = `ORD-${Date.now().toString().slice(-6)}`;
    const uniqueId = newOrderId;

    // Fetch live thresholds from settings
    const threshSetting = db.prepare(`SELECT value FROM settings WHERE key = 'thresholds'`).get() as any;
    const thresholds = threshSetting ? JSON.parse(threshSetting.value) : undefined;

    // Run Decision Engine
    const decision = await evaluateOrderRisk(
      {
        order_id: uniqueId,
        customer_name: data.customer_name,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        order_value: data.order_value,
        items: data.items,
        num_items: data.num_items,
        customer_prior_orders: data.customer_prior_orders,
        customer_prior_rto: data.customer_prior_rto,
        utm_source: data.utm_source,
        courier: data.courier
      },
      { thresholds }
    );

    // Initial status: IN_TRANSIT or PENDING
    const initialStatus = decision.action === 'HOLD_CANCEL' ? 'CANCELLED' : 'IN_TRANSIT';

    // Insert into DB (is_imported_historical = 0)
    db.prepare(`
      INSERT INTO orders (
        id, order_id, order_datetime, customer_name, phone, address, city, state, pincode,
        order_value, items, num_items, customer_prior_orders, customer_prior_rto,
        utm_source, courier, payment_method, final_status, is_imported_historical, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, 'COD', ?, 0, datetime('now')
      )
    `).run(
      uniqueId,
      newOrderId,
      cleanDateTime,
      data.customer_name,
      data.phone,
      data.address,
      data.city || 'Unknown',
      data.state || 'Unknown',
      data.pincode || '',
      data.order_value,
      data.items,
      data.num_items,
      data.customer_prior_orders,
      data.customer_prior_rto,
      data.utm_source,
      data.courier || 'Delhivery',
      initialStatus
    );

    const decisionId = `dec_${uniqueId}`;
    db.prepare(`
      INSERT INTO decisions (
        id, order_id, risk_score, action, explanation, factors_json,
        ai_used, ai_reasoning, is_manual_override, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, 0, datetime('now')
      )
    `).run(
      decisionId,
      uniqueId,
      decision.risk_score,
      decision.action,
      decision.explanation,
      JSON.stringify(decision.factors),
      decision.ai_used ? 1 : 0,
      decision.ai_reasoning || null
    );

    return reply.code(201).send({
      message: 'New Shopify COD order created and scored successfully',
      order: {
        id: uniqueId,
        order_id: newOrderId,
        customer_name: data.customer_name,
        order_value: data.order_value,
        status: initialStatus
      },
      decision
    });
  });

  // Manual Override Endpoint
  fastify.post('/api/orders/:id/override', async (request, reply) => {
    const { id } = request.params as { id: string };
    const bodyResult = OverrideSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Invalid override request', details: bodyResult.error.flatten() });
    }

    const { override_action, override_reason, override_by } = bodyResult.data;

    // Verify order exists
    const order = db.prepare('SELECT id, final_status FROM orders WHERE id = ?').get(id) as any;
    if (!order) {
      return reply.code(404).send({ error: `Order ${id} not found` });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE decisions
      SET is_manual_override = 1,
          override_action = ?,
          override_reason = ?,
          override_by = ?,
          override_at = ?
      WHERE order_id = ?
    `).run(override_action, override_reason, override_by, now, id);

    // Update order status if overridden to HOLD_CANCEL
    if (override_action === 'HOLD_CANCEL') {
      db.prepare(`UPDATE orders SET final_status = 'CANCELLED' WHERE id = ?`).run(id);
    }

    return {
      message: 'Manual decision override recorded successfully',
      order_id: id,
      new_action: override_action,
      override_by,
      override_at: now
    };
  });
}
