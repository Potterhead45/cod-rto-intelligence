export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  order_datetime TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  pincode TEXT,
  order_value REAL NOT NULL,
  items TEXT NOT NULL,
  num_items INTEGER NOT NULL,
  customer_prior_orders INTEGER NOT NULL,
  customer_prior_rto INTEGER NOT NULL,
  utm_source TEXT NOT NULL,
  courier TEXT,
  payment_method TEXT NOT NULL DEFAULT 'COD',
  final_status TEXT NOT NULL,
  is_imported_historical INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(final_status);
CREATE INDEX IF NOT EXISTS idx_orders_datetime ON orders(order_datetime);
CREATE INDEX IF NOT EXISTS idx_orders_imported ON orders(is_imported_historical);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  risk_score REAL NOT NULL,
  action TEXT NOT NULL,
  explanation TEXT NOT NULL,
  factors_json TEXT NOT NULL,
  ai_used INTEGER NOT NULL DEFAULT 0,
  ai_reasoning TEXT,
  is_manual_override INTEGER NOT NULL DEFAULT 0,
  override_action TEXT,
  override_reason TEXT,
  override_by TEXT,
  override_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_decisions_order ON decisions(order_id);
CREATE INDEX IF NOT EXISTS idx_decisions_action ON decisions(action);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  sender TEXT NOT NULL,
  message_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'hinglish',
  status TEXT NOT NULL DEFAULT 'sent',
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_order ON whatsapp_messages(order_id);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  order_id TEXT PRIMARY KEY,
  workflow_type TEXT NOT NULL,
  state TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'hinglish',
  offer_discount REAL DEFAULT 0,
  payment_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  timeout_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL
);
`;
