import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { getDatabase } from './index.js';
import { evaluateOrderRisk } from '../engine/risk-scoring.js';
import { WhatsAppSimulator } from '../engine/whatsapp.js';

async function seed() {
  console.log('--- Starting COD RTO Intelligence Seeder ---');
  const db = getDatabase();

  const csvPath = path.join(process.cwd(), 'data', 'cleaned_orders.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Cleaned CSV not found at ${csvPath}. Run scripts/analyze_data.py first.`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Loaded ${records.length} records from cleaned CSV.`);

  // Check if already seeded
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any).count;
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} orders. Clearing for fresh seed...`);
    db.exec(`
      DELETE FROM whatsapp_messages;
      DELETE FROM whatsapp_conversations;
      DELETE FROM decisions;
      DELETE FROM orders;
    `);
  }

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, order_id, order_datetime, customer_name, phone, address, city, state, pincode,
      order_value, items, num_items, customer_prior_orders, customer_prior_rto,
      utm_source, courier, payment_method, final_status, is_imported_historical, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, 1, datetime('now')
    )
  `);

  const insertDecision = db.prepare(`
    INSERT INTO decisions (
      id, order_id, risk_score, action, explanation, factors_json,
      ai_used, ai_reasoning, is_manual_override, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, 0, datetime('now')
    )
  `);

  console.log('Scoring and inserting orders and decisions into SQLite...');

  const actionCounts = {
    SHIP_AS_IS: 0,
    SHIP_AFTER_CONFIRMATION: 0,
    NUDGE_TO_PREPAID: 0,
    HOLD_CANCEL: 0
  };

  // Pre-evaluate decisions asynchronously
  const evaluatedRows: Array<{ id: string; row: any; decision: any }> = [];
  const seenIds = new Map<string, number>();

  for (const row of records) {
    const rawOrderId = row.order_id;
    const count = seenIds.get(rawOrderId) || 0;
    seenIds.set(rawOrderId, count + 1);
    const uniqueId = count === 0 ? rawOrderId : `${rawOrderId}_dup_${count}`;

    const orderValue = parseFloat(row.order_value) || 0;
    const numItems = parseInt(row.num_items, 10) || 1;
    const priorOrders = parseInt(row.customer_prior_orders, 10) || 0;
    const priorRto = parseInt(row.customer_prior_rto, 10) || 0;

    const decision = await evaluateOrderRisk({
      order_id: uniqueId,
      customer_name: row.customer_name,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      order_value: orderValue,
      items: row.items,
      num_items: numItems,
      customer_prior_orders: priorOrders,
      customer_prior_rto: priorRto,
      utm_source: row.utm_source,
      courier: row.courier
    });

    actionCounts[decision.action]++;
    evaluatedRows.push({ id: uniqueId, row, decision });
  }

  const insertBatch = db.transaction((rows: Array<{ id: string; row: any; decision: any }>) => {
    let count = 0;
    for (const { id, row, decision } of rows) {
      const orderValue = parseFloat(row.order_value) || 0;
      const numItems = parseInt(row.num_items, 10) || 1;
      const priorOrders = parseInt(row.customer_prior_orders, 10) || 0;
      const priorRto = parseInt(row.customer_prior_rto, 10) || 0;

      insertOrder.run(
        id,
        row.order_id,
        row.order_datetime,
        row.customer_name,
        row.phone,
        row.address,
        row.city || 'Unknown',
        row.state || 'Unknown',
        row.pincode || '',
        orderValue,
        row.items,
        numItems,
        priorOrders,
        priorRto,
        row.utm_source,
        row.courier,
        row.payment_method || 'COD',
        row.final_status
      );

      const decisionId = `dec_${id}`;
      insertDecision.run(
        decisionId,
        id,
        decision.risk_score,
        decision.action,
        decision.explanation,
        JSON.stringify(decision.factors),
        decision.ai_used ? 1 : 0,
        decision.ai_reasoning || null
      );

      count++;
    }
    return count;
  });

  const totalSeeded = insertBatch(evaluatedRows);
  console.log(`Seeded ${totalSeeded} historical orders and decisions.`);
  console.log('Decision Breakdown on Historical Data:');
  for (const [action, count] of Object.entries(actionCounts)) {
    const pct = ((count / totalSeeded) * 100).toFixed(1);
    console.log(`  ${action}: ${count} (${pct}%)`);
  }

  // Seed sample WhatsApp simulations for demonstration
  console.log('Creating sample WhatsApp demo workflows...');
  const whatsapp = new WhatsAppSimulator(db);

  // Find a confirmation order and a prepaid order
  const confirmOrder = db.prepare(`SELECT order_id FROM decisions WHERE action = 'SHIP_AFTER_CONFIRMATION' LIMIT 1`).get() as any;
  if (confirmOrder) {
    const conv = whatsapp.startWorkflow(confirmOrder.order_id, 'SHIP_AFTER_CONFIRMATION', 'hinglish');
    whatsapp.processCustomerReply(confirmOrder.order_id, 'YES please dispatch soon');
    console.log(`Sample WhatsApp confirmation created for order ${confirmOrder.order_id}`);
  }

  const prepaidOrder = db.prepare(`SELECT order_id FROM decisions WHERE action = 'NUDGE_TO_PREPAID' LIMIT 1`).get() as any;
  if (prepaidOrder) {
    const conv = whatsapp.startWorkflow(prepaidOrder.order_id, 'NUDGE_TO_PREPAID', 'hinglish', 50);
    whatsapp.processCustomerReply(prepaidOrder.order_id, 'PAY online');
    whatsapp.simulatePayment(prepaidOrder.order_id, 'SUCCESS');
    console.log(`Sample WhatsApp prepaid nudge & payment success created for order ${prepaidOrder.order_id}`);
  }

  console.log('--- Database Seeding Completed Successfully ---');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
