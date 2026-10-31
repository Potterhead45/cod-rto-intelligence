import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { CREATE_TABLES_SQL } from '../server/db/schema.js';
import { WhatsAppSimulator } from '../server/engine/whatsapp.js';

describe('WhatsApp Simulator Workflows', () => {
  let db: any;
  let simulator: WhatsAppSimulator;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(CREATE_TABLES_SQL);
    simulator = new WhatsAppSimulator(db);

    // Insert dummy order
    db.prepare(`
      INSERT INTO orders (
        id, order_id, order_datetime, customer_name, phone, address, city, state, pincode,
        order_value, items, num_items, customer_prior_orders, customer_prior_rto,
        utm_source, courier, payment_method, final_status, is_imported_historical, created_at
      ) VALUES (
        'TEST_ORD_01', 'TEST_ORD_01', '2026-09-30 12:00', 'Ananya Sharma', '9876543210',
        'House 22, Sector 10', 'Delhi', 'Delhi', '110001',
        649, 'Satin Pillowcase', 1, 0, 0,
        'meta_ads', 'Delhivery', 'COD', 'IN_TRANSIT', 0, datetime('now')
      )
    `).run();
  });

  it('handles SHIP_AFTER_CONFIRMATION workflow with YES reply', () => {
    const conv = simulator.startWorkflow('TEST_ORD_01', 'SHIP_AFTER_CONFIRMATION', 'hinglish');
    expect(conv.state).toBe('AWAITING_CONFIRMATION');
    expect(conv.messages.length).toBe(1);

    const updated = simulator.processCustomerReply('TEST_ORD_01', 'YES please confirm');
    expect(updated.state).toBe('CONFIRMED');

    // Order status should be updated
    const order = db.prepare('SELECT final_status FROM orders WHERE id = ?').get('TEST_ORD_01') as any;
    expect(order.final_status).toBe('DELIVERED');
  });

  it('handles SHIP_AFTER_CONFIRMATION workflow with NO reply', () => {
    simulator.startWorkflow('TEST_ORD_01', 'SHIP_AFTER_CONFIRMATION', 'english');
    const updated = simulator.processCustomerReply('TEST_ORD_01', 'No cancel it');
    expect(updated.state).toBe('DECLINED');

    const order = db.prepare('SELECT final_status FROM orders WHERE id = ?').get('TEST_ORD_01') as any;
    expect(order.final_status).toBe('CANCELLED');
  });

  it('prompts user when random or ambiguous reply is received', () => {
    simulator.startWorkflow('TEST_ORD_01', 'SHIP_AFTER_CONFIRMATION', 'hinglish');
    const updated = simulator.processCustomerReply('TEST_ORD_01', 'Kab tak deliver hoga?');

    expect(updated.state).toBe('AWAITING_CONFIRMATION'); // state does not transition
    const lastMsg = updated.messages[updated.messages.length - 1];
    expect(lastMsg.sender).toBe('system');
    expect(lastMsg.message_text).toContain('YES');
  });

  it('handles 24-hour timeout cancellation', () => {
    simulator.startWorkflow('TEST_ORD_01', 'SHIP_AFTER_CONFIRMATION', 'english');
    const updated = simulator.simulateTimeout('TEST_ORD_01');

    expect(updated.state).toBe('TIMEOUT');
    const order = db.prepare('SELECT final_status FROM orders WHERE id = ?').get('TEST_ORD_01') as any;
    expect(order.final_status).toBe('CANCELLED');
  });

  it('handles NUDGE_TO_PREPAID workflow with payment success', () => {
    simulator.startWorkflow('TEST_ORD_01', 'NUDGE_TO_PREPAID', 'hinglish', 50);
    const step1 = simulator.processCustomerReply('TEST_ORD_01', 'PAY online link bhejo');
    expect(step1.state).toBe('AWAITING_PAYMENT');

    const step2 = simulator.simulatePayment('TEST_ORD_01', 'SUCCESS');
    expect(step2.state).toBe('PAYMENT_SUCCESS');
    expect(step2.payment_status).toBe('COMPLETED');

    const order = db.prepare('SELECT payment_method, order_value FROM orders WHERE id = ?').get('TEST_ORD_01') as any;
    expect(order.payment_method).toBe('PREPAID');
    expect(order.order_value).toBe(599); // 649 - 50 discount
  });

  it('handles NUDGE_TO_PREPAID workflow with payment failure', () => {
    simulator.startWorkflow('TEST_ORD_01', 'NUDGE_TO_PREPAID', 'english', 50);
    simulator.processCustomerReply('TEST_ORD_01', 'PAY');
    const failed = simulator.simulatePayment('TEST_ORD_01', 'FAILED');

    expect(failed.state).toBe('PAYMENT_FAILED');
    expect(failed.payment_status).toBe('FAILED');

    // Payment method remains COD
    const order = db.prepare('SELECT payment_method FROM orders WHERE id = ?').get('TEST_ORD_01') as any;
    expect(order.payment_method).toBe('COD');
  });

  it('handles duplicate responses and terminal state protections', () => {
    simulator.startWorkflow('TEST_ORD_01', 'SHIP_AFTER_CONFIRMATION', 'english');
    simulator.processCustomerReply('TEST_ORD_01', 'YES');

    // Customer sends a duplicate confirmation
    const duplicate = simulator.processCustomerReply('TEST_ORD_01', 'YES please hurry');
    expect(duplicate.state).toBe('CONFIRMED');
    const lastMsg = duplicate.messages[duplicate.messages.length - 1];
    expect(lastMsg.message_text).toContain('already confirmed');
  });

  it('handles customer response after 24-hour timeout expiration', () => {
    simulator.startWorkflow('TEST_ORD_01', 'SHIP_AFTER_CONFIRMATION', 'english');
    simulator.simulateTimeout('TEST_ORD_01');

    // Customer attempts to reply after timeout
    const postTimeout = simulator.processCustomerReply('TEST_ORD_01', 'YES');
    expect(postTimeout.state).toBe('TIMEOUT');
    const lastMsg = postTimeout.messages[postTimeout.messages.length - 1];
    expect(lastMsg.message_text).toContain('expired');
  });

  it('allows payment retry after failed payment and converts only upon success', () => {
    simulator.startWorkflow('TEST_ORD_01', 'NUDGE_TO_PREPAID', 'english', 50);
    simulator.processCustomerReply('TEST_ORD_01', 'PAY');
    simulator.simulatePayment('TEST_ORD_01', 'FAILED');

    // Customer replies RETRY
    const retried = simulator.processCustomerReply('TEST_ORD_01', 'RETRY payment');
    expect(retried.state).toBe('AWAITING_PAYMENT');

    // Second payment attempt succeeds
    const success = simulator.simulatePayment('TEST_ORD_01', 'SUCCESS');
    expect(success.state).toBe('PAYMENT_SUCCESS');
    const order = db.prepare('SELECT payment_method FROM orders WHERE id = ?').get('TEST_ORD_01') as any;
    expect(order.payment_method).toBe('PREPAID');
  });
});
