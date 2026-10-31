# AI Usage & Verification Log: COD Risk Intelligence

**Application:** COD RTO Intelligence Platform  
**Date:** October 31, 2026  
**Audience:** Technical Hiring Committee & Engineering Leadership  

---

## 1. Overview of AI Tools Utilized

During the development of this project, AI tooling was employed in two distinct capacities:
1. **Application-Level AI Integration:**
   - Groq Cloud API (`openai/gpt-oss-120b`, OpenAI SDK compatible at `https://api.groq.com/openai/v1`) using Zod schemas for analyzing Indian English/Hinglish addresses, detecting missing delivery components (house numbers, landmarks), and identifying suspicious fake buyer names.
   - Deterministic Mock Analyzer serving as an offline, zero-latency fallback when API keys are absent or network requests time out.
2. **AI Coding & Pair Programming Assistant:**
   - Antigravity AI pair programming agent utilized for rapid project scaffolding, statistical analysis script writing, SQL schema generation, and test creation.

---

## 2. Where AI Provided High Value

- **Indian Address & Colloquial Parsing:**  
  Standard regex struggles with colloquial Hinglish address structures such as *"near Water Tank, ghar ka naam Lotus niwas"*, *"Masjid ke peeche wala ghar"*, or *"ph krke aana, Hanuman Mandir ke paas"*. The LLM prompt and mock heuristic accurately identified that these are descriptive Indian landmarks rather than invalid strings.
- **Zod Schema Enforcement:**  
  Enforcing strict schema validation on LLM JSON output ensured that no unvalidated tokens or unexpected types could propagate into the decision engine.
- **Statistical Script Generation:**  
  Rapidly authored Python data analysis routines (`scripts/analyze_data.py`) to verify baseline CSV metrics and compute group-level empirical distributions.

---

## 3. Examples of Incorrect or Weak AI Suggestions & How They Were Corrected

### Example 1: Naive Substring Matching for Suspicious Names
- **Weak AI Suggestion:**  
  During the initial exploration of suspicious customer names, an AI-generated regex tested substrings: `['test', 'fake', 'asdf', 'na', 'abc']`.
- **How It Was Detected:**  
  When testing the filter, common Indian names such as *Sana Mishra*, *Ananya Singh*, and *Rohan Nair* were flagged as suspicious because "na" matched *Sana* and *Ananya*!
- **Correction Applied:**  
  Replaced loose substring matching with strict token matching (`test order`, `test`, `asdf`, exact token boundaries `\b...\b`). This verified the exact project baseline: 21 flagged orders with 16 RTOs (76.19% precision) without falsely accusing real customers.

### Example 2: Premature Deduplication in Milestone 1 Baseline Verification
- **Weak AI Suggestion:**  
  An AI suggestion proposed running `df.drop_duplicates(subset=['order_id'])` before calculating baseline metrics to ensure "clean data".
- **How It Was Detected:**  
  Deduplicating dropped 30 duplicate records, reducing total orders from 2,018 to 1,988, which altered the baseline numbers (e.g., delivered count shifted from 1,444 to 1,424).
- **Correction Applied:**  
  Separated raw descriptive baseline auditing from cleaned relational storage. The original CSV of 2,018 records was audited without row deletion to match the baseline figures, and duplicate rows were flagged with surrogate keys (`id = order_id_dup_1`) in SQLite.

### Example 3: Exact String Matching in WhatsApp Customer State Transitions
- **Weak AI Suggestion:**  
  An initial state handler tested customer replies using exact array inclusion:
  `['yes', 'ok', 'confirm'].includes(cleanLower)`.
- **How It Was Detected:**  
  Vitest unit test failed when a realistic customer replied: `"YES please confirm"`. The test failed with `AssertionError: expected 'AWAITING_CONFIRMATION' to be 'CONFIRMED'`.
- **Correction Applied:**  
  Updated state machine checks to use token boundary regexes:
  `/\b(yes|y|ha|haa|haan|confirm|ok|okay|dispatch|bhejo)\b/i.test(text)` and `/\b(pay|online|link|accept|upi)\b/i.test(text)`. All 28 tests subsequently passed.

### Example 4: NumPy Boolean Serialization Error
- **Weak AI Suggestion:**  
  The data analysis script passed NumPy boolean comparisons (`bool_`) directly into `json.dump()`.
- **How It Was Detected:**  
  Python threw `TypeError: Object of type bool_ is not JSON serializable` at line 373 during `json.dump(summary, f)`.
- **Correction Applied:**  
  Explicitly cast all boolean verification metrics using Python's native `bool()` wrapper prior to serialization.

---

## 4. Verification Policy & Invariants

Throughout development, the following safety invariants were enforced:
1. **Never claim a test passed unless it was run and verified via terminal output.**
2. **Never allow an LLM response to directly cancel an order or bypass safety rules.**
3. **Always provide a deterministic mock fallback so the application runs locally without requiring an API key.**
