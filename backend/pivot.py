"""Customer × Month pivot analysis - one row per customer, one column per month."""
from typing import List, Dict, Any
from collections import defaultdict
from analytics import _safe_float


def _fiscal_year(year: int, month: int) -> int:
    return year if month >= 4 else year - 1


def customer_month_pivot(txs: List[dict], fy: int = None) -> Dict[str, Any]:
    """Return a pivot: each customer × each month cell holds net_amount total.

    If `fy` is provided, restrict to that fiscal year (Apr <fy> - Mar <fy+1>).
    Otherwise include ALL months found in data.
    """
    # First pass: collect all months and per-customer aggregates
    all_months = set()
    cust = defaultdict(lambda: {
        "months": defaultdict(float),
        "months_gp": defaultdict(float),
        "months_qty": defaultdict(float),
        "months_orders": defaultdict(set),
        "country": "",
        "salesperson": "",
        "total_sales": 0.0,
        "total_gp": 0.0,
        "total_qty": 0.0,
        "orders": set(),
    })

    for t in txs:
        d = t.get("invoice_date")
        c = t.get("customer")
        if not d or not c or len(d) < 7:
            continue
        ym = d[:7]
        try:
            y, m = int(d[:4]), int(d[5:7])
        except (ValueError, TypeError):
            continue
        if fy is not None and _fiscal_year(y, m) != fy:
            continue
        all_months.add(ym)
        v_sales = _safe_float(t.get("net_amount"))
        v_gp = _safe_float(t.get("gp_amount"))
        v_qty = _safe_float(t.get("qty"))
        e = cust[c]
        e["months"][ym] += v_sales
        e["months_gp"][ym] += v_gp
        e["months_qty"][ym] += v_qty
        e["total_sales"] += v_sales
        e["total_gp"] += v_gp
        e["total_qty"] += v_qty
        if t.get("invoice_no"):
            e["orders"].add(t.get("invoice_no"))
            e["months_orders"][ym].add(t.get("invoice_no"))
        if not e["country"] and t.get("country"):
            e["country"] = t.get("country")
        if not e["salesperson"] and t.get("salesperson"):
            e["salesperson"] = t.get("salesperson")

    months_sorted = sorted(all_months)
    total_sales_grand = sum(e["total_sales"] for e in cust.values()) or 1.0

    rows = []
    for c, e in cust.items():
        month_cells = {ym: round(e["months"].get(ym, 0.0), 2) for ym in months_sorted}
        month_gp_cells = {ym: round(e["months_gp"].get(ym, 0.0), 2) for ym in months_sorted}
        active_months = sum(1 for ym in months_sorted if e["months"].get(ym, 0) > 0)
        rows.append({
            "customer": c,
            "country": e["country"],
            "salesperson": e["salesperson"],
            "months": month_cells,
            "months_gp": month_gp_cells,
            "total_sales": round(e["total_sales"], 2),
            "total_gp": round(e["total_gp"], 2),
            "gp_pct": round(e["total_gp"] / e["total_sales"] * 100, 2) if e["total_sales"] else 0,
            "total_qty": round(e["total_qty"], 2),
            "orders": len(e["orders"]),
            "active_months": active_months,
            "avg_per_active_month": round(e["total_sales"] / active_months, 2) if active_months else 0,
            "contribution_pct": round(e["total_sales"] / total_sales_grand * 100, 2),
        })
    rows.sort(key=lambda r: r["total_sales"], reverse=True)

    # Column totals
    col_totals = {ym: round(sum(e["months"].get(ym, 0) for e in cust.values()), 2) for ym in months_sorted}
    col_totals_gp = {ym: round(sum(e["months_gp"].get(ym, 0) for e in cust.values()), 2) for ym in months_sorted}

    # Available fiscal years from raw data
    fys_present = set()
    for t in txs:
        d = t.get("invoice_date")
        if not d or len(d) < 7:
            continue
        try:
            y, m = int(d[:4]), int(d[5:7])
            fys_present.add(_fiscal_year(y, m))
        except (ValueError, TypeError):
            continue

    return {
        "months": months_sorted,
        "rows": rows,
        "col_totals": col_totals,
        "col_totals_gp": col_totals_gp,
        "grand_total": round(sum(col_totals.values()), 2),
        "grand_gp": round(sum(col_totals_gp.values()), 2),
        "customers": len(rows),
        "available_fiscal_years": sorted(list(fys_present)),
        "fiscal_year": fy,
    }


def product_month_pivot(txs: List[dict], fy: int = None) -> Dict[str, Any]:
    """Product × Month pivot: sales, qty, GP per (product, month)."""
    all_months = set()
    prod = defaultdict(lambda: {
        "months": defaultdict(float),
        "months_qty": defaultdict(float),
        "months_gp": defaultdict(float),
        "category": "",
        "manufacturer": "",
        "total_sales": 0.0,
        "total_gp": 0.0,
        "total_qty": 0.0,
    })
    for t in txs:
        d = t.get("invoice_date")
        p = t.get("product")
        if not d or not p or len(d) < 7:
            continue
        try:
            y, m = int(d[:4]), int(d[5:7])
        except (ValueError, TypeError):
            continue
        if fy is not None and _fiscal_year(y, m) != fy:
            continue
        ym = d[:7]
        all_months.add(ym)
        v_sales = _safe_float(t.get("net_amount"))
        v_qty = _safe_float(t.get("qty"))
        v_gp = _safe_float(t.get("gp_amount"))
        e = prod[p]
        e["months"][ym] += v_sales
        e["months_qty"][ym] += v_qty
        e["months_gp"][ym] += v_gp
        e["total_sales"] += v_sales
        e["total_gp"] += v_gp
        e["total_qty"] += v_qty
        if t.get("category") and not e["category"]:
            e["category"] = t.get("category")
        if t.get("manufacturer") and not e["manufacturer"]:
            e["manufacturer"] = t.get("manufacturer")

    months_sorted = sorted(all_months)
    total_grand = sum(e["total_sales"] for e in prod.values()) or 1.0

    rows = []
    for p, e in prod.items():
        cells = {ym: round(e["months"].get(ym, 0.0), 2) for ym in months_sorted}
        cells_qty = {ym: round(e["months_qty"].get(ym, 0.0), 2) for ym in months_sorted}
        cells_gp = {ym: round(e["months_gp"].get(ym, 0.0), 2) for ym in months_sorted}
        active = sum(1 for ym in months_sorted if e["months"].get(ym, 0) > 0)
        # trend: last vs first month
        first_v = e["months"].get(months_sorted[0], 0) if months_sorted else 0
        last_v = e["months"].get(months_sorted[-1], 0) if months_sorted else 0
        trend = None
        if first_v > 0:
            trend = round((last_v - first_v) / first_v * 100, 2)
        rows.append({
            "product": p,
            "category": e["category"],
            "manufacturer": e["manufacturer"],
            "months": cells,
            "months_qty": cells_qty,
            "months_gp": cells_gp,
            "total_sales": round(e["total_sales"], 2),
            "total_qty": round(e["total_qty"], 2),
            "total_gp": round(e["total_gp"], 2),
            "gp_pct": round(e["total_gp"] / e["total_sales"] * 100, 2) if e["total_sales"] else 0,
            "active_months": active,
            "contribution_pct": round(e["total_sales"] / total_grand * 100, 2),
            "trend_pct": trend,
        })
    rows.sort(key=lambda r: r["total_sales"], reverse=True)

    col_totals = {ym: round(sum(e["months"].get(ym, 0) for e in prod.values()), 2) for ym in months_sorted}
    col_totals_qty = {ym: round(sum(e["months_qty"].get(ym, 0) for e in prod.values()), 2) for ym in months_sorted}
    col_totals_gp = {ym: round(sum(e["months_gp"].get(ym, 0) for e in prod.values()), 2) for ym in months_sorted}

    fys_present = set()
    for t in txs:
        d = t.get("invoice_date")
        if not d or len(d) < 7:
            continue
        try:
            y, m = int(d[:4]), int(d[5:7])
            fys_present.add(_fiscal_year(y, m))
        except (ValueError, TypeError):
            continue

    return {
        "months": months_sorted,
        "rows": rows,
        "col_totals": col_totals,
        "col_totals_qty": col_totals_qty,
        "col_totals_gp": col_totals_gp,
        "grand_total": round(sum(col_totals.values()), 2),
        "grand_qty": round(sum(col_totals_qty.values()), 2),
        "grand_gp": round(sum(col_totals_gp.values()), 2),
        "products": len(rows),
        "available_fiscal_years": sorted(list(fys_present)),
        "fiscal_year": fy,
    }


def customer_salesperson_pivot(txs: List[dict], fy: int = None) -> Dict[str, Any]:
    """Customer × Salesperson pivot: cell holds sales revenue.
    Includes an 'owner' (primary salesperson) column per customer.
    """
    salespersons = set()
    cust = defaultdict(lambda: {
        "sp_sales": defaultdict(float),
        "sp_orders": defaultdict(set),
        "country": "",
        "total_sales": 0.0,
        "total_gp": 0.0,
        "orders": set(),
    })
    for t in txs:
        c = t.get("customer")
        sp = t.get("salesperson") or "UNASSIGNED"
        if not c:
            continue
        d = t.get("invoice_date")
        if fy is not None and d and len(d) >= 7:
            try:
                y, m = int(d[:4]), int(d[5:7])
                if _fiscal_year(y, m) != fy:
                    continue
            except (ValueError, TypeError):
                continue
        salespersons.add(sp)
        v = _safe_float(t.get("net_amount"))
        e = cust[c]
        e["sp_sales"][sp] += v
        e["total_sales"] += v
        e["total_gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            e["sp_orders"][sp].add(t.get("invoice_no"))
            e["orders"].add(t.get("invoice_no"))
        if not e["country"] and t.get("country"):
            e["country"] = t.get("country")

    sps_sorted = sorted(salespersons)
    grand = sum(e["total_sales"] for e in cust.values()) or 1.0

    rows = []
    for c, e in cust.items():
        cells = {sp: round(e["sp_sales"].get(sp, 0.0), 2) for sp in sps_sorted}
        # Owner = salesperson with highest sales for this customer
        owner = max(e["sp_sales"].items(), key=lambda x: x[1])[0] if e["sp_sales"] else "—"
        shared = sum(1 for sp in sps_sorted if e["sp_sales"].get(sp, 0) > 0)
        rows.append({
            "customer": c,
            "country": e["country"],
            "owner": owner,
            "shared_by": shared,
            "cells": cells,
            "total_sales": round(e["total_sales"], 2),
            "total_gp": round(e["total_gp"], 2),
            "orders": len(e["orders"]),
            "contribution_pct": round(e["total_sales"] / grand * 100, 2),
        })
    rows.sort(key=lambda r: r["total_sales"], reverse=True)

    col_totals = {sp: round(sum(e["sp_sales"].get(sp, 0) for e in cust.values()), 2) for sp in sps_sorted}
    col_customer_counts = {sp: sum(1 for e in cust.values() if e["sp_sales"].get(sp, 0) > 0) for sp in sps_sorted}

    return {
        "salespersons": sps_sorted,
        "rows": rows,
        "col_totals": col_totals,
        "col_customer_counts": col_customer_counts,
        "grand_total": round(sum(col_totals.values()), 2),
        "customers": len(rows),
    }


def abc_analysis(txs: List[dict], fy: int = None) -> Dict[str, Any]:
    """ABC Pareto tiering on customers: A=80% cumulative revenue, B=next 15%, C=last 5%.
    Returns customers sorted by revenue with their tier, cumulative %, and per-tier summaries.
    """
    per_cust = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "orders": set(), "country": "", "salesperson": ""})
    for t in txs:
        c = t.get("customer")
        if not c:
            continue
        d = t.get("invoice_date")
        if fy is not None and d and len(d) >= 7:
            try:
                y, m = int(d[:4]), int(d[5:7])
                if _fiscal_year(y, m) != fy:
                    continue
            except (ValueError, TypeError):
                continue
        e = per_cust[c]
        e["sales"] += _safe_float(t.get("net_amount"))
        e["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            e["orders"].add(t.get("invoice_no"))
        if not e["country"] and t.get("country"):
            e["country"] = t.get("country")
        if not e["salesperson"] and t.get("salesperson"):
            e["salesperson"] = t.get("salesperson")

    total = sum(e["sales"] for e in per_cust.values()) or 1.0
    ordered = sorted(per_cust.items(), key=lambda x: x[1]["sales"], reverse=True)

    rows = []
    cumulative = 0.0
    tier_summary = {"A": {"count": 0, "sales": 0.0, "gp": 0.0}, "B": {"count": 0, "sales": 0.0, "gp": 0.0}, "C": {"count": 0, "sales": 0.0, "gp": 0.0}}
    for c, e in ordered:
        cumulative += e["sales"]
        cum_pct = cumulative / total * 100
        if cum_pct <= 80:
            tier = "A"
        elif cum_pct <= 95:
            tier = "B"
        else:
            tier = "C"
        tier_summary[tier]["count"] += 1
        tier_summary[tier]["sales"] += e["sales"]
        tier_summary[tier]["gp"] += e["gp"]
        rows.append({
            "customer": c,
            "country": e["country"],
            "salesperson": e["salesperson"],
            "sales": round(e["sales"], 2),
            "gp": round(e["gp"], 2),
            "gp_pct": round(e["gp"] / e["sales"] * 100, 2) if e["sales"] else 0,
            "orders": len(e["orders"]),
            "contribution_pct": round(e["sales"] / total * 100, 2),
            "cumulative_pct": round(cum_pct, 2),
            "tier": tier,
        })
    total_customers = len(rows) or 1
    for tier in ("A", "B", "C"):
        tier_summary[tier]["sales"] = round(tier_summary[tier]["sales"], 2)
        tier_summary[tier]["gp"] = round(tier_summary[tier]["gp"], 2)
        tier_summary[tier]["sales_pct"] = round(tier_summary[tier]["sales"] / total * 100, 2)
        tier_summary[tier]["customer_pct"] = round(tier_summary[tier]["count"] / total_customers * 100, 2)

    return {
        "rows": rows,
        "tiers": tier_summary,
        "total_sales": round(total, 2),
        "total_customers": total_customers,
    }


def month_compare(txs: List[dict], month_a: str, month_b: str) -> Dict[str, Any]:
    """Compare two months side-by-side. month_a and month_b are 'YYYY-MM'.

    Returns per-customer row with sales_a, sales_b, delta, growth_pct;
    similar for products; and overall summary.
    """
    def _bucket(entity_key):
        buckets = defaultdict(lambda: {"a": 0.0, "b": 0.0, "a_orders": set(), "b_orders": set(), "meta": {}})
        for t in txs:
            d = t.get("invoice_date")
            key = t.get(entity_key)
            if not d or not key or len(d) < 7:
                continue
            ym = d[:7]
            if ym == month_a:
                buckets[key]["a"] += _safe_float(t.get("net_amount"))
                if t.get("invoice_no"):
                    buckets[key]["a_orders"].add(t.get("invoice_no"))
            elif ym == month_b:
                buckets[key]["b"] += _safe_float(t.get("net_amount"))
                if t.get("invoice_no"):
                    buckets[key]["b_orders"].add(t.get("invoice_no"))
            else:
                continue
            if not buckets[key]["meta"].get("country") and t.get("country"):
                buckets[key]["meta"]["country"] = t.get("country")
            if not buckets[key]["meta"].get("salesperson") and t.get("salesperson"):
                buckets[key]["meta"]["salesperson"] = t.get("salesperson")
            if not buckets[key]["meta"].get("category") and t.get("category"):
                buckets[key]["meta"]["category"] = t.get("category")
        rows = []
        for k, v in buckets.items():
            delta = v["b"] - v["a"]
            growth = None
            if v["a"] > 0:
                growth = round(delta / v["a"] * 100, 2)
            elif v["b"] > 0:
                growth = None  # brand new
            status = "stable"
            if v["a"] == 0 and v["b"] > 0:
                status = "new"
            elif v["a"] > 0 and v["b"] == 0:
                status = "lost"
            elif growth is not None and growth >= 20:
                status = "surged"
            elif growth is not None and growth <= -20:
                status = "dropped"
            rows.append({
                entity_key: k,
                **v["meta"],
                "sales_a": round(v["a"], 2),
                "sales_b": round(v["b"], 2),
                "delta": round(delta, 2),
                "growth_pct": growth,
                "status": status,
                "orders_a": len(v["a_orders"]),
                "orders_b": len(v["b_orders"]),
            })
        rows.sort(key=lambda r: abs(r["delta"]), reverse=True)
        return rows

    customer_rows = _bucket("customer")
    product_rows = _bucket("product")

    total_a = sum(r["sales_a"] for r in customer_rows)
    total_b = sum(r["sales_b"] for r in customer_rows)
    total_delta = total_b - total_a
    total_growth = round(total_delta / total_a * 100, 2) if total_a else None

    # Available months for the picker
    months_present = sorted({t.get("invoice_date", "")[:7] for t in txs if t.get("invoice_date")})
    months_present = [m for m in months_present if m]

    counts = {"new": 0, "lost": 0, "surged": 0, "dropped": 0, "stable": 0}
    for r in customer_rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    return {
        "month_a": month_a,
        "month_b": month_b,
        "available_months": months_present,
        "summary": {
            "total_a": round(total_a, 2),
            "total_b": round(total_b, 2),
            "delta": round(total_delta, 2),
            "growth_pct": total_growth,
        },
        "customer_status_counts": counts,
        "customers": customer_rows,
        "products": product_rows,
    }

