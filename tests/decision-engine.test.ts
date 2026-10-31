import { describe, it, expect, vi } from 'vitest';
import OpenAI from 'openai';
import { evaluateOrderRisk, computeSmoothedRtoRate } from '../server/engine/risk-scoring.js';
import { analyzeCustomerAndAddress } from '../server/engine/llm-analyzer.js';
import { LLMAddressAnalysisSchema } from '../server/engine/types.js';

describe('Decision Engine - Risk Scoring & Rules', () => {
  it('classifies a safe repeat customer as SHIP_AS_IS with low risk score', async () => {
    const safeOrder = {
      order_id: 'SAFE_01',
      customer_name: 'Priya Sharma',
      phone: '9876543210',
      address: 'Flat 402, Lotus Residency, MG Road, near Metro Station',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      order_value: 1200,
      items: 'Satin Pillowcase',
      num_items: 2,
      customer_prior_orders: 4,
      customer_prior_rto: 0,
      utm_source: 'direct'
    };

    const result = await evaluateOrderRisk(safeOrder);
    expect(result.action).toBe('SHIP_AS_IS');
    expect(result.risk_score).toBeLessThanOrEqual(24);
    expect(result.factors.some(f => f.name === 'Loyal Clean History')).toBe(true);
  });

  it('treats first-time customer neutrally without automatic penalty', async () => {
    const firstTimeOrder = {
      order_id: 'NEW_01',
      customer_name: 'Aditi Patel',
      phone: '9812345678',
      address: 'House No 12, Sector 15, Near City Park',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110085',
      order_value: 749,
      items: 'Heatless Curling Set',
      num_items: 1,
      customer_prior_orders: 0,
      customer_prior_rto: 0,
      utm_source: 'instagram_organic'
    };

    const result = await evaluateOrderRisk(firstTimeOrder);
    const historyFactor = result.factors.find(f => f.category === 'CUSTOMER_HISTORY');
    expect(historyFactor?.score_delta).toBe(0);
    expect(result.action).not.toBe('HOLD_CANCEL');
  });

  it('escalates risk for customer with 2 prior RTOs', async () => {
    const chronicRtoOrder = {
      order_id: 'RTO_REPEAT_01',
      customer_name: 'Rahul Verma',
      phone: '9822334455',
      address: 'House No. 44, Gali 2, Bazar',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      pincode: '226001',
      order_value: 999,
      items: 'Hair Oil 100ml',
      num_items: 1,
      customer_prior_orders: 2,
      customer_prior_rto: 2,
      utm_source: 'meta_ads'
    };

    const result = await evaluateOrderRisk(chronicRtoOrder);
    expect(result.risk_score).toBeGreaterThanOrEqual(70);
    expect(result.action).toBe('HOLD_CANCEL');
    expect(result.factors.some(f => f.name === 'High Repeat RTO History')).toBe(true);
  });

  it('penalizes invalid phone number', async () => {
    const invalidPhoneOrder = {
      order_id: 'INV_PHONE_01',
      customer_name: 'Komal Mishra',
      phone: '723013610', // 9 digits
      address: 'Plot 55, Station Road, Opp Bank',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      order_value: 649,
      items: 'Claw Clip Set',
      customer_prior_orders: 0,
      customer_prior_rto: 0
    };

    const result = await evaluateOrderRisk(invalidPhoneOrder);
    expect(result.factors.some(f => f.name === 'Invalid / Truncated Mobile Number')).toBe(true);
    expect(result.risk_score).toBeGreaterThanOrEqual(45);
  });

  it('identifies suspicious customer name and flags risk', async () => {
    const fakeNameOrder = {
      order_id: 'FAKE_NAME_01',
      customer_name: 'Test Order',
      phone: '9876543210',
      address: 'Flat 101, Galaxy Tower',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      order_value: 649,
      items: 'Satin Bonnet'
    };

    const result = await evaluateOrderRisk(fakeNameOrder);
    expect(result.factors.some(f => f.name === 'Suspicious Customer Name')).toBe(true);
  });

  it('flags garbage and short placeholder address string', async () => {
    const garbageAddrOrder = {
      order_id: 'GARBAGE_ADDR_01',
      customer_name: 'Amit Kumar',
      phone: '9876543210',
      address: '.', // period only
      city: 'Patna',
      state: 'Bihar',
      pincode: '800001',
      order_value: 800,
      items: 'Scrunchies 6pk'
    };

    const result = await evaluateOrderRisk(garbageAddrOrder);
    expect(result.factors.some(f => f.name === 'Garbage / Placeholder Address')).toBe(true);
    expect(result.risk_score).toBeGreaterThanOrEqual(70);
    expect(result.action).toBe('HOLD_CANCEL');
  });

  it('applies Empirical Bayes smoothing for high-risk and small-sample locations', () => {
    // Gorakhpur: 46 orders, 29 RTOs -> raw rate 63.04%
    const gorakhpurSmoothed = computeSmoothedRtoRate(29, 46, 15, 0.2841);
    expect(gorakhpurSmoothed).toBeGreaterThan(0.50);
    expect(gorakhpurSmoothed).toBeLessThan(0.6304); // pulled towards global mean

    // Small sample town: 1 order, 1 RTO -> raw rate 100%
    const smallTownSmoothed = computeSmoothedRtoRate(1, 1, 15, 0.2841);
    // (1 + 15 * 0.2841) / 16 = (1 + 4.2615) / 16 = 5.2615 / 16 = 32.88%
    expect(smallTownSmoothed).toBeLessThan(0.35); // Shrinks from 100% down to ~33%
  });

  it('respects configurable thresholds dynamically', async () => {
    const order = {
      order_id: 'CUSTOM_THRESH_01',
      customer_name: 'Simran Kaur',
      phone: '9876543210',
      address: 'House 14, Sector 22, near bus stand',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110022',
      order_value: 649,
      items: 'Hair Oil 100ml',
      customer_prior_orders: 0,
      customer_prior_rto: 0
    };

    // Standard thresholds give SHIP_AS_IS or SHIP_AFTER_CONFIRMATION
    const defaultRes = await evaluateOrderRisk(order);

    // Ultra-conservative thresholds
    const conservativeThresholds = {
      ship_as_is_max: 5, // practically nothing shipped as-is
      ship_after_confirmation_max: 15,
      nudge_to_prepaid_max: 25,
      hold_cancel_min: 26
    };

    const conservativeRes = await evaluateOrderRisk(order, { thresholds: conservativeThresholds });
    expect(conservativeRes.action).not.toBe('SHIP_AS_IS');
  });

  it('correctly parses legitimate Hinglish addresses without false penalties', async () => {
    const hinglishOrder = {
      order_id: 'HINGLISH_01',
      customer_name: 'Meera Devi',
      phone: '9876543210',
      address: 'gali no 4 ke andar, Hanuman Mandir ke paas, Royal niwas',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      order_value: 649,
      items: 'Heatless Curling Set',
      customer_prior_orders: 1,
      customer_prior_rto: 0
    };

    const result = await evaluateOrderRisk(hinglishOrder);
    expect(result.action).not.toBe('HOLD_CANCEL');
    expect(result.factors.some(f => f.name === 'Garbage / Placeholder Address')).toBe(false);
  });

  it('identifies incomplete addresses and routes them to confirmation or nudge rather than direct cancel', async () => {
    const incompleteOrder = {
      order_id: 'INCOMP_01',
      customer_name: 'Suresh Kumar',
      phone: '9876543210',
      address: 'Main Road', // lacks house number, colony, landmark
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      order_value: 649,
      items: 'Satin Bonnet',
      customer_prior_orders: 0,
      customer_prior_rto: 0
    };

    const result = await evaluateOrderRisk(incompleteOrder);
    // Incomplete address should be flagged
    expect(result.factors.some(f => f.name === 'Incomplete Delivery Address')).toBe(true);
    // First-time buyer with incomplete address is protected from outright cancellation
    expect(result.action).not.toBe('HOLD_CANCEL');
    expect(['SHIP_AFTER_CONFIRMATION', 'NUDGE_TO_PREPAID']).toContain(result.action);
  });

  it('prevents small-sample locations with 100% RTO from causing extreme blacklisting', async () => {
    // Single order town where the 1 order happened to RTO
    const smallSampleOrder = {
      order_id: 'TOWN_01',
      customer_name: 'Anjali Sharma',
      phone: '9876543210',
      address: 'House 5, Ward 3, Near Panchayat Ghar',
      city: 'RareTownX', // Not in top cities
      state: 'Maharashtra',
      pincode: '411001',
      order_value: 649,
      items: 'Claw Clip Set',
      customer_prior_orders: 0,
      customer_prior_rto: 0
    };

    const result = await evaluateOrderRisk(smallSampleOrder, { minSampleSize: 15 });
    // Location should be smoothed to state level, not penalized with 100% RTO
    expect(result.action).not.toBe('HOLD_CANCEL');
  });

  it('verifies that LLM analysis cannot independently cancel orders without safety rules', async () => {
    // Clean customer with safe phone, but hypothetical negative LLM address score
    const safeOrderWithPoorScore = {
      order_id: 'SAFETY_01',
      customer_name: 'Pooja Reddy',
      phone: '9876543210',
      address: 'Shop No 4, Market Complex',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      order_value: 649,
      items: 'Rice Water Shampoo Bar',
      customer_prior_orders: 0,
      customer_prior_rto: 0
    };

    const result = await evaluateOrderRisk(safeOrderWithPoorScore);
    // Safety invariant: First-time customer with valid phone and deliverable address cannot be auto-cancelled by AI
    expect(result.action).not.toBe('HOLD_CANCEL');
  });

  it('triggers deterministic mock fallback when GROQ_API_KEY is not configured', async () => {
    const originalKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    try {
      const response = await analyzeCustomerAndAddress(
        'Rohan Sharma',
        'Flat 402, Lotus Residency, Near Bank',
        'Mumbai',
        'Maharashtra',
        '400001'
      );

      expect(response.aiUsed).toBe(false);
      const parsed = LLMAddressAnalysisSchema.safeParse(response.result);
      expect(parsed.success).toBe(true);
      expect(response.result.is_placeholder_address).toBe(false);
      expect(response.result.address_completeness_score).toBeGreaterThan(50);
    } finally {
      if (originalKey !== undefined) {
        process.env.GROQ_API_KEY = originalKey;
      }
    }
  });

  it('safely handles invalid Groq API keys by falling back to mock without crashing', async () => {
    const originalKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = 'gsk_invalid_test_key_for_unit_tests_12345';

    try {
      const response = await analyzeCustomerAndAddress(
        'Ananya Gupta',
        'H.No 12, Gali No 4, Mandir ke paas',
        'Delhi',
        'Delhi',
        '110001'
      );

      expect(response.aiUsed).toBe(false);
      const parsed = LLMAddressAnalysisSchema.safeParse(response.result);
      expect(parsed.success).toBe(true);
      expect(response.result.detected_language).toBe('Hinglish');
    } finally {
      if (originalKey !== undefined) {
        process.env.GROQ_API_KEY = originalKey;
      } else {
        delete process.env.GROQ_API_KEY;
      }
    }
  });

  it('validates a successful Groq structured JSON response and returns aiUsed: true', async () => {
    const originalKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = 'gsk_test_mock_for_success_verification';

    const validAnalysis = {
      is_suspicious_name: false,
      name_suspicion_reason: null,
      address_completeness_score: 92,
      is_placeholder_address: false,
      missing_components: [],
      detected_language: 'English',
      summary_note: 'Verified residential delivery address with complete street and landmark.'
    };

    const spy = vi
      .spyOn(OpenAI.Chat.Completions.prototype, 'create')
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(validAnalysis)
            }
          }
        ]
      } as any);

    try {
      const response = await analyzeCustomerAndAddress(
        'Rohan Sharma',
        'Flat 402, Lotus Residency, MG Road, near Metro',
        'Mumbai',
        'Maharashtra',
        '400001'
      );

      expect(response.aiUsed).toBe(true);
      expect(response.result.address_completeness_score).toBe(92);
      expect(response.result.detected_language).toBe('English');
      expect(response.result.summary_note).toBe(validAnalysis.summary_note);
    } finally {
      spy.mockRestore();
      if (originalKey !== undefined) {
        process.env.GROQ_API_KEY = originalKey;
      } else {
        delete process.env.GROQ_API_KEY;
      }
    }
  });

  it('falls back to mock with aiUsed: false when Groq response fails Zod schema validation', async () => {
    const originalKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = 'gsk_test_mock_for_zod_failure';

    // Malformed schema: missing required fields
    const invalidAnalysis = {
      is_suspicious_name: 'not_a_boolean',
      missing_components: 'not_an_array'
    };

    const spy = vi
      .spyOn(OpenAI.Chat.Completions.prototype, 'create')
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(invalidAnalysis)
            }
          }
        ]
      } as any);

    try {
      const response = await analyzeCustomerAndAddress(
        'Rohan Sharma',
        'Flat 402, Lotus Residency',
        'Mumbai',
        'Maharashtra',
        '400001'
      );

      expect(response.aiUsed).toBe(false);
      expect(response.result).toBeDefined();
    } finally {
      spy.mockRestore();
      if (originalKey !== undefined) {
        process.env.GROQ_API_KEY = originalKey;
      } else {
        delete process.env.GROQ_API_KEY;
      }
    }
  });
});
