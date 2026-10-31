import { z } from 'zod';

export type DecisionAction =
  | 'SHIP_AS_IS'
  | 'SHIP_AFTER_CONFIRMATION'
  | 'NUDGE_TO_PREPAID'
  | 'HOLD_CANCEL';

export interface OrderInput {
  order_id: string;
  order_datetime?: string;
  customer_name: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  order_value: number;
  items: string;
  num_items?: number;
  customer_prior_orders?: number;
  customer_prior_rto?: number;
  utm_source?: string;
  courier?: string;
  payment_method?: string;
}

export interface RiskFactor {
  category:
    | 'CUSTOMER_HISTORY'
    | 'ADDRESS_QUALITY'
    | 'NAME_QUALITY'
    | 'PHONE_VALIDITY'
    | 'LOCATION_RISK'
    | 'ORDER_VALUE'
    | 'ACQUISITION_CHANNEL';
  name: string;
  score_delta: number;
  severity: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface LLMAddressAnalysis {
  is_suspicious_name: boolean;
  name_suspicion_reason?: string | null;
  address_completeness_score: number; // 0 (garbage) to 100 (complete)
  is_placeholder_address: boolean;
  missing_components: string[]; // e.g. ["house_number", "street", "landmark"]
  detected_language: 'English' | 'Hinglish' | 'Other';
  summary_note: string;
}

export const LLMAddressAnalysisSchema = z.object({
  is_suspicious_name: z.boolean(),
  name_suspicion_reason: z.string().nullish(),
  address_completeness_score: z.number().min(0).max(100),
  is_placeholder_address: z.boolean(),
  missing_components: z.array(z.string()),
  detected_language: z.enum(['English', 'Hinglish', 'Other']),
  summary_note: z.string()
});

export interface DecisionResult {
  order_id: string;
  risk_score: number; // 0 to 100
  action: DecisionAction;
  explanation: string;
  factors: RiskFactor[];
  ai_used: boolean;
  ai_reasoning?: string;
  timestamp: string;
  is_manual_override?: boolean;
  override_action?: DecisionAction;
  override_reason?: string;
}

export interface ThresholdSettings {
  ship_as_is_max: number; // e.g. 24
  ship_after_confirmation_max: number; // e.g. 44
  nudge_to_prepaid_max: number; // e.g. 69
  hold_cancel_min: number; // e.g. 70
}

export interface WeightSettings {
  prior_rto_weight: number;
  address_quality_weight: number;
  location_risk_weight: number;
  order_value_weight: number;
  channel_risk_weight: number;
}

export interface FinancialAssumptions {
  monthly_orders: number;
  cod_share_pct: number;
  cod_rto_rate_pct: number;
  prepaid_rto_rate_pct: number;
  aov: number;
  gross_margin_pct: number;
  forward_shipping: number;
  return_shipping: number;
  packaging_handling: number;
  product_damage_pct: number;
  avg_product_cost: number;
  meta_cac: number;
}
