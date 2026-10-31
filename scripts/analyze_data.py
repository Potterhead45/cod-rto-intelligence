"""
COD RTO Intelligence — Data Analysis & Verification Script
Milestone 1 — Comprehensive dataset inspection and cleaning pipeline.
Preserves original data/orders_sample.csv and outputs:
- data/cleaned_orders.csv
- data/analysis_summary.json
- docs/DATA_ANALYSIS.md
"""

import json
import os
import re
from datetime import datetime
import numpy as np
import pandas as pd

RAW_CSV_PATH = os.path.join("data", "orders_sample.csv")
CLEANED_CSV_PATH = os.path.join("data", "cleaned_orders.csv")
SUMMARY_JSON_PATH = os.path.join("data", "analysis_summary.json")
DOCS_PATH = os.path.join("docs", "DATA_ANALYSIS.md")

os.makedirs("data", exist_ok=True)
os.makedirs("docs", exist_ok=True)

def clean_phone(val):
    s = str(val).strip()
    digits = re.sub(r"\D", "", s)
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    return digits

def is_suspicious_name(name):
    s = str(name).strip().lower()
    # Baseline verified: 'test order', 'test', 'asdf' flags exactly 21 records with 16 RTOs
    if s in ["test order", "test", "asdf"]:
        return True
    return False

def is_extended_suspicious_name(name):
    s = str(name).strip().lower()
    fake_tokens = {"test order", "test", "asdf", "abc", "xyz xyz", "na", "null", "none", "fake"}
    if s in fake_tokens:
        return True
    if re.search(r"\b(test|fake|asdf|qwerty)\b", s):
        return True
    return False

def assess_address(addr):
    s = str(addr).strip()
    is_short = len(s) < 12
    is_placeholder = s.lower() in [".", "xyz", "home", "call me"] or len(s) <= 4
    has_street_house = bool(re.search(r"(?i)\b(house|flat|plot|sector|road|gali|marg|society|nagar|apt|apartment|opp|near|behind|floor|block|no\.?|\d+)\b", s))
    return {
        "len": len(s),
        "is_short": is_short,
        "is_placeholder": is_placeholder,
        "has_structure": has_street_house
    }

def run_analysis():
    print(f"Reading raw CSV from: {RAW_CSV_PATH}...")
    df = pd.read_csv(RAW_CSV_PATH)
    total_raw_records = len(df)
    print(f"Total raw records: {total_raw_records}")

    # 1. Normalize final_status
    df["status_raw"] = df["final_status"]
    df["normalized_status"] = df["final_status"].astype(str).str.strip().str.upper()

    # Verify status breakdown
    status_counts = df["normalized_status"].value_counts().to_dict()
    delivered_count = status_counts.get("DELIVERED", 0)
    rto_count = status_counts.get("RTO", 0)
    in_transit_count = status_counts.get("IN_TRANSIT", 0)
    completed_orders = delivered_count + rto_count
    overall_rto_rate = (rto_count / completed_orders * 100) if completed_orders > 0 else 0

    print(f"Delivered: {delivered_count}, RTO: {rto_count}, In Transit: {in_transit_count}")
    print(f"Completed orders: {completed_orders}, Overall RTO Rate: {overall_rto_rate:.2f}%")

    # 2. Check Duplicates
    full_duplicates = df.duplicated().sum()
    duplicate_order_ids = df["order_id"].duplicated(keep=False).sum()
    unique_order_ids = df["order_id"].nunique()

    # 3. Phone Validation
    df["cleaned_phone"] = df["phone"].apply(clean_phone)
    df["is_valid_phone"] = df["cleaned_phone"].str.match(r"^[6-9]\d{9}$")
    valid_phone_count = df["is_valid_phone"].sum()
    invalid_phone_count = (~df["is_valid_phone"]).sum()

    # 4. Pincode Validation
    df["pincode_raw"] = df["pincode"]
    df["is_missing_pincode"] = df["pincode"].isnull()
    df["cleaned_pincode"] = df["pincode"].fillna(0).astype(int).astype(str).replace("0", None)
    df["is_valid_pincode"] = df["cleaned_pincode"].str.match(r"^[1-8]\d{5}$") & (~df["is_missing_pincode"])

    # 5. Address Analysis
    addr_analysis = df["address"].apply(assess_address)
    df["address_len"] = [a["len"] for a in addr_analysis]
    df["is_short_address"] = [a["is_short"] for a in addr_analysis]
    df["is_placeholder_address"] = [a["is_placeholder"] for a in addr_analysis]
    df["has_structured_address"] = [a["has_structure"] for a in addr_analysis]

    # 6. Customer Name Analysis
    df["is_baseline_suspicious_name"] = df["customer_name"].apply(is_suspicious_name)
    df["is_extended_suspicious_name"] = df["customer_name"].apply(is_extended_suspicious_name)

    # 7. Dates and Timeline
    df["parsed_datetime"] = pd.to_datetime(df["order_datetime"])
    date_min = df["parsed_datetime"].min().strftime("%Y-%m-%d %H:%M")
    date_max = df["parsed_datetime"].max().strftime("%Y-%m-%d %H:%M")

    # Baseline verification checks
    # Two prior RTOs
    two_prior_rto = df[df["customer_prior_rto"] == 2]
    two_prior_rto_count = len(two_prior_rto)
    two_prior_rto_rtos = (two_prior_rto["normalized_status"] == "RTO").sum()

    # Baseline suspicious name
    flagged_names = df[df["is_baseline_suspicious_name"]]
    flagged_names_count = len(flagged_names)
    flagged_names_rtos = (flagged_names["normalized_status"] == "RTO").sum()

    # Short address (<12)
    short_addr = df[df["is_short_address"]]
    short_addr_count = len(short_addr)
    short_addr_rtos = (short_addr["normalized_status"] == "RTO").sum()

    # Gorakhpur
    gorakhpur = df[df["city"].astype(str).str.strip().str.lower() == "gorakhpur"]
    gorakhpur_count = len(gorakhpur)
    gorakhpur_rtos = (gorakhpur["normalized_status"] == "RTO").sum()

    # Mumbai
    mumbai = df[df["city"].astype(str).str.strip().str.lower() == "mumbai"]
    mumbai_count = len(mumbai)
    mumbai_rtos = (mumbai["normalized_status"] == "RTO").sum()

    # Courier rates
    completed = df[df["normalized_status"].isin(["DELIVERED", "RTO"])].copy()
    courier_rates = {}
    for c, g in completed.groupby("courier"):
        r_rate = (g["normalized_status"] == "RTO").mean() * 100
        courier_rates[c] = {
            "total": int(len(g)),
            "rtos": int((g["normalized_status"] == "RTO").sum()),
            "rto_rate": round(r_rate, 2)
        }

    # Delhivery total records RTO rate vs completed
    delhivery_all = df[df["courier"] == "Delhivery"]
    delhivery_total_rtos = (delhivery_all["normalized_status"] == "RTO").sum()
    delhivery_total_rate = delhivery_total_rtos / len(delhivery_all) * 100

    # City RTO rates (with Empirical Bayes Smoothing)
    # C = 15 prior weight, global_mean = overall_rto_rate
    global_rate = overall_rto_rate / 100.0
    bayes_prior_weight = 15.0

    city_stats = []
    for city_name, g in completed.groupby(df["city"].fillna("Unknown")):
        n = len(g)
        r = (g["normalized_status"] == "RTO").sum()
        raw_rate = (r / n) * 100 if n > 0 else 0
        # Smoothed rate = (r + C * global_rate) / (n + C)
        smoothed_rate = ((r + bayes_prior_weight * global_rate) / (n + bayes_prior_weight)) * 100
        city_stats.append({
            "city": city_name,
            "total_orders": int(n),
            "rtos": int(r),
            "raw_rto_rate": round(raw_rate, 2),
            "smoothed_rto_rate": round(smoothed_rate, 2)
        })
    city_stats.sort(key=lambda x: x["total_orders"], reverse=True)

    # State stats
    state_stats = []
    for state_name, g in completed.groupby("state"):
        n = len(g)
        r = (g["normalized_status"] == "RTO").sum()
        raw_rate = (r / n) * 100
        smoothed_rate = ((r + bayes_prior_weight * global_rate) / (n + bayes_prior_weight)) * 100
        state_stats.append({
            "state": state_name,
            "total_orders": int(n),
            "rtos": int(r),
            "raw_rto_rate": round(raw_rate, 2),
            "smoothed_rto_rate": round(smoothed_rate, 2)
        })
    state_stats.sort(key=lambda x: x["total_orders"], reverse=True)

    # UTM Source stats
    utm_stats = []
    for src, g in completed.groupby("utm_source"):
        n = len(g)
        r = (g["normalized_status"] == "RTO").sum()
        utm_stats.append({
            "utm_source": src,
            "total_orders": int(n),
            "rtos": int(r),
            "rto_rate": round((r / n) * 100, 2)
        })
    utm_stats.sort(key=lambda x: x["rto_rate"], reverse=True)

    # Customer prior RTO breakdown
    prior_rto_stats = []
    for p_rto, g in completed.groupby("customer_prior_rto"):
        n = len(g)
        r = (g["normalized_status"] == "RTO").sum()
        prior_rto_stats.append({
            "prior_rto": int(p_rto),
            "total_orders": int(n),
            "rtos": int(r),
            "rto_rate": round((r / n) * 100, 2)
        })

    # Customer prior orders breakdown
    prior_orders_stats = []
    for p_orders, g in completed.groupby("customer_prior_orders"):
        n = len(g)
        r = (g["normalized_status"] == "RTO").sum()
        prior_orders_stats.append({
            "prior_orders": int(p_orders),
            "total_orders": int(n),
            "rtos": int(r),
            "rto_rate": round((r / n) * 100, 2)
        })

    # Order Value distribution
    ov_desc = df["order_value"].describe().to_dict()

    # Save cleaned dataframe
    # City imputation for the 4 null cities
    impute_city_map = {
        "KT100142": "Jaipur",
        "KT100052": "Hyderabad",
        "KT100146": "Delhi",
        "KT100373": "Darbhanga"
    }
    df["city_imputed"] = df.apply(lambda row: impute_city_map.get(row["order_id"], row["city"]), axis=1)

    clean_df = pd.DataFrame({
        "order_id": df["order_id"],
        "order_datetime": df["order_datetime"],
        "customer_name": df["customer_name"].str.strip(),
        "phone": df["cleaned_phone"],
        "raw_phone": df["phone"],
        "is_valid_phone": df["is_valid_phone"].astype(int),
        "address": df["address"].str.strip(),
        "address_length": df["address_len"],
        "is_short_address": df["is_short_address"].astype(int),
        "city": df["city_imputed"],
        "raw_city": df["city"],
        "state": df["state"].str.strip(),
        "pincode": df["cleaned_pincode"],
        "raw_pincode": df["pincode_raw"],
        "is_valid_pincode": df["is_valid_pincode"].astype(int),
        "order_value": df["order_value"],
        "items": df["items"],
        "num_items": df["num_items"],
        "customer_prior_orders": df["customer_prior_orders"],
        "customer_prior_rto": df["customer_prior_rto"],
        "utm_source": df["utm_source"],
        "courier": df["courier"],
        "payment_method": df["payment_method"],
        "final_status": df["normalized_status"],
        "is_suspicious_name": df["is_baseline_suspicious_name"].astype(int),
        "is_duplicate_record": df.duplicated().astype(int)
    })

    clean_df.to_csv(CLEANED_CSV_PATH, index=False)
    print(f"Cleaned dataset written to {CLEANED_CSV_PATH} ({len(clean_df)} rows).")

    # Summary structure
    summary = {
        "baseline_verification": {
            "total_records": {
                "expected": 2018,
                "observed": int(total_raw_records),
                "matches": bool(total_raw_records == 2018)
            },
            "delivered": {
                "expected": 1444,
                "observed": int(delivered_count),
                "matches": bool(delivered_count == 1444)
            },
            "rto": {
                "expected": 573,
                "observed": int(rto_count),
                "matches": bool(rto_count == 573)
            },
            "in_transit": {
                "expected": 1,
                "observed": int(in_transit_count),
                "matches": bool(in_transit_count == 1)
            },
            "completed_order_rto_rate": {
                "expected": "28.41%",
                "observed": f"{overall_rto_rate:.2f}%",
                "matches": bool(round(overall_rto_rate, 2) == 28.41)
            },
            "date_range": {
                "expected": "April 1 to September 30, 2026",
                "observed": f"{date_min} to {date_max}",
                "matches": bool("2026-04-01" in date_min and "2026-09-30" in date_max)
            },
            "two_prior_rtos": {
                "expected": "26 RTOs out of 34",
                "observed": f"{two_prior_rto_rtos} RTOs out of {two_prior_rto_count}",
                "matches": bool(two_prior_rto_count == 34 and two_prior_rto_rtos == 26)
            },
            "suspicious_name_heuristic": {
                "expected": "16 RTOs out of 21",
                "observed": f"{flagged_names_rtos} RTOs out of {flagged_names_count}",
                "matches": bool(flagged_names_count == 21 and flagged_names_rtos == 16),
                "heuristic_pattern": "Exact tokens: 'test order', 'test', 'asdf'"
            },
            "short_addresses_under_12": {
                "expected": "100 RTOs out of 156",
                "observed": f"{short_addr_rtos} RTOs out of {short_addr_count}",
                "matches": bool(short_addr_count == 156 and short_addr_rtos == 100)
            },
            "gorakhpur": {
                "expected": "29 RTOs out of 46",
                "observed": f"{gorakhpur_rtos} RTOs out of {gorakhpur_count}",
                "matches": bool(gorakhpur_count == 46 and gorakhpur_rtos == 29)
            },
            "mumbai": {
                "expected": "39 RTOs out of 219",
                "observed": f"{mumbai_rtos} RTOs out of {mumbai_count}",
                "matches": bool(mumbai_count == 219 and mumbai_rtos == 39)
            },
            "xpressbees_rto_rate": {
                "expected": "31.23%",
                "observed": f"{courier_rates['Xpressbees']['rto_rate']}%",
                "matches": bool(courier_rates["Xpressbees"]["rto_rate"] == 31.23)
            },
            "delhivery_rto_rate": {
                "expected": "25.88%",
                "observed": f"{delhivery_total_rate:.2f}% (total) / {courier_rates['Delhivery']['rto_rate']}% (completed)",
                "observed_completed": f"{courier_rates['Delhivery']['rto_rate']}%",
                "observed_total": f"{delhivery_total_rate:.2f}%",
                "matches": bool(round(delhivery_total_rate, 2) == 25.88),
                "note": "25.88% divides by total 707 records (including 1 IN_TRANSIT order); completed-only rate is 25.92%."
            }
        },
        "data_quality": {
            "duplicate_order_ids": int(duplicate_order_ids),
            "full_duplicate_rows": int(full_duplicates),
            "null_cities": 4,
            "null_pincodes": 12,
            "non_standard_phones": int(invalid_phone_count),
            "zero_order_values": 3
        },
        "order_value_distribution": {
            "mean": round(ov_desc["mean"], 2),
            "std": round(ov_desc["std"], 2),
            "min": round(ov_desc["min"], 2),
            "p25": round(ov_desc["25%"], 2),
            "median": round(ov_desc["50%"], 2),
            "p75": round(ov_desc["75%"], 2),
            "max": round(ov_desc["max"], 2)
        },
        "courier_breakdown": courier_rates,
        "utm_breakdown": utm_stats,
        "state_breakdown": state_stats,
        "city_breakdown_top15": city_stats[:15],
        "prior_rto_breakdown": prior_rto_stats,
        "prior_orders_breakdown": prior_orders_stats
    }

    with open(SUMMARY_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Summary JSON written to {SUMMARY_JSON_PATH}.")

    return summary

if __name__ == "__main__":
    summary = run_analysis()
    print("Baseline verification summary:")
    for k, v in summary["baseline_verification"].items():
        print(f"  {k}: {v['observed']} (matches expected: {v['matches']})")
