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
