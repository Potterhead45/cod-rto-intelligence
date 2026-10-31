"""
Chronological Holdout Evaluation Script
Splits the 2,018 orders chronologically:
- Training / In-Sample: 2026-04-01 to 2026-07-31 (4 months, 1,322 orders)
- Holdout / Out-of-Sample: 2026-08-01 to 2026-09-30 (2 months, 696 orders)

Tests if empirical rates and decision rules learned on training period
generalize out-of-sample without data leakage.
"""

import pandas as pd
import numpy as np

df = pd.read_csv('data/cleaned_orders.csv')
df['dt'] = pd.to_datetime(df['order_datetime'])

train_df = df[df['dt'] < '2026-08-01'].copy()
test_df = df[df['dt'] >= '2026-08-01'].copy()

print(f"Total dataset: {len(df)}")
print(f"Train period (April-July 2026): {len(train_df)} orders")
print(f"Test period (August-Sept 2026): {len(test_df)} orders")

# 1. Baseline RTO rates in train
train_comp = train_df[train_df['final_status'].isin(['DELIVERED', 'RTO'])]
test_comp = test_df[test_df['final_status'].isin(['DELIVERED', 'RTO'])]

train_rto_rate = (train_comp['final_status'] == 'RTO').mean() * 100
test_rto_rate = (test_comp['final_status'] == 'RTO').mean() * 100

print(f"\nTrain Completed Orders: {len(train_comp)}, RTO Rate: {train_rto_rate:.2f}%")
print(f"Test Completed Orders: {len(test_comp)}, RTO Rate: {test_rto_rate:.2f}%")

# Compute Empirical Bayes city stats strictly from TRAIN set
global_train_rate = train_rto_rate / 100.0
C = 15.0

train_city_stats = {}
for city, g in train_comp.groupby('city'):
    n = len(g)
    r = (g['final_status'] == 'RTO').sum()
    smoothed = (r + C * global_train_rate) / (n + C)
    train_city_stats[city] = {
        'n': n,
        'r': r,
        'smoothed_rate': smoothed
    }

train_state_stats = {}
for state, g in train_comp.groupby('state'):
    n = len(g)
    r = (g['final_status'] == 'RTO').sum()
    smoothed = (r + C * global_train_rate) / (n + C)
    train_state_stats[state] = {
        'n': n,
        'r': r,
        'smoothed_rate': smoothed
    }

# Decision scoring function strictly using train statistics
def score_order(row):
    base_score = 24.0
    factors = []
    
    # 1. Customer history
    prior_rto = row['customer_prior_rto']
    prior_orders = row['customer_prior_orders']
    
    if prior_rto >= 2:
        base_score += 48.0
    elif prior_rto == 1:
        base_score += 16.0
    elif prior_orders > 0 and prior_rto == 0:
        base_score -= 20.0
        
    # 2. Phone validity
    if row['is_valid_phone'] == 0:
        base_score += 36.0
    else:
        base_score -= 2.0
        
    # 3. Location risk (strictly from train set!)
    city = str(row['city']).strip()
    state = str(row['state']).strip()
    if city in train_city_stats and train_city_stats[city]['n'] >= 10:
        smoothed = train_city_stats[city]['smoothed_rate']
        base_score += round((smoothed - global_train_rate) * 50)
    elif state in train_state_stats:
        smoothed = train_state_stats[state]['smoothed_rate']
        base_score += round((smoothed - global_train_rate) * 40)
        
    # 4. Name & Address heuristics
    if row['is_suspicious_name'] == 1:
        base_score += 32.0
    else:
        base_score -= 2.0
        
    addr = str(row['address']).strip().lower()
    is_placeholder = addr in ['.', 'xyz', 'home', 'call me'] or len(addr) < 5
    if is_placeholder:
        base_score += 38.0
    elif len(addr) < 12:
        base_score += 22.0
        
    # 5. Order value
    val = row['order_value']
    if val >= 2000:
        base_score += 14.0
    elif val >= 1500:
        base_score += 8.0
    elif val <= 0:
        base_score += 15.0
    elif 900 <= val <= 1400:
        base_score -= 5.0
        
    # 6. Channel
    utm = str(row['utm_source']).strip().lower()
    if utm == 'meta_ads':
        base_score += 5.0
    elif utm == 'direct':
        base_score -= 6.0
        
    # Invariant 1: First-time customer protection
    if prior_orders == 0 and prior_rto == 0 and not is_placeholder and row['is_valid_phone'] == 1 and base_score >= 70:
        base_score = 68.0
        
    # Invariant 2: High confidence failure
    if (prior_rto >= 2 and prior_orders == 0) or addr == '.' or (is_placeholder and row['is_valid_phone'] == 0):
        base_score = max(base_score, 70.0)
        
    score = max(0, min(100, round(base_score)))
    
    if score <= 24:
        action = 'SHIP_AS_IS'
    elif score <= 44:
        action = 'SHIP_AFTER_CONFIRMATION'
    elif score <= 69:
        action = 'NUDGE_TO_PREPAID'
    else:
        action = 'HOLD_CANCEL'
        
    return pd.Series([score, action], index=['risk_score', 'action'])

# Evaluate out-of-sample on test_df
test_scored = test_comp.copy()
test_scored[['risk_score', 'action']] = test_scored.apply(score_order, axis=1)

print("\n--- OUT-OF-SAMPLE EVALUATION RESULTS (August–September 2026, 696 Orders) ---")
test_summary = test_scored.groupby('action')['final_status'].agg(
    total='count',
    rtos=lambda x: (x == 'RTO').sum(),
    rto_rate_pct=lambda x: round((x == 'RTO').mean() * 100, 2)
).reset_index()

test_scored_risk = test_scored.groupby('action')['risk_score'].mean().round(1).reset_index()
merged = pd.merge(test_summary, test_scored_risk, on='action')
print(merged.to_string(index=False))

# Calculate sum of orders and sum of RTOs
print("\nSum of test action counts:", test_summary['total'].sum(), "(Total completed test:", len(test_comp), ")")
print("Sum of test RTO counts:", test_summary['rtos'].sum(), "(Actual RTOs in test:", (test_comp['final_status'] == 'RTO').sum(), ")")
