# Engineering Decision Log: COD Risk Intelligence

**Project:** COD RTO Intelligence Platform  
**Architecture:** Node.js + Fastify + TypeScript + SQLite + React + Vite + Tailwind CSS  
**Date:** October 31, 2026  

---

## Decision 1: Database Architecture (SQLite with WAL Mode & PostgreSQL Migration Readiness)

- **Context:** The application must run locally without cloud dependencies while supporting relational integrity, concurrent read/write queries during simulations, and future production migration to PostgreSQL.
- **Alternatives Considered:**
  1. *In-Memory JSON / LowDB:* Easiest to initialize, but lacks SQL aggregation, indexes, transaction isolation, and relational foreign keys.
  2. *PostgreSQL / Docker:* Powerful, but violates the requirement for easy local setup without heavy infrastructure prerequisites.
  3. *SQLite via `better-sqlite3`:* Fast, synchronous execution, zero background daemon overhead, standard SQL dialect.
- **Decision:** Selected `better-sqlite3` with Write-Ahead Logging (`pragma journal_mode = WAL`) and foreign key enforcement. Structured schemas (`orders`, `decisions`, `whatsapp_messages`, `settings`) use standard ANSI SQL types (`TEXT`, `INTEGER`, `REAL`) allowing zero-effort migration to PostgreSQL via Prisma or Drizzle.
- **Trade-offs:** Single-node concurrency limit; however, SQLite WAL easily sustains 10,000+ operations/sec locally, far exceeding requirements.

---

## Decision 2: Hybrid Risk Engine Architecture (Deterministic Rules + Bounded LLM Scoring)

- **Context:** Deciding how to balance deterministic safety rules (prior RTO count, phone validity) with LLM natural language understanding for Indian addresses and names.
- **Alternatives Considered:**
  1. *Pure Black-Box Machine Learning (XGBoost / LightGBM):* Lacks instant explainability; difficult for operations users to adjust thresholds on the fly without retraining.
  2. *Pure LLM Prompting (Sending order details and asking LLM for a decision):* High latency (1.5–3s), expensive at scale, non-deterministic, risk of hallucinated cancellations, and complete downtime if the API is offline.
  3. *Hybrid Architecture:* Deterministic baseline rules and Empirical Bayes smoothing form the foundation; LLM is used strictly for address parsing and name suspicion with structured Zod output and deterministic mock fallback.
- **Decision:** Implemented the Hybrid Architecture. Deterministic checks handle customer history, phone digits, location statistics, and order value. The LLM only evaluates address completeness (0-100 score, missing components) and name suspicion. Invariants strictly prevent the LLM from ever auto-cancelling an order or overriding clean customer history.
- **Trade-offs:** Requires maintaining both deterministic scoring weights and LLM prompt schemas, but achieves 100% uptime, zero-key local execution, and explainable auditability.

---

## Decision 3: Empirical Bayes Smoothing for Geographic Pincode / City Risk

- **Context:** With 1,067 unique PIN codes across 2,018 orders, average sample size per PIN code is only ~1.89 orders. A town with 1 order that resulted in RTO would have a raw 100% RTO rate.
- **Alternatives Considered:**
  1. *Raw Pincode Blacklisting:* Common in naive e-commerce setups, but suffers from extreme small-sample noise, falsely penalizing genuine buyers in low-volume areas.
  2. *State-Only Aggregation:* Too coarse; ignores real intra-state differences (e.g., Gorakhpur in UP had a 63% RTO rate while Lucknow was 33%).
  3. *Empirical Bayes Smoothing ($C=15$):* Calculates smoothed rate $p_{\text{smoothed}} = \frac{r + C \cdot p_0}{n + C}$ where $p_0 = 28.41\%$. If sample size $n < 15$, the rate strongly shrinks towards the national average.
- **Decision:** Implemented Empirical Bayes Smoothing with a configurable minimum sample size threshold (default 15 orders).
- **Trade-offs:** Slightly underestimates early surge risk in a newly failing town, but eliminates false-positive blacklisting of safe customers.

---

## Decision 4: Financial Accounting & Avoiding Double-Counting Savings

- **Context:** Calculating the net financial impact of decision interventions while maintaining transparency regarding unknown future outcomes.
- **Alternatives Considered:**
  1. *Optimistic Accounting:* Claiming 100% of cancelled orders represent saved shipping losses without deducting the gross margin lost on genuine buyers.
  2. *Naive Margin Loss:* Assuming every cancelled order is a total loss of AOV (₹649) rather than gross margin (62% = ₹402.38).
  3. *Rigorous Probabilistic Accounting:* Separates observed historical metrics from model estimates. Accounts for:
     - Operational RTO savings (+₹169.40 per prevented RTO).
     - Cost of prepaid discounts funded (-₹50 per converted buyer).
     - Sacrificed gross margin on genuine buyers mistakenly cancelled (-₹402.38 per order).
     - Wasted Meta Ads CAC on cancelled buyers (-₹300 per buyer).
- **Decision:** Implemented Rigorous Probabilistic Accounting. Displayed in the UI with explicit labeling distinguishing observed baselines from model estimates.
- **Trade-offs:** Results show a realistic net gain (+₹35k–₹42k/mo) rather than inflated claims, building credibility with founders and finance stakeholders.

---

## Decision 5: WhatsApp Simulation vs. Real Cloud API

- **Context:** Real WhatsApp Business API requires Meta business verification, phone number provisioning, and paid template approvals that cannot run out of the box in a local testing environment.
- **Alternatives Considered:**
  1. *Mock CLI Prompts:* Hard for product/operations reviewers to visualize customer experience.
  2. *Third-Party Sandbox (e.g. Twilio Sandbox):* Requires external signups, credentials, and internet connectivity.
  3. *In-App WhatsApp Smartphone Simulator:* Visual mobile frame with real-time bubble streams, dual-language Hinglish/English toggles, quick reply buttons, simulated payment gateway webhooks, and 24-hour timeout triggers.
- **Decision:** Built a complete in-app WhatsApp smartphone simulator directly inside the dashboard.
- **Trade-offs:** Does not send real SMS/WhatsApp messages (as specified in instructions), but provides an interactive evaluation tool for operations teams to test every branch of the state machine.
