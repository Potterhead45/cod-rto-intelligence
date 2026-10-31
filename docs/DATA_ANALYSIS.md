# Data Analysis Report: COD RTO Intelligence Platform

**Dataset:** `data/orders_sample.csv` (Preserved in original form)  
**Cleaned Output:** `data/cleaned_orders.csv`  
**Machine-Readable Summary:** `data/analysis_summary.json`  
**Analysis Date:** October 31, 2026  
**Audience:** Founders, Engineering, Product, and Operations Teams  

---

## Executive Summary

An exhaustive analysis was performed on the historical dataset of 2,018 Cash-on-Delivery (COD) orders spanning April 1, 2026 to September 30, 2026. 

Key verified figures:
- **Total Records:** 2,018 orders
- **Delivered:** 1,444 orders (71.59%)
- **Return to Origin (RTO):** 573 orders (28.41% of completed orders)
- **In Transit:** 1 order (`KT100465`, 0.05%)
- **Baseline Completed Order RTO Rate:** **28.41%** (573 / 2,017)

Every baseline benchmark provided in the project specification has been independently calculated, verified, and reconciled down to the exact order.

---

## 1. Column-by-Column Data Dictionary & Quality Audit

The dataset consists of 17 columns:

| Column | Raw Type | Cleaned Type | Null Count | Unique Count | Audit Findings & Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `order_id` | String | String | 0 | 1,988 | Contains 30 duplicate pairs (60 rows) of identical order re-submissions. |
| `order_datetime` | String | ISO Timestamp | 0 | 2,018 | Range: `2026-04-01 02:10` to `2026-09-30 23:04`. Parses cleanly into `YYYY-MM-DD HH:MM`. |
| `customer_name` | String | String | 0 | 187 | Contains test/placeholder names (e.g. `Test Order`, `test`, `asdf`, `na`, `abc`). |
| `phone` | String | Clean 10-digit | 0 | 1,842 | 1,986 valid 10-digit; 5 with formatting (`+91 93117...`); 17 truncated 9-digit numbers. |
| `address` | String | String | 0 | 1,883 | 156 records shorter than 12 chars (`.`, `xyz`, `home`, `call me`, isolated city names). |
| `city` | String | String | 4 | 16 | 4 records missing city. Imputed via pincode and state lookup. |
| `state` | String | String | 0 | 11 | Complete. Top states: Maharashtra, Delhi, Karnataka, Uttar Pradesh, Bihar. |
| `pincode` | Float64 | String (6-digit) | 12 | 1,067 | 12 nulls. Remaining 2,006 are valid 6-digit Indian PIN codes starting with 1–8. |
| `order_value` | Int64 | INR (₹) | 0 | 48 | Range: ₹0 to ₹2,999. Mean: ₹918.71. Contains 3 zero-value promotional orders. |
| `items` | String | Pipe-delimited | 0 | 45 | Pipe-separated list of items (e.g. `Claw Clip Set\|Satin Pillowcase`). |
| `num_items` | Int64 | Integer | 0 | 4 | Range: 1 to 4 items. Median: 2 items. |
| `customer_prior_orders` | Int64 | Integer | 0 | 6 | Range: 0 to 5. 1,518 (75.2%) are first-time buyers (`prior_orders = 0`). |
| `customer_prior_rto` | Int64 | Integer | 0 | 3 | Range: 0 to 2. 0: 1,872; 1: 111; 2: 34. |
| `utm_source` | String | Categorical | 0 | 6 | `meta_ads`, `direct`, `google_ads`, `influencer`, `instagram_organic`, `whatsapp_broadcast`. |
| `courier` | String | Categorical | 0 | 5 | `Delhivery`, `Xpressbees`, `Shadowfax`, `Ecom Express`, `BlueDart`. |
| `payment_method` | String | Categorical | 0 | 1 | 100% COD orders. |
| `final_status` | String | Normalized | 0 | 6 raw variations | Capitalization & whitespace inconsistencies (`DELIVERED`, `RTO`, `Rto`, `delivered`, `RTO `, `IN_TRANSIT`). |

---

## 2. Baseline Figures Reconciliation & Investigation

All figures from the assignment brief were independently checked against the dataset:

| Metric | Brief Baseline | Calculated / Verified | Verification Status | Notes / Reason for Any Variance |
| :--- | :--- | :--- | :--- | :--- |
| **Total Records** | 2,018 | 2,018 | **EXACT MATCH** | 100% verified. |
| **Delivered Records** | 1,444 | 1,444 | **EXACT MATCH** | Raw values: `DELIVERED` (1,443) + `delivered` (1) = 1,444. |
| **RTO Records** | 573 | 573 | **EXACT MATCH** | Raw values: `RTO` (570) + `Rto` (2) + `RTO ` (1) = 573. |
| **In Transit Records** | 1 | 1 | **EXACT MATCH** | Order `KT100465` (Placed 2026-09-30 18:23). |
| **Completed RTO Rate** | 28.41% | 28.41% | **EXACT MATCH** | 573 RTOs / 2,017 completed orders = 28.4085%. |
| **Date Range** | April 1 – Sept 30, 2026 | 2026-04-01 02:10 to 2026-09-30 23:04 | **EXACT MATCH** | Spans exactly Q2 & Q3 2026. |
| **Prior RTO = 2 Customers** | 26 RTOs / 34 orders | 26 RTOs / 34 orders (76.47%) | **EXACT MATCH** | 34 orders had customer_prior_rto = 2; exactly 26 resulted in RTO. |
| **Suspicious Name Heuristic** | 16 RTOs / 21 orders | 16 RTOs / 21 orders (76.19%) | **EXACT MATCH** | Matches exact tokens: `test order` (12), `test` (4), `asdf` (5). |
| **Address Length < 12** | 100 RTOs / 156 orders | 100 RTOs / 156 orders (64.10%) | **EXACT MATCH** | 156 addresses have string length < 12 characters. |
| **Gorakhpur City** | 29 RTOs / 46 orders | 29 RTOs / 46 orders (63.04%) | **EXACT MATCH** | Gorakhpur has 46 orders, 29 RTOs. |
| **Mumbai City** | 39 RTOs / 219 orders | 39 RTOs / 219 orders (17.81%) | **EXACT MATCH** | Mumbai has 219 orders, 39 RTOs. |
| **Xpressbees Courier** | 31.23% RTO | 124 RTOs / 397 orders = 31.23% | **EXACT MATCH** | Exactly 31.234%. |
| **Delhivery Courier** | 25.88% RTO | Total: 25.88% (183 / 707)<br>Completed: 25.92% (183 / 706) | **RECONCILED & EXPLAINED** | 25.88% is computed against total 707 records (which includes the 1 in-transit order). Excluding in-transit gives 25.92%. |

---

## 3. High-Value Predictive Patterns Discovered

### A. Customer Prior History (Strongest Predictive Signal)
The single strongest predictor of COD RTO is the customer's prior order and RTO track record:
- **Repeat Customers with Clean History (`prior_orders > 0, prior_rto == 0`):**
  - **13.80% RTO Rate** (355 orders, 49 RTOs).
  - These customers are more than **50% safer** than the overall store average.
- **First-Time Customers (`prior_orders == 0`):**
  - **30.32% RTO Rate** (1,517 orders, 460 RTOs).
  - Represents 75.2% of all order volume.
- **Customers with 1 Prior RTO (`prior_rto == 1`):**
  - **34.23% RTO Rate** (111 orders, 38 RTOs).
- **Customers with 2 Prior RTOs (`prior_rto == 2`):**
  - **76.47% RTO Rate** (34 orders, 26 RTOs).
  - **Critical Insight:** A customer with 2 previous RTOs has over a 3-in-4 chance of failing delivery again.

### B. Address Completeness & Garbage Strings
- **Address length < 12 characters:** 64.10% RTO (100 RTOs / 156 orders).
- **Placeholder addresses:**
  - `.` (period only): 41 orders, 30 RTOs (**73.17% RTO**).
  - `home`: 27 orders, 19 RTOs (**70.37% RTO**).
  - `xyz`: 36 orders, 23 RTOs (**63.89% RTO**).
  - `call me`: 21 orders, 11 RTOs (**52.38% RTO**).
  - City name alone (e.g. `Delhi`, `Mumbai` in address field): 27 orders, 12 RTOs (**44.44% RTO**).

### C. Phone Number Quality
- **Valid 10-digit Indian Mobile:** 28.24% RTO (2,001 orders, 565 RTOs).
- **Truncated 9-digit Numbers:** 47.06% RTO (17 orders, 8 RTOs).
- Inability for delivery agents to dial the customer leads directly to "Customer Unreachable / Door Locked" fake delivery attempts.

### D. Geographic Stratification (State and Tier Distribution)
Regional RTO variances are striking and persistent:

| State | Completed Orders | RTO Count | RTO Rate (%) | Bayesian Smoothed Rate (%) |
| :--- | :--- | :--- | :--- | :--- |
| **Bihar** | 146 | 78 | **53.42%** | **51.09%** |
| **Uttar Pradesh** | 197 | 88 | **44.67%** | **43.52%** |
| **Madhya Pradesh** | 130 | 50 | **38.46%** | **37.42%** |
| **Assam** | 63 | 22 | **34.92%** | **33.67%** |
| **Rajasthan** | 165 | 48 | **29.09%** | **29.03%** |
| **Karnataka** | 214 | 55 | **25.70%** | **25.88%** |
| **Telangana** | 177 | 44 | **24.86%** | **25.14%** |
| **West Bengal** | 131 | 32 | **24.43%** | **24.84%** |
| **Delhi** | 247 | 53 | **21.46%** | **21.86%** |
| **Tamil Nadu** | 157 | 33 | **21.02%** | **21.66%** |
| **Maharashtra** | 390 | 70 | **17.95%** | **18.34%** |

### E. Acquisition Channel Disparity
- **Meta Ads (`meta_ads`):** 779 completed orders, 244 RTOs (**31.32% RTO**). Represents 38.6% of entire business volume and generates the highest volume of impulsive, low-commitment buyers.
- **Instagram Organic:** 235 orders, 69 RTOs (**29.36% RTO**).
- **Google Ads:** 246 orders, 69 RTOs (**28.05% RTO**).
- **Influencer:** 229 orders, 61 RTOs (**26.64% RTO**).
- **WhatsApp Broadcast:** 272 orders, 72 RTOs (**26.47% RTO**).
- **Direct Traffic:** 256 orders, 58 RTOs (**22.66% RTO**). High-intent, self-directed organic traffic delivers significantly higher fulfillment rates.

### F. Order Value (Basket Size) Risk Curve
- **Low Basket (₹0 - ₹499):** 27.57% RTO
- **Standard Basket (₹500 - ₹999):** 29.86% RTO
- **Mid-Tier (₹1,000 - ₹1,499):** **20.19% RTO** (lowest risk segment)
- **High-Tier (₹1,500 - ₹1,999):** **37.93% RTO**
- **VIP/Heavy Basket (₹2,000 - ₹2,999):** **40.37% RTO**

Higher ticket COD orders exhibit cash hoarding hesitation at the doorstep, leading to rejection upon arrival.

---

## 4. Data-Quality Limitations & Misleading Correlations

### Critical Traps to Avoid in Decision Logic:
1. **Pincode Overfitting:**  
   The dataset contains 1,067 unique pincodes across 2,018 orders (~1.89 orders/pincode). Tagging a pincode as "high risk" based on 1 RTO out of 1 order would be statistical malpractice. **Policy:** Never calculate raw pincode risk without Empirical Bayes smoothing (prior weight $C \ge 15$) and a minimum threshold of observations.
2. **First-Time Customer Prejudice:**  
   First-time customers make up 75.2% of the brand's sales. Automatically blocking or aggressively penalizing new customers would destroy revenue and Customer Lifetime Value (LTV). **Policy:** Prefer WhatsApp confirmation or prepaid nudging instead of cancellation.
3. **Short Address vs. Valid Short Landmark:**  
   While garbage addresses (`.`, `xyz`) have 70%+ RTO, some rural addresses in India are genuinely concise (e.g. `VPO Kalan, Opp Primary School`). **Policy:** Do not use raw character length alone; evaluate linguistic structure (presence of house number, landmark, street, colony).
4. **Time-of-Day Spurious Correlation:**  
   Night-time orders (11 PM - 5 AM) show a 28.47% RTO rate versus daytime orders at 28.37% (a statistically meaningless difference of 0.10%). Placing predictive weight on order hour would introduce noise without predictive power.
5. **Courier Performance Attribution:**  
   Xpressbees shows 31.23% RTO and Delhivery shows 25.88%. However, couriers are often assigned selectively based on serviceable pin codes in remote Tier-3/4 regions. Blindly blaming the courier without controlling for destination tier creates selection bias.

---

## 5. Cleaning Transformations Applied (`cleaned_orders.csv`)

1. **Status Normalization:** Mapped all 6 variations (`DELIVERED`, `RTO`, `Rto`, `delivered`, `RTO `, `IN_TRANSIT`) into canonical uppercase tokens: `DELIVERED`, `RTO`, `IN_TRANSIT`.
2. **City Imputation:** The 4 records with null city values were resolved using their valid PIN codes and state affiliations:
   - Order `KT100142` (PIN 302023, Rajasthan) $\rightarrow$ `Jaipur`
   - Order `KT100052` (PIN 500088, Telangana) $\rightarrow$ `Hyderabad`
   - Order `KT100146` (PIN 110019, Delhi) $\rightarrow$ `Delhi`
   - Order `KT100373` (PIN 846043, Bihar) $\rightarrow$ `Darbhanga`
3. **Phone Normalization:** Stripped `+91`, whitespace, and non-digit characters. Flagged 17 truncated 9-digit phones with `is_valid_phone = 0`.
4. **PIN Code Validation:** Formatted numeric values as clean 6-digit strings. Flagged the 12 missing values with `is_valid_pincode = 0`.
5. **Address Heuristics:** Added boolean flags `is_short_address`, `is_suspicious_name`, and `is_duplicate_record`.
