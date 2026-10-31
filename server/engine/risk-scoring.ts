import {
  DecisionAction,
  DecisionResult,
  OrderInput,
  RiskFactor,
  ThresholdSettings,
  WeightSettings
} from './types.js';
import { analyzeCustomerAndAddress, mockAnalyzeCustomerAndAddress } from './llm-analyzer.js';

// Pre-computed historical baseline rates from Milestone 1 analysis
const GLOBAL_BASELINE_RTO_RATE = 0.2841; // 28.41%

const STATE_RTO_RATES: Record<string, { total: number; rto: number }> = {
  'Bihar': { total: 146, rto: 78 },
  'Uttar Pradesh': { total: 197, rto: 88 },
  'Madhya Pradesh': { total: 130, rto: 50 },
  'Assam': { total: 63, rto: 22 },
  'Rajasthan': { total: 165, rto: 48 },
  'Karnataka': { total: 214, rto: 55 },
  'Telangana': { total: 177, rto: 44 },
  'West Bengal': { total: 131, rto: 32 },
  'Delhi': { total: 247, rto: 53 },
  'Tamil Nadu': { total: 157, rto: 33 },
  'Maharashtra': { total: 390, rto: 70 }
};

const CITY_RTO_RATES: Record<string, { total: number; rto: number }> = {
  'Gorakhpur': { total: 46, rto: 29 },
  'Bareilly': { total: 33, rto: 20 },
  'Darbhanga': { total: 62, rto: 36 },
  'Sagar': { total: 55, rto: 28 },
  'Patna': { total: 80, rto: 38 },
  'Kota': { total: 41, rto: 16 },
  'Guwahati': { total: 42, rto: 15 },
  'Nagaon': { total: 21, rto: 7 },
  'Lucknow': { total: 118, rto: 39 },
  'Indore': { total: 75, rto: 22 },
  'Bengaluru': { total: 214, rto: 55 },
  'Jaipur': { total: 123, rto: 31 },
  'Hyderabad': { total: 176, rto: 44 },
  'Kolkata': { total: 131, rto: 32 },
  'Delhi': { total: 246, rto: 53 },
  'Chennai': { total: 157, rto: 33 },
  'Pune': { total: 171, rto: 31 },
  'Mumbai': { total: 219, rto: 39 }
};

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  ship_as_is_max: 24,
  ship_after_confirmation_max: 44,
  nudge_to_prepaid_max: 69,
  hold_cancel_min: 70
};

export const DEFAULT_WEIGHTS: WeightSettings = {
  prior_rto_weight: 40,
  address_quality_weight: 25,
  location_risk_weight: 20,
  order_value_weight: 15,
  channel_risk_weight: 10
};

export function cleanPhoneNumber(rawPhone: string): { clean: string; isValid: boolean } {
  let s = (rawPhone || '').trim().replace(/\D/g, '');
  if (s.startsWith('91') && s.length === 12) {
    s = s.substring(2);
  }
  const isValid = /^[6-9]\d{9}$/.test(s);
  return { clean: s, isValid };
}

export function computeSmoothedRtoRate(
  observedRto: number,
  totalOrders: number,
  priorWeight: number = 15,
  globalPrior: number = GLOBAL_BASELINE_RTO_RATE
): number {
  if (totalOrders <= 0) return globalPrior;
  return (observedRto + priorWeight * globalPrior) / (totalOrders + priorWeight);
}

export async function evaluateOrderRisk(
  order: OrderInput,
  options?: {
    thresholds?: ThresholdSettings;
    weights?: WeightSettings;
    skipLLM?: boolean;
    minSampleSize?: number;
    bayesWeight?: number;
  }
): Promise<DecisionResult> {
  const thresholds = options?.thresholds || DEFAULT_THRESHOLDS;
  const minSampleSize = options?.minSampleSize || 15;
  const bayesWeight = options?.bayesWeight || 15;

  const factors: RiskFactor[] = [];
  let baseScore = 24.0; // Anchored slightly below the 28% baseline

  // 1. Customer History Factor
  const priorOrders = order.customer_prior_orders ?? 0;
  const priorRto = order.customer_prior_rto ?? 0;

  if (priorRto >= 2) {
    const delta = 48.0;
    factors.push({
      category: 'CUSTOMER_HISTORY',
      name: 'High Repeat RTO History',
      score_delta: delta,
      severity: 'CRITICAL',
      description: `Customer has ${priorRto} prior RTOs. Historical RTO rate for 2+ prior RTOs is 76.47%.`
    });
  } else if (priorRto === 1) {
    const delta = 16.0;
    factors.push({
      category: 'CUSTOMER_HISTORY',
      name: 'Single Prior RTO',
      score_delta: delta,
      severity: 'HIGH',
      description: `Customer has 1 prior RTO. Historical RTO rate is 34.23%.`
    });
  } else if (priorOrders > 0 && priorRto === 0) {
    const delta = priorOrders >= 3 ? -24.0 : -16.0;
    factors.push({
      category: 'CUSTOMER_HISTORY',
      name: 'Loyal Clean History',
      score_delta: delta,
      severity: 'SAFE',
      description: `Customer completed ${priorOrders} past deliveries with 0 RTOs. Historical cohort RTO rate is only 13.80%.`
    });
  } else {
    // First time customer (priorOrders === 0 && priorRto === 0)
    // Neutral per policy: "Do not automatically penalize first-time customers merely because they are new."
    factors.push({
      category: 'CUSTOMER_HISTORY',
      name: 'First-Time Customer',
      score_delta: 0,
      severity: 'SAFE',
      description: `New customer with no prior history. Treated neutrally without penalty.`
    });
  }

  // 2. Phone Validity
  const { clean: phoneDigits, isValid: isPhoneValid } = cleanPhoneNumber(order.phone);
  if (!isPhoneValid) {
    const delta = 36.0;
    factors.push({
      category: 'PHONE_VALIDITY',
      name: 'Invalid / Truncated Mobile Number',
      score_delta: delta,
      severity: 'CRITICAL',
      description: `Phone "${order.phone}" is non-standard (${phoneDigits.length} digits). Delivery agents will be unable to call.`
    });
  } else {
    factors.push({
      category: 'PHONE_VALIDITY',
      name: 'Valid Mobile Number',
      score_delta: -2.0,
      severity: 'SAFE',
      description: 'Standard 10-digit Indian mobile number.'
    });
  }

  // 3. Pincode & Geographic Location Risk (Empirical Bayes Smoothed)
  const pin = (order.pincode || '').trim();
  const isPincodeMissing = !pin || pin === '0' || pin.toLowerCase() === 'null';
  const isPincodeFormatValid = /^[1-8]\d{5}$/.test(pin);

  if (isPincodeMissing || !isPincodeFormatValid) {
    const delta = 15.0;
    factors.push({
      category: 'LOCATION_RISK',
      name: 'Missing / Invalid PIN Code',
      score_delta: delta,
      severity: 'HIGH',
      description: `PIN code is missing or malformed (${pin}).`
    });
  }

  // City and State smoothing
  const cityName = order.city?.trim();
  const stateName = order.state?.trim();
  let locationDelta = 0;

  if (cityName && CITY_RTO_RATES[cityName]) {
    const cityStat = CITY_RTO_RATES[cityName];
    const smoothedCityRate = computeSmoothedRtoRate(cityStat.rto, cityStat.total, bayesWeight);
    const rateDiff = smoothedCityRate - GLOBAL_BASELINE_RTO_RATE;

    if (cityStat.total >= minSampleSize) {
      locationDelta = Math.round(rateDiff * 50); // E.g. +13 for Gorakhpur, -5 for Mumbai
      const severity = locationDelta > 8 ? 'HIGH' : locationDelta < -3 ? 'SAFE' : 'LOW';
      factors.push({
        category: 'LOCATION_RISK',
        name: `City Risk: ${cityName}`,
        score_delta: locationDelta,
        severity,
        description: `${cityName} has ${cityStat.total} historical orders. Empirical Bayes smoothed RTO rate: ${(smoothedCityRate * 100).toFixed(1)}% (vs national avg ${(GLOBAL_BASELINE_RTO_RATE * 100).toFixed(1)}%).`
      });
    }
  } else if (stateName && STATE_RTO_RATES[stateName]) {
    const stateStat = STATE_RTO_RATES[stateName];
    const smoothedStateRate = computeSmoothedRtoRate(stateStat.rto, stateStat.total, bayesWeight);
    const rateDiff = smoothedStateRate - GLOBAL_BASELINE_RTO_RATE;
    locationDelta = Math.round(rateDiff * 40);

    const severity = locationDelta > 7 ? 'HIGH' : locationDelta < -3 ? 'SAFE' : 'LOW';
    factors.push({
      category: 'LOCATION_RISK',
      name: `State Risk: ${stateName}`,
      score_delta: locationDelta,
      severity,
      description: `${stateName} state smoothed RTO rate is ${(smoothedStateRate * 100).toFixed(1)}%.`
    });
  }

  // 4. Address and Name Quality Analysis (AI-Assisted or Mock)
  let aiUsed = false;
  let aiReasoning = '';

  let aiAnalysis: import('./types.js').LLMAddressAnalysis;
  if (options?.skipLLM) {
    aiAnalysis = mockAnalyzeCustomerAndAddress(order.customer_name, order.address);
    aiUsed = false;
    aiReasoning = aiAnalysis.summary_note;
  } else {
    const { result, aiUsed: usedAI } = await analyzeCustomerAndAddress(
      order.customer_name,
      order.address,
      order.city,
      order.state,
      order.pincode
    );
    aiAnalysis = result;
    aiUsed = usedAI;
    aiReasoning = aiAnalysis.summary_note;
  }

  // Name Quality Factor
  if (aiAnalysis.is_suspicious_name) {
    const delta = 32.0;
    factors.push({
      category: 'NAME_QUALITY',
      name: 'Suspicious Customer Name',
      score_delta: delta,
      severity: 'CRITICAL',
      description: aiAnalysis.name_suspicion_reason || `Customer name "${order.customer_name}" detected as test/placeholder identity.`
    });
  } else {
    factors.push({
      category: 'NAME_QUALITY',
      name: 'Standard Customer Name',
      score_delta: -2.0,
      severity: 'SAFE',
      description: `Valid name structure.`
    });
  }

  // Address Quality Factor
  if (aiAnalysis.is_placeholder_address) {
    const delta = 38.0;
    factors.push({
      category: 'ADDRESS_QUALITY',
      name: 'Garbage / Placeholder Address',
      score_delta: delta,
      severity: 'CRITICAL',
      description: `Address "${order.address}" is an unusable placeholder string (${aiAnalysis.summary_note}).`
    });
  } else if (aiAnalysis.address_completeness_score < 40) {
    const delta = 22.0;
    factors.push({
      category: 'ADDRESS_QUALITY',
      name: 'Incomplete Delivery Address',
      score_delta: delta,
      severity: 'HIGH',
      description: `Missing critical components: ${aiAnalysis.missing_components.join(', ')}. Completeness score: ${aiAnalysis.address_completeness_score}/100.`
    });
  } else if (aiAnalysis.address_completeness_score >= 80) {
    factors.push({
      category: 'ADDRESS_QUALITY',
      name: 'Detailed & Complete Address',
      score_delta: -8.0,
      severity: 'SAFE',
      description: `Address contains identifiable structure (completeness ${aiAnalysis.address_completeness_score}/100, language: ${aiAnalysis.detected_language}).`
    });
  }

  // 5. Order Characteristics (Ticket Size & Items)
  const orderValue = order.order_value ?? 0;
  if (orderValue >= 2000) {
    factors.push({
      category: 'ORDER_VALUE',
      name: 'High-Ticket COD Basket (>= ₹2,000)',
      score_delta: 14.0,
      severity: 'HIGH',
      description: `COD basket value is ₹${orderValue.toLocaleString('en-IN')}. High-ticket COD exhibits 40.37% historical RTO rate due to doorstep cash reluctance.`
    });
  } else if (orderValue >= 1500) {
    factors.push({
      category: 'ORDER_VALUE',
      name: 'Moderate High COD Basket (₹1,500 - ₹1,999)',
      score_delta: 8.0,
      severity: 'MEDIUM',
      description: `Order value ₹${orderValue} has 37.93% historical RTO.`
    });
  } else if (orderValue <= 0) {
    factors.push({
      category: 'ORDER_VALUE',
      name: 'Zero-Value Promotional Order',
      score_delta: 15.0,
      severity: 'HIGH',
      description: 'Zero order value detected (₹0).'
    });
  } else if (orderValue >= 900 && orderValue <= 1400) {
    factors.push({
      category: 'ORDER_VALUE',
      name: 'Sweet-Spot Basket Size',
      score_delta: -5.0,
      severity: 'SAFE',
      description: `Order value ₹${orderValue} falls in lowest risk basket segment (20.19% RTO).`
    });
  }

  // 6. Acquisition Channel / UTM Source
  const utm = (order.utm_source || '').toLowerCase();
  if (utm === 'meta_ads') {
    factors.push({
      category: 'ACQUISITION_CHANNEL',
      name: 'Meta Ads Traffic',
      score_delta: 5.0,
      severity: 'MEDIUM',
      description: 'Meta Ads has highest impulse purchasing rate (31.32% historical RTO).'
    });
  } else if (utm === 'direct') {
    factors.push({
      category: 'ACQUISITION_CHANNEL',
      name: 'Direct Organic Traffic',
      score_delta: -6.0,
      severity: 'SAFE',
      description: 'Direct organic traffic exhibits strong customer intent (22.66% historical RTO).'
    });
  }

  // Sum factors to calculate final score
  const totalDelta = factors.reduce((acc, f) => acc + f.score_delta, 0);
  let finalScore = Math.max(0, Math.min(100, Math.round(baseScore + totalDelta)));

  // Safety Invariants:
  // Invariant 1: First-time customers with complete address and valid phone NEVER get HOLD_CANCEL.
  const isFirstTime = priorOrders === 0 && priorRto === 0;
  const isAddressSafe = !aiAnalysis.is_placeholder_address && aiAnalysis.address_completeness_score >= 50;
  if (isFirstTime && isAddressSafe && isPhoneValid && finalScore >= thresholds.hold_cancel_min) {
    finalScore = thresholds.hold_cancel_min - 2; // Cap at NUDGE_TO_PREPAID (e.g. 68)
  }

  // Invariant 2: Guaranteed HOLD_CANCEL strictly reserved for high-confidence failure (> 70.36% empirical breakeven):
  // (1) 2+ prior RTOs with no positive delivery history (76.5% empirical RTO), OR
  // (2) Literal single character placeholder ('.', 73.2% empirical RTO), OR
  // (3) Blatant placeholder address combined with invalid phone or suspicious name
  const isExtremePlaceholder = order.address.trim() === '.' || order.address.trim().length <= 2;
  const hasNoPositiveDelivery = priorOrders <= priorRto;
  if (
    (priorRto >= 2 && hasNoPositiveDelivery) ||
    isExtremePlaceholder ||
    (aiAnalysis.is_placeholder_address && (!isPhoneValid || aiAnalysis.is_suspicious_name))
  ) {
    finalScore = Math.max(finalScore, thresholds.hold_cancel_min);
  }

  // Map score to action
  let action: DecisionAction = 'SHIP_AS_IS';
  if (finalScore <= thresholds.ship_as_is_max) {
    action = 'SHIP_AS_IS';
  } else if (finalScore <= thresholds.ship_after_confirmation_max) {
    action = 'SHIP_AFTER_CONFIRMATION';
  } else if (finalScore <= thresholds.nudge_to_prepaid_max) {
    action = 'NUDGE_TO_PREPAID';
  } else {
    action = 'HOLD_CANCEL';
  }

  // Generate plain-English explanation
  const primaryDriver = factors
    .filter(f => f.score_delta > 0)
    .sort((a, b) => b.score_delta - a.score_delta)[0];

  const primaryMitigator = factors
    .filter(f => f.score_delta < 0)
    .sort((a, b) => a.score_delta - b.score_delta)[0];

  let explanation = '';
  switch (action) {
    case 'SHIP_AS_IS':
      explanation = primaryMitigator
        ? `Low risk score (${finalScore}/100). Approved for immediate dispatch due to ${primaryMitigator.name.toLowerCase()} (${primaryMitigator.description}).`
        : `Safe order profile with score ${finalScore}/100. Dispatched as-is.`;
      break;
    case 'SHIP_AFTER_CONFIRMATION':
      explanation = primaryDriver
        ? `Moderate risk score (${finalScore}/100) driven by ${primaryDriver.name.toLowerCase()}. Ship only after WhatsApp buyer confirmation.`
        : `Moderate risk score (${finalScore}/100). Awaiting WhatsApp confirmation before fulfillment.`;
      break;
    case 'NUDGE_TO_PREPAID':
      explanation = primaryDriver
        ? `Elevated risk score (${finalScore}/100) driven by ${primaryDriver.name.toLowerCase()}. Nudge customer to convert to prepaid with discount to lock in commitment.`
        : `Elevated risk (${finalScore}/100). Offering instant prepaid discount to secure delivery.`;
      break;
    case 'HOLD_CANCEL':
      explanation = primaryDriver
        ? `Critical RTO risk (${finalScore}/100) triggered by ${primaryDriver.name.toLowerCase()} (${primaryDriver.description}). Order placed on hold for cancellation or manual review.`
        : `Critical risk score (${finalScore}/100). Held to prevent guaranteed shipping loss.`;
      break;
  }

  return {
    order_id: order.order_id,
    risk_score: finalScore,
    action,
    explanation,
    factors,
    ai_used: aiUsed,
    ai_reasoning: aiReasoning,
    timestamp: new Date().toISOString()
  };
}
