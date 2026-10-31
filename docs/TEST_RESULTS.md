# Test Execution & Verification Results

**Date of Execution:** October 31, 2026  
**Environment:** Windows 11, Node.js v24.19.0, npm 11.17.0, Python 3.12.10  
**Test Framework:** Vitest v5.0.5  

---

## Summary of Results

| Test Suite | Total Tests | Passed | Failed | Execution Time | Coverage Area |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `tests/data-normalization.test.ts` | 4 | 4 | 0 | 10ms | Status normalization, phone formatting, pincode validation, missing values |
| `tests/decision-engine.test.ts` | 16 | 16 | 0 | 228ms | Safe customers, first-time neutrality, 2+ RTO penalty, invalid phone, fake name, garbage address, Bayes smoothing, custom thresholds, Hinglish address, incomplete address, small-sample location, LLM cancellation immunity, Groq missing key fallback, Groq invalid key handling, Groq valid structured JSON schema validation, Groq Zod error recovery |
| `tests/whatsapp-simulator.test.ts` | 9 | 9 | 0 | 111ms | Confirmation YES/NO, clarification prompt, 24h timeout, prepaid discount flow, simulated payment success & failure, duplicate response idempotency, post-timeout expiration handling, failed payment retry |
| `tests/financial-engine.test.ts` | 4 | 4 | 0 | 11ms | Exact ₹169.40 operational RTO loss, ₹402.38 profit, trade-off formulas, non-double-counted net impact |
| `tests/api-integration.test.ts` | 6 | 6 | 0 | 116ms | End-to-end Fastify endpoints, KPI calculations, order search/filter, simulated Shopify order creation, manual overrides, validated settings updates |
| **Total** | **39** | **39** | **0** | **~1.8s** | **100% Passing** |

---

## Exact Test Execution Command & Terminal Output

### Command
```powershell
npm.cmd test
```

### Full Console Output
```text
> cod-rto-intelligence@1.0.0 test
> vitest run

 RUN  v5.0.5 C:/Users/USMAN/Downloads/Fardeen/COD-RTO-Assignment

 ✓ tests/financial-engine.test.ts (4 tests) 11ms
 ✓ tests/whatsapp-simulator.test.ts (9 tests) 111ms
 ✓ tests/data-normalization.test.ts (4 tests) 10ms
 ✓ tests/decision-engine.test.ts (16 tests) 228ms
 ✓ tests/api-integration.test.ts (6 tests) 116ms

 Test Files  5 passed (5)
      Tests  39 passed (39)
   Duration  1.76s
```

---

## Baseline Verification Test Command & Output

### Command
```powershell
python scripts/analyze_data.py
```

### Full Output
```text
Reading raw CSV from: data\orders_sample.csv...
Total raw records: 2018
Delivered: 1444, RTO: 573, In Transit: 1
Completed orders: 2017, Overall RTO Rate: 28.41%
Cleaned dataset written to data\cleaned_orders.csv (2018 rows).
Summary JSON written to data\analysis_summary.json.
Baseline verification summary:
  total_records: 2018 (matches expected: True)
  delivered: 1444 (matches expected: True)
  rto: 573 (matches expected: True)
  in_transit: 1 (matches expected: True)
  completed_order_rto_rate: 28.41% (matches expected: True)
  date_range: 2026-04-01 02:10 to 2026-09-30 23:04 (matches expected: True)
  two_prior_rtos: 26 RTOs out of 34 (matches expected: True)
  suspicious_name_heuristic: 16 RTOs out of 21 (matches expected: True)
  short_addresses_under_12: 100 RTOs out of 156 (matches expected: True)
  gorakhpur: 29 RTOs out of 46 (matches expected: True)
  mumbai: 39 RTOs out of 219 (matches expected: True)
  xpressbees_rto_rate: 31.23% (matches expected: True)
  delhivery_rto_rate: 25.88% (total) / 25.92% (completed) (matches expected: True)
```

---

## Production Build Verification

### Command
```powershell
npm.cmd run build
```

### Output
```text
> cod-rto-intelligence@1.0.0 build
> npm --prefix client run build

> client@0.0.0 build
> tsc -b && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2628 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.81 kB │ gzip:   0.52 kB
dist/assets/index-BFlbDEwm.css   29.63 kB │ gzip:   6.00 kB
dist/assets/index-Da_IwtoW.js   731.85 kB │ gzip: 205.13 kB
✓ built in 2.69s
```
