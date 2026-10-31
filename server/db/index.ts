import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CREATE_TABLES_SQL } from './schema.js';

let dbInstance: DatabaseType | null = null;

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'cod_rto.sqlite');

export function getDatabase(): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  // Initialize schema
  dbInstance.exec(CREATE_TABLES_SQL);

  // Initialize default settings if not exists
  initDefaultSettings(dbInstance);

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function initDefaultSettings(db: DatabaseType) {
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, description, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `);

  const defaults = [
    {
      key: 'thresholds',
      value: JSON.stringify({
        ship_as_is_max: 24,
        ship_after_confirmation_max: 44,
        nudge_to_prepaid_max: 69,
        hold_cancel_min: 70
      }),
      description: 'Risk score boundaries for decision actions (0-100 scale)'
    },
    {
      key: 'weights',
      value: JSON.stringify({
        prior_rto_weight: 40,
        address_quality_weight: 25,
        location_risk_weight: 20,
        order_value_weight: 15,
        channel_risk_weight: 10
      }),
      description: 'Relative weights and impact points for risk factors'
    },
    {
      key: 'whatsapp_config',
      value: JSON.stringify({
        confirmation_timeout_hours: 24,
        prepaid_discount_amount: 50,
        prepaid_discount_percent: 10,
        default_language: 'hinglish'
      }),
      description: 'WhatsApp simulator configuration and timeout settings'
    },
    {
      key: 'financial_assumptions',
      value: JSON.stringify({
        monthly_orders: 3000,
        cod_share_pct: 55,
        cod_rto_rate_pct: 28.0,
        prepaid_rto_rate_pct: 4.0,
        aov: 649,
        gross_margin_pct: 62.0,
        forward_shipping: 65,
        return_shipping: 65,
        packaging_handling: 25,
        product_damage_pct: 8.0,
        avg_product_cost: 180,
        meta_cac: 300
      }),
      description: 'Founder business metrics and operational cost assumptions'
    },
    {
      key: 'ai_config',
      value: JSON.stringify({
        enabled: true,
        provider: 'groq',
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        use_mock_fallback: true
      }),
      description: 'AI integration configuration and fallback settings'
    },
    {
      key: 'location_thresholds',
      value: JSON.stringify({
        min_sample_size: 15,
        bayes_prior_weight: 15
      }),
      description: 'Empirical Bayes smoothing hyper-parameters to avoid small-sample volatility'
    }
  ];

  const transaction = db.transaction(() => {
    for (const item of defaults) {
      insertSetting.run(item.key, item.value, item.description);
    }
  });

  transaction();
}
