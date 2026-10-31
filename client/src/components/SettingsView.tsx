import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  RefreshCw,
  Cpu,
  ShieldCheck,
  Scale,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../api';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Editable form states
  const [thresholds, setThresholds] = useState({
    ship_as_is_max: 24,
    ship_after_confirmation_max: 44,
    nudge_to_prepaid_max: 69,
    hold_cancel_min: 70
  });

  const [whatsappConfig, setWhatsappConfig] = useState({
    confirmation_timeout_hours: 24,
    prepaid_discount_amount: 50,
    prepaid_discount_percent: 10,
    default_language: 'hinglish'
  });

  const [locationThresholds, setLocationThresholds] = useState({
    min_sample_size: 15,
    bayes_prior_weight: 15
  });

  const [aiConfig, setAiConfig] = useState({
    enabled: true,
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    use_mock_fallback: true,
    has_api_key: false
  });

  const [financialAssumptions, setFinancialAssumptions] = useState({
    monthly_orders: 3000,
    cod_share_pct: 55,
    cod_rto_rate_pct: 28,
    prepaid_rto_rate_pct: 4,
    aov: 649,
    gross_margin_pct: 62,
    forward_shipping: 65,
    return_shipping: 65,
    packaging_handling: 25,
    product_damage_pct: 8,
    avg_product_cost: 180,
    meta_cac: 300
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      setSettings(res);

      if (res.thresholds?.data) setThresholds(res.thresholds.data);
      if (res.whatsapp_config?.data) setWhatsappConfig(res.whatsapp_config.data);
      if (res.location_thresholds?.data) setLocationThresholds(res.location_thresholds.data);
      if (res.ai_config?.data) {
        setAiConfig({
          ...res.ai_config.data,
          has_api_key: res.ai_config.has_api_key
        });
      }
      if (res.financial_assumptions?.data) setFinancialAssumptions(res.financial_assumptions.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSetting = async (key: string, data: any) => {
    try {
      setSavingKey(key);
      await api.updateSetting(key, data);
      setToastMsg(`Settings for "${key}" saved successfully.`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
        <span>Loading configuration parameters...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Rules & System Settings</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure risk score boundaries, Bayesian smoothing parameters, WhatsApp policies, and financial baselines.
          </p>
        </div>

        {toastMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Decision Thresholds */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Decision Action Boundaries
              </span>
              <h3 className="text-sm font-bold text-slate-900">Risk Score Action Cutoffs (0–100 Scale)</h3>
            </div>
            <button
              onClick={() => saveSetting('thresholds', thresholds)}
              disabled={savingKey === 'thresholds'}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingKey === 'thresholds' ? 'Saving...' : 'Save Cutoffs'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Adjust the risk score cutoffs that dictate automated routing for every incoming Cash-on-Delivery order.
          </p>

          {/* Visual Range Bar Preview */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-semibold text-slate-600 flex justify-between">
              <span>Visual Decision Spectrum</span>
              <span className="font-mono text-slate-400">0 to 100 Risk Score</span>
            </div>
            <div className="h-6 w-full rounded-lg overflow-hidden flex text-[10px] font-bold text-white shadow-inner font-mono">
              <div
                style={{ width: `${thresholds.ship_as_is_max}%` }}
                className="bg-emerald-500 flex items-center justify-center"
                title={`SHIP_AS_IS: 0 - ${thresholds.ship_as_is_max}`}
              >
                0 - {thresholds.ship_as_is_max}
              </div>
              <div
                style={{ width: `${thresholds.ship_after_confirmation_max - thresholds.ship_as_is_max}%` }}
                className="bg-amber-500 flex items-center justify-center"
                title={`CONFIRMATION: ${thresholds.ship_as_is_max + 1} - ${thresholds.ship_after_confirmation_max}`}
              >
                {thresholds.ship_as_is_max + 1} - {thresholds.ship_after_confirmation_max}
              </div>
              <div
                style={{ width: `${thresholds.nudge_to_prepaid_max - thresholds.ship_after_confirmation_max}%` }}
                className="bg-blue-500 flex items-center justify-center"
                title={`PREPAID NUDGE: ${thresholds.ship_after_confirmation_max + 1} - ${thresholds.nudge_to_prepaid_max}`}
              >
                {thresholds.ship_after_confirmation_max + 1} - {thresholds.nudge_to_prepaid_max}
              </div>
              <div
                style={{ width: `${100 - thresholds.nudge_to_prepaid_max}%` }}
                className="bg-rose-500 flex items-center justify-center"
                title={`HOLD_CANCEL: ${thresholds.hold_cancel_min} - 100`}
              >
                {thresholds.hold_cancel_min} - 100
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="text-slate-600 font-medium block mb-1">
                SHIP_AS_IS Max Score:
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={thresholds.ship_as_is_max}
                onChange={e =>
                  setThresholds({ ...thresholds, ship_as_is_max: parseInt(e.target.value, 10) || 24 })
                }
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Default: 24</span>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">
                CONFIRMATION Max Score:
              </label>
              <input
                type="number"
                min={20}
                max={60}
                value={thresholds.ship_after_confirmation_max}
                onChange={e =>
                  setThresholds({
                    ...thresholds,
                    ship_after_confirmation_max: parseInt(e.target.value, 10) || 44
                  })
                }
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Default: 44</span>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">
                PREPAID NUDGE Max Score:
              </label>
              <input
                type="number"
                min={40}
                max={80}
                value={thresholds.nudge_to_prepaid_max}
                onChange={e =>
                  setThresholds({
                    ...thresholds,
                    nudge_to_prepaid_max: parseInt(e.target.value, 10) || 69
                  })
                }
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Default: 69</span>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">
                HOLD_CANCEL Min Score:
              </label>
              <input
                type="number"
                min={50}
                max={90}
                value={thresholds.hold_cancel_min}
                onChange={e =>
                  setThresholds({
                    ...thresholds,
                    hold_cancel_min: parseInt(e.target.value, 10) || 70
                  })
                }
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Default: 70</span>
            </div>
          </div>
        </div>

        {/* Section 2: AI Engine Configuration */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
                AI Address & Identity Intelligence
              </span>
              <h3 className="text-sm font-bold text-slate-900">LLM Provider & Fallback Engine</h3>
            </div>
            <button
              onClick={() => saveSetting('ai_config', aiConfig)}
              disabled={savingKey === 'ai_config'}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingKey === 'ai_config' ? 'Saving...' : 'Save AI Config'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            The AI engine inspects Indian Hinglish colloquial expressions, landmark completeness, and placeholder names.
          </p>

          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-purple-950 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-purple-700" />
                <span>Groq Structured JSON Status:</span>
              </span>
              <span
                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                  aiConfig.has_api_key
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {aiConfig.has_api_key ? 'Groq API Key Detected' : 'Offline / Mock Fallback Active'}
              </span>
            </div>
            <p className="text-[11px] text-purple-800 leading-relaxed">
              When no GROQ_API_KEY is provided in the environment, the system executes deterministic mock address heuristics with 100% test coverage.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-600 font-medium block mb-1">AI Engine Enabled:</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="ai_enabled"
                    checked={aiConfig.enabled === true}
                    onChange={() => setAiConfig({ ...aiConfig, enabled: true })}
                    className="accent-purple-600"
                  />
                  <span>Enabled (AI Analysis active)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="ai_enabled"
                    checked={aiConfig.enabled === false}
                    onChange={() => setAiConfig({ ...aiConfig, enabled: false })}
                    className="accent-purple-600"
                  />
                  <span>Disabled (Pure Rules Only)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">Groq Target Model:</label>
              <select
                value={aiConfig.model}
                onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium focus:outline-hidden"
              >
                <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Default - High Speed & Structured JSON)</option>
                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Fast Multilingual Reasoning)</option>
                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Ultra Low Latency)</option>
                <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (High Context)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: WhatsApp Simulator Settings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                WhatsApp Communication Policies
              </span>
              <h3 className="text-sm font-bold text-slate-900">Timeouts & Discount Incentives</h3>
            </div>
            <button
              onClick={() => saveSetting('whatsapp_config', whatsappConfig)}
              disabled={savingKey === 'whatsapp_config'}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingKey === 'whatsapp_config' ? 'Saving...' : 'Save Policies'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-600 font-medium block mb-1">
                Confirmation Timeout (Hours):
              </label>
              <input
                type="number"
                min={1}
                max={72}
                value={whatsappConfig.confirmation_timeout_hours}
                onChange={e =>
                  setWhatsappConfig({
                    ...whatsappConfig,
                    confirmation_timeout_hours: parseInt(e.target.value, 10) || 24
                  })
                }
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                After this period, unconfirmed orders are cancelled
              </span>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">
                Prepaid Discount Amount (₹):
              </label>
              <input
                type="number"
                min={10}
                max={200}
                value={whatsappConfig.prepaid_discount_amount}
                onChange={e =>
                  setWhatsappConfig({
                    ...whatsappConfig,
                    prepaid_discount_amount: parseInt(e.target.value, 10) || 50
                  })
                }
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Flat cash discount offered to convert to online payment
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Location Bayesian Smoothing */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                Geographic Statistics & Bayes Shrinkage
              </span>
              <h3 className="text-sm font-bold text-slate-900">Small-Sample Protection Parameters</h3>
            </div>
            <button
              onClick={() => saveSetting('location_thresholds', locationThresholds)}
              disabled={savingKey === 'location_thresholds'}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingKey === 'location_thresholds' ? 'Saving...' : 'Save Parameters'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Prevents small sample cities (e.g. 1 order resulting in RTO) from unfairly blacklisting entire pincodes.
          </p>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-600 font-medium block mb-1">
                Min City Sample Size:
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={locationThresholds.min_sample_size}
                onChange={e =>
                  setLocationThresholds({
                    ...locationThresholds,
                    min_sample_size: parseInt(e.target.value, 10) || 15
                  })
                }
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Minimum orders required before city-level RTO applies
              </span>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">
                Bayes Prior Weight (C):
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={locationThresholds.bayes_prior_weight}
                onChange={e =>
                  setLocationThresholds({
                    ...locationThresholds,
                    bayes_prior_weight: parseInt(e.target.value, 10) || 15
                  })
                }
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Strength of shrinkage towards national baseline (28.41%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
