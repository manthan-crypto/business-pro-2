"""Quarterly (fiscal) analytics.

Fiscal year (Indian FY convention): Apr–Mar.
Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar
"""
from typing import List, Dict, Any
from collections import defaultdict
from analytics import _safe_float


def _fiscal_year(year: int, month: int) -> int:
    """Given a calendar year and month (1-12), return the fiscal year label (starts April)."""
    return year if month >= 4 else year - 1


def _fiscal_quarter(month: int) -> int:
    """Return quarter 1..4 based on month."""
    if month in (4, 5, 6):
        return 1
    if month in (7, 8, 9):
        return 2
    if month in (10, 11, 12):
        return 3
    return 4  # Jan, Feb, Mar


def quarterly_analytics(txs: List[dict], targets: List[dict] = None) -> Dict[str, Any]:
    """Group transactions by fiscal year & quarter and return one row per (FY, Q).

    Each row: total sales, GP, GP%, orders, customers, AOV, growth vs prev Q,
    growth vs same Q last year, target, achievement %.
    """
    # Bucket transactions
    buckets = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "orders": set(), "customers": set()})
    for t in txs:
        d = t.get("invoice_date")
        if not d or len(d) < 7:
            continue
        try:
            year, month = int(d[:4]), int(d[5:7])
        except (ValueError, TypeError):
            continue
        fy = _fiscal_year(year, month)
        q = _fiscal_quarter(month)
        key = (fy, q)
        e = buckets[key]
        e["sales"] += _safe_float(t.get("net_amount"))
        e["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            e["orders"].add(t.get("invoice_no"))
        if t.get("customer"):
            e["customers"].add(t.get("customer"))

    # Targets bucketed by fiscal quarter
    target_buckets = defaultdict(float)
    for tg in (targets or []):
        m = tg.get("month", "")
        if len(m) < 7:
            continue
        try:
            y, mo = int(m[:4]), int(m[5:7])
        except (ValueError, TypeError):
            continue
        target_buckets[(_fiscal_year(y, mo), _fiscal_quarter(mo))] += _safe_float(tg.get("target"))

    # Sort by FY & Q for growth comparison
    sorted_keys = sorted(buckets.keys())
    rows = []
    for fy, q in sorted_keys:
        e = buckets[(fy, q)]
        orders = len(e["orders"]) or 1
        rows.append({
            "fiscal_year": fy,
            "fy_label": f"FY{fy}-{str(fy + 1)[-2:]}",  # e.g. FY2026-27
            "quarter": q,
            "q_label": f"Q{q}",
            "period": f"FY{fy} Q{q}",
            "sales": round(e["sales"], 2),
            "gp": round(e["gp"], 2),
            "gp_pct": round(e["gp"] / e["sales"] * 100, 2) if e["sales"] else 0,
            "orders": len(e["orders"]),
            "customers": len(e["customers"]),
            "aov": round(e["sales"] / orders, 2),
            "target": round(target_buckets.get((fy, q), 0), 2),
        })

    # Compute growth vs previous quarter (sequential) and vs same quarter last year (YoY)
    idx = {(r["fiscal_year"], r["quarter"]): i for i, r in enumerate(rows)}
    for r in rows:
        prev_i = idx.get((r["fiscal_year"], r["quarter"] - 1)) if r["quarter"] > 1 else idx.get((r["fiscal_year"] - 1, 4))
        yoy_i = idx.get((r["fiscal_year"] - 1, r["quarter"]))
        r["qoq_growth_pct"] = None
        r["yoy_growth_pct"] = None
        if prev_i is not None and rows[prev_i]["sales"]:
            r["qoq_growth_pct"] = round((r["sales"] - rows[prev_i]["sales"]) / rows[prev_i]["sales"] * 100, 2)
        if yoy_i is not None and rows[yoy_i]["sales"]:
            r["yoy_growth_pct"] = round((r["sales"] - rows[yoy_i]["sales"]) / rows[yoy_i]["sales"] * 100, 2)
        r["achievement_pct"] = round(r["sales"] / r["target"] * 100, 2) if r["target"] else None

    # Aggregate per fiscal year
    by_fy = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "orders": 0, "customers": set(), "target": 0.0, "quarters": []})
    # For customer uniqueness at FY level, we need to re-scan
    fy_customers = defaultdict(set)
    for t in txs:
        d = t.get("invoice_date")
        if not d or len(d) < 7:
            continue
        try:
            year, month = int(d[:4]), int(d[5:7])
        except (ValueError, TypeError):
            continue
        fy = _fiscal_year(year, month)
        if t.get("customer"):
            fy_customers[fy].add(t.get("customer"))
    for r in rows:
        fy = r["fiscal_year"]
        by_fy[fy]["sales"] += r["sales"]
        by_fy[fy]["gp"] += r["gp"]
        by_fy[fy]["orders"] += r["orders"]
        by_fy[fy]["target"] += r["target"]
        by_fy[fy]["quarters"].append(r)
    fy_summary = []
    for fy, agg in sorted(by_fy.items()):
        sales = agg["sales"]
        fy_summary.append({
            "fiscal_year": fy,
            "fy_label": f"FY{fy}-{str(fy + 1)[-2:]}",
            "sales": round(sales, 2),
            "gp": round(agg["gp"], 2),
            "gp_pct": round(agg["gp"] / sales * 100, 2) if sales else 0,
            "orders": agg["orders"],
            "customers": len(fy_customers.get(fy, set())),
            "target": round(agg["target"], 2),
            "achievement_pct": round(sales / agg["target"] * 100, 2) if agg["target"] else None,
            "quarters": agg["quarters"],
        })

    return {"quarterly_rows": rows, "fiscal_years": fy_summary}
