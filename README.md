# COD Risk Intelligence — AI-Powered COD Risk & Decision Platform

> **Reduce RTO. Protect Revenue. Make Smarter Decisions.**

A full-stack Cash-on-Delivery (COD) risk scoring engine, automated WhatsApp simulation platform, unit economics financial engine, and operational dashboard built for direct-to-consumer e-commerce brands in India.

---

## 1. Project Overview

Cash-on-Delivery orders in India suffer high Return-to-Origin (RTO) rates (typically 25%–35%), causing heavy financial losses in unrecovered forward freight, reverse logistics, packaging, and transit inventory damage. 

**COD Risk Intelligence** solves this problem by:
1. **Scoring every incoming order** from 0 to 100 using a hybrid deterministic and AI-powered engine.
2. **Automating 4 intelligent action tiers**:
   - `SHIP_AS_IS` (Score 0–24): Low-risk, auto-approved for instant dispatch.
   - `SHIP_AFTER_CONFIRMATION` (Score 25–44): Automated WhatsApp confirmation before warehouse packing.
   - `NUDGE_TO_PREPAID` (Score 45–69): Offers instant ₹50 discount via WhatsApp UPI link, converting COD to prepaid (dropping RTO from 28% to 4%).
   - `HOLD_CANCEL` (Score 70–100): Intercepts chronic 2+ RTO offenders and physically undeliverable placeholder addresses (`.`, `xyz`).
3. **Protecting First-Time Buyers**: Never automatically penalizing new customers merely because they are new.
4. **Providing an Interactive WhatsApp Simulator**: Full in-app chat simulation with dual English/Hinglish templates, interactive replies, payment gateway triggers (success/failure), and 24-hour timeout expiration.
5. **Calculating Honest Net Financial Impact**: Accounting for the ₹169.40 operational RTO loss, ₹402.38 delivered profit margin, prepaid discount costs, and sacrificed margin on genuine cancelled orders without double counting.

---

## 2. Technology Stack

- **Backend:** Node.js (v24), Fastify v5, TypeScript, Zod schema validation, `better-sqlite3`.
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide icons.
- **Database:** SQLite with Write-Ahead Logging (`pragma journal_mode = WAL`) and relational indexes (designed for zero-effort PostgreSQL migration).
- **AI Engine:** Groq Cloud API (`openai/gpt-oss-120b`, OpenAI SDK compatible) + deterministic, zero-latency offline mock fallback.
- **Testing:** Vitest (39 passing tests covering data normalization, decision engine rules, Groq LLM integration, WhatsApp workflows, and financial formulas).

---

## 3. Prerequisites

- **Node.js:** v18.0.0 or higher (Tested on Node v24.19.0).
- **npm:** v9.0.0 or higher.
- **Python:** Python 3.10+ (used for Milestone 1 baseline analysis scripts; pandas and numpy installed).
- **OS:** Windows, macOS, or Linux. (On Windows, use `npm.cmd`).

---

## 4. Quick Start (Run in Under 5 Minutes)

### Step 1: Install Dependencies
Open your PowerShell or terminal in the project root:
```powershell
# Install backend dependencies
npm.cmd install

# Install frontend dependencies
npm.cmd --prefix client install
```

### Step 2: Run Data Analysis & Verify Baseline Figures (Milestone 1)
```powershell
python scripts/analyze_data.py
```
*Outputs: `data/cleaned_orders.csv`, `data/analysis_summary.json`, and verifies all 13 baseline figures with 100% precision.*

### Step 3: Initialize Database and Seed Historical Orders (2,018 Orders)
```powershell
npm.cmd run seed
```
*Initializes SQLite schema in `data/cod_rto.sqlite`, scores all 2,018 historical orders through the decision engine, and creates sample WhatsApp demo workflows.*

### Step 4: Run the Complete Test Suite
```powershell
npm.cmd test
```
*Executes all 39 Vitest unit and integration tests across data normalization, decision engine rules, Groq LLM integration, WhatsApp workflows, and financial equations.*

### Step 5: Start Frontend and Backend
You can start the full stack in one of two ways:

#### Option A: Single Command Full-Stack Production Mode
```powershell
# Build the client and start the server
npm.cmd run build
npm.cmd start
```
*Open your browser at **http://localhost:3001** to view the live app!*

#### Option B: Dual Development Server Mode
Run backend in one terminal:
```powershell
npm.cmd run dev:backend
```
*(Runs Fastify API at http://localhost:3001)*

In a second terminal, run Vite frontend dev server:
```powershell
npm.cmd run dev:frontend
```
*(Runs Vite React at **http://localhost:5173** with hot reload and API proxying)*

---

## 5. AI Configuration (Mock Mode vs. Real Groq API)

The entire application is engineered to work **100% offline out-of-the-box without requiring an API key**.

### How Mock AI Works (Default)
When no `GROQ_API_KEY` is detected in the environment or `.env`:
- The system automatically engages the deterministic mock analyzer (`server/engine/llm-analyzer.ts`).
- It parses Indian Hinglish address expressions (e.g. *"ghar ka naam"*, *"near water tank"*, *"ke paas"*), assesses completeness scores (0–100), extracts missing delivery components, and identifies fake test names (`test order`, `asdf`).
- Zero API cost, zero network latency, and 100% deterministic test repeatability.

### How to Configure Real Groq AI
If you wish to use real Groq ultra-fast LLM inference (`openai/gpt-oss-120b`):
1. Copy `.env.example` to `.env` in the project root:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=openai/gpt-oss-120b
   PORT=3001
   ```
2. Replace `your_groq_api_key_here` with your real Groq API key (starts with `gsk_`).
3. Restart the backend (`npm.cmd start` or `npm.cmd run dev:backend`).
4. The Settings page will immediately detect and display `Groq API Key Detected`, routing address understanding through Groq at `https://api.groq.com/openai/v1` with strict Zod validation and a 4.5s automatic fallback timeout.

---

## 6. Project Structure

```text
COD-RTO-Assignment/
├── .env.example                   # Safe environment template
├── .gitignore                     # Git ignore rules protecting .env
├── data/
│   ├── orders_sample.csv          # Original historical dataset (Preserved untouched)
│   ├── cleaned_orders.csv         # Cleaned, normalized dataset
│   ├── analysis_summary.json      # Machine-readable audit metrics
│   └── cod_rto.sqlite             # Relational SQLite database
├── docs/
│   ├── DATA_ANALYSIS.md           # Milestone 1: Exhaustive dataset audit & reconciliation
│   ├── BUSINESS_MEMO.md           # Milestone 4: Founder-facing unit economics memo
│   ├── DECISION_LOG.md            # Architectural decisions, alternatives, and trade-offs
│   ├── AI_USAGE_LOG.md            # AI usage, detected weaknesses, and corrections
│   ├── TEST_RESULTS.md            # Verifiable test execution commands and logs
│   └── FINAL_AUDIT.md             # Pre-submission correctness audit & holdout validation
├── scripts/
│   └── analyze_data.py            # Reusable Python analysis pipeline
├── server/
│   ├── db/
│   │   ├── schema.ts              # SQLite table definitions
│   │   ├── index.ts               # Database connection and default settings
│   │   └── seed.ts                # Seeder populating orders and decision scoring
│   ├── engine/
│   │   ├── types.ts               # Zod schemas and TypeScript interfaces
│   │   ├── risk-scoring.ts        # Hybrid decision engine & Bayes smoothing
│   │   ├── llm-analyzer.ts        # Groq structured JSON & deterministic mock
│   │   ├── whatsapp.ts            # WhatsApp state machine & workflows
│   │   └── financial.ts           # Financial impact & trade-off engine
│   ├── routes/
│   │   ├── dashboard.ts           # KPI cards, charts, and date filter API
│   │   ├── orders.ts              # Order list, search, detail, create, override
│   │   ├── whatsapp.ts            # WhatsApp simulator interactive API
│   │   ├── settings.ts            # Editable thresholds & weights API
│   │   └── financial.ts           # Financial scenario simulator API
│   └── server.ts                  # Fastify entrypoint & static client serving
├── client/
│   ├── src/
│   │   ├── api.ts                 # Typed API client
│   │   ├── App.tsx                # App layout & tab routing
│   │   └── components/
│   │       ├── Sidebar.tsx        # Deep navy fintech navigation sidebar
│   │       ├── DashboardView.tsx  # Executive KPIs, Recharts, financial cards
│   │       ├── OrdersView.tsx     # Order management, drawer, Shopify form
│   │       ├── WhatsAppSimulatorView.tsx # Interactive smartphone chat frame
│   │       ├── FinancialView.tsx  # Unit economics ledger & what-if sliders
│   │       └── SettingsView.tsx   # Editable thresholds & AI configuration
│   └── package.json
├── tests/
│   ├── data-normalization.test.ts # Status, phone, and pincode cleaning tests
│   ├── decision-engine.test.ts    # Risk rules, customer history, invariants
│   ├── whatsapp-simulator.test.ts # Confirmation & prepaid state machine tests
│   ├── financial-engine.test.ts   # ₹169.40 loss, ₹402.38 profit, trade-off tests
│   └── api-integration.test.ts    # Fastify endpoint and override tests
├── PROGRESS.md                    # Running progress tracker
└── package.json
```

---

## 7. Key Features & Walkthrough

1. **Executive Dashboard:**
   - Real KPI counts for all 2,018 historical orders (76.2% Ship As-Is, 13.6% Confirmation, 5.9% Prepaid Nudge, 4.3% Hold/Cancel).
   - Net financial impact calculation showing +₹35,000 to +₹42,000 monthly benefit.
   - Interactive charts for daily trends, courier RTO rates, top city risk, and realized RTO calibration.
   - Period filters (All, Last 30D, Last 7D, Yesterday) and Source filters (All, Historical, Simulated).
2. **Order Management & Inspection:**
   - Search by Order ID, Customer Name, or Phone number.
   - Click "Inspect" on any order to open the complete customer details drawer, view all explainable risk factor scores and plain-English reasons, and execute manual overrides with audit logging.
   - Click "Simulate New Shopify COD Order" to test custom orders or quick-load realistic test personas (Safe buyer, Chronic RTO buyer, Fake address buyer).
3. **WhatsApp Simulator:**
   - Visual smartphone frame (WhatsApp style) with real-time bubble streams.
   - Test `SHIP_AFTER_CONFIRMATION` (YES confirms, NO cancels, random reply prompts clarification).
   - Test `NUDGE_TO_PREPAID` (PAY online opens simulated payment gateway, COD declines discount).
   - Test Payment Gateway Outcomes (Simulate Success converts order to PREPAID; Simulate Failure alerts user).
   - Test 24-hour timeout expiration.
4. **Financial Simulator:**
   - Complete unit economics breakdown of the ₹169.40 operational RTO loss (fwd/rev/pkg/damage).
   - Mathematical proof of the 70.36% breakeven cancellation threshold.
   - Interactive sliders to test what-if scenarios (volume, COD share, shipping costs, damage %).
5. **Settings & Thresholds:**
   - Fully editable decision thresholds with a live visual spectrum preview.
   - Configurable factor weights, WhatsApp timeouts, prepaid discount amounts, and location sample sizes.
   - All settings persisted in SQLite.
