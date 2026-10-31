import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../db/index.js';

const ThresholdsUpdateSchema = z.object({
  ship_as_is_max: z.number().min(0).max(100),
  ship_after_confirmation_max: z.number().min(0).max(100),
  nudge_to_prepaid_max: z.number().min(0).max(100),
  hold_cancel_min: z.number().min(0).max(100)
}).refine(data => {
  return (
    data.ship_as_is_max < data.ship_after_confirmation_max &&
    data.ship_after_confirmation_max < data.nudge_to_prepaid_max &&
    data.nudge_to_prepaid_max < data.hold_cancel_min
  );
}, { message: 'Threshold boundaries must be strictly ascending (ship_as_is < confirm < prepaid < cancel)' });

const FinancialAssumptionsSchema = z.object({
  monthly_orders: z.number().min(1),
  cod_share_pct: z.number().min(0).max(100),
  cod_rto_rate_pct: z.number().min(0).max(100),
  prepaid_rto_rate_pct: z.number().min(0).max(100),
  aov: z.number().min(1),
  gross_margin_pct: z.number().min(0).max(100),
  forward_shipping: z.number().min(0),
  return_shipping: z.number().min(0),
  packaging_handling: z.number().min(0),
  product_damage_pct: z.number().min(0).max(100),
  avg_product_cost: z.number().min(0),
  meta_cac: z.number().min(0)
});

const WhatsAppConfigSchema = z.object({
  confirmation_timeout_hours: z.number().min(1).max(72),
  prepaid_discount_amount: z.number().min(0),
  prepaid_discount_percent: z.number().min(0).max(100),
  default_language: z.enum(['english', 'hinglish'])
});

const LocationThresholdsSchema = z.object({
  min_sample_size: z.number().min(1).max(100),
  bayes_prior_weight: z.number().min(1).max(100)
});

const AIConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.string().default('groq'),
  model: z.string().default('openai/gpt-oss-120b'),
  use_mock_fallback: z.boolean().default(true)
});

export async function settingsRoutes(fastify: FastifyInstance) {
  const db = getDatabase();

  // Get all settings
  fastify.get('/api/settings', async (request, reply) => {
    const rows = db.prepare('SELECT key, value, description, updated_at FROM settings').all() as any[];
    const result: Record<string, any> = {};

    for (const row of rows) {
      try {
        result[row.key] = {
          data: JSON.parse(row.value),
          description: row.description,
          updated_at: row.updated_at
        };
      } catch {
        result[row.key] = {
          data: row.value,
          description: row.description,
          updated_at: row.updated_at
        };
      }
    }

    // Add API key status without exposing the key
    const hasApiKey = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '');
    if (result.ai_config) {
      result.ai_config.has_api_key = hasApiKey;
    }

    return result;
  });

  // Update specific setting key
  fastify.put('/api/settings/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const body = request.body;

    let validatedData: any = body;

    if (key === 'thresholds') {
      const parsed = ThresholdsUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid thresholds', details: parsed.error.flatten() });
      }
      validatedData = parsed.data;
    } else if (key === 'financial_assumptions') {
      const parsed = FinancialAssumptionsSchema.safeParse(body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid financial assumptions', details: parsed.error.flatten() });
      }
      validatedData = parsed.data;
    } else if (key === 'whatsapp_config') {
      const parsed = WhatsAppConfigSchema.safeParse(body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid whatsapp config', details: parsed.error.flatten() });
      }
      validatedData = parsed.data;
    } else if (key === 'location_thresholds') {
      const parsed = LocationThresholdsSchema.safeParse(body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid location thresholds', details: parsed.error.flatten() });
      }
      validatedData = parsed.data;
    } else if (key === 'ai_config') {
      const parsed = AIConfigSchema.safeParse(body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid AI config', details: parsed.error.flatten() });
      }
      validatedData = parsed.data;
    }

    const jsonValue = JSON.stringify(validatedData);

    db.prepare(`
      INSERT INTO settings (key, value, description, updated_at)
      VALUES (?, ?, '', datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `).run(key, jsonValue);

    return {
      message: `Setting "${key}" updated successfully`,
      key,
      data: validatedData
    };
  });
}
