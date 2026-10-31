import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../server/server.js';
import { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns healthy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health'
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
  });

  it('GET /api/dashboard/stats returns real KPI figures and financials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/stats'
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.kpi.total_orders).toBeGreaterThan(0);
    expect(body.financials.baseline.operational_rto_loss_per_rto).toBe(169.40);
  });

  it('GET /api/orders supports search and filtering', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orders?limit=5'
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.orders.length).toBeLessThanOrEqual(5);
    expect(body.pagination.total).toBeGreaterThan(0);
  });

  it('POST /api/orders creates and scores a new simulated COD order', async () => {
    const newOrder = {
      customer_name: 'Rohit Verma',
      phone: '9811223344',
      address: 'Flat 304, Green Heights, Ring Road',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      order_value: 899,
      items: 'Heatless Curling Set',
      num_items: 1,
      customer_prior_orders: 0,
      customer_prior_rto: 0,
      utm_source: 'meta_ads'
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: newOrder
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.decision.risk_score).toBeDefined();
    expect(body.decision.action).toBeDefined();
    expect(body.order.id).toBeDefined();
  });

  it('POST /api/orders/:id/override records manual override with audit trail', async () => {
    // Get an order
    const listRes = await app.inject({ method: 'GET', url: '/api/orders?limit=1' });
    const orderId = JSON.parse(listRes.body).orders[0].id;

    const overrideRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/override`,
      payload: {
        override_action: 'SHIP_AS_IS',
        override_reason: 'VIP customer confirmed via direct phone call',
        override_by: 'Senior Fraud Lead'
      }
    });

    expect(overrideRes.statusCode).toBe(200);
    const body = JSON.parse(overrideRes.body);
    expect(body.new_action).toBe('SHIP_AS_IS');
  });

  it('GET /api/settings and PUT /api/settings updates thresholds with validation', async () => {
    const getRes = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(getRes.statusCode).toBe(200);
    const settings = JSON.parse(getRes.body);
    expect(settings.thresholds).toBeDefined();
    expect(settings.ai_config).toBeDefined();
    expect(settings.ai_config.data.provider).toBe('groq');
    expect(settings.ai_config.data.model).toBe('openai/gpt-oss-120b');
    expect(typeof settings.ai_config.has_api_key).toBe('boolean');

    // Valid update for thresholds
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/settings/thresholds',
      payload: {
        ship_as_is_max: 20,
        ship_after_confirmation_max: 40,
        nudge_to_prepaid_max: 65,
        hold_cancel_min: 66
      }
    });
    expect(updateRes.statusCode).toBe(200);

    // Invalid non-ascending update should fail validation
    const badRes = await app.inject({
      method: 'PUT',
      url: '/api/settings/thresholds',
      payload: {
        ship_as_is_max: 50,
        ship_after_confirmation_max: 20, // invalid: less than ship_as_is_max
        nudge_to_prepaid_max: 70,
        hold_cancel_min: 80
      }
    });
    expect(badRes.statusCode).toBe(400);
  });
});
