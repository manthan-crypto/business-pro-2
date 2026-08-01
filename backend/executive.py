"""Executive dashboards - CEO, Sales Director, Finance rollups."""
from typing import List, Dict, Any
from collections import defaultdict
from analytics import (
    overview_kpis, customer_analytics, product_analytics,
    country_analytics, trend_analytics, salesperson_analytics, _safe_float,
)


def ceo_dashboard(txs: List[dict], targets: List[dict] = None) -> Dict[str, Any]:
    ov = overview_kpis(txs)
    cust = customer_analytics(txs)
    trends = trend_analytics(txs)
    sales_team = salesperson_analytics(txs, targets)

    total_target = sum(_safe_float(t.get("target")) for t in (targets or []))
    target_ach = (ov["total_sales"] / total_target * 100) if total_target else 0

    top10 = cust.get("top20", [])[:10]
    # Concentration risk (top-10 share)
    concentration = sum(c["contribution_pct"] for c in top10)

    # Sales team leaderboard (top 5)
    top_sp = sales_team.get("rows", [])[:5]

    # Monthly momentum
    monthly = trends.get("monthly", [])
    last = monthly[-1] if monthly else None
    prev = monthly[-2] if len(monthly) >= 2 else None
    mom_growth = ((last["sales"] - prev["sales"]) / prev["sales"] * 100) if (last and prev and prev["sales"]) else None

    return {
        "kpis": {
            **ov,
            "total_target": total_target,
            "target_achievement_pct": round(target_ach, 2) if total_target else None,
            "mom_growth_pct": round(mom_growth, 2) if mom_growth is not None else None,
            "top10_concentration_pct": round(concentration, 2),
        },
        "top_customers": top10,
        "top_salespersons": top_sp,
        "monthly_trend": monthly,
        "growth_highest": cust.get("highest_growth"),
        "decline_highest": cust.get("highest_decline"),
        "forecast": trends.get("forecast"),
    }


def sales_director_dashboard(txs: List[dict], targets: List[dict] = None) -> Dict[str, Any]:
    cust = customer_analytics(txs)
    prod = product_analytics(txs)
    sales_team = salesperson_analytics(txs, targets)
    country = country_analytics(txs)

    # Pipeline proxy = last month orders
    trends = trend_analytics(txs)
    monthly = trends.get("monthly", [])
    last_month = monthly[-1] if monthly else None

    return {
        "customer_growth_leaders": cust.get("growth", [])[:10],
        "customer_declines": (cust.get("growth", []) or [])[-10:][::-1],
        "lost_customers": cust.get("lost_customers", []),
        "new_customers": cust.get("new_customers", []),
        "pipeline": {
            "last_month_orders": last_month["orders"] if last_month else 0,
            "last_month_sales": last_month["sales"] if last_month else 0,
            "last_month_gp": last_month["gp"] if last_month else 0,
        },
        "top_salespersons": sales_team.get("rows", [])[:10],
        "top_products": prod.get("top20", [])[:10],
        "country_ranking": country.get("rows", [])[:10],
    }


def finance_dashboard(txs: List[dict], targets: List[dict] = None) -> Dict[str, Any]:
    ov = overview_kpis(txs)
    country = country_analytics(txs)
    cust = customer_analytics(txs)

    # Explicit currency-wise grouping (if currency field mapped). Falls back to country.
    by_currency = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "orders": set(), "customers": set()})
    has_currency = any(t.get("currency") for t in txs)
    for t in txs:
        if has_currency:
            key = (t.get("currency") or "UNSPECIFIED").upper()
        else:
            key = t.get("country") or "UNSPECIFIED"
        e = by_currency[key]
        e["sales"] += _safe_float(t.get("net_amount"))
        e["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            e["orders"].add(t.get("invoice_no"))
        if t.get("customer"):
            e["customers"].add(t.get("customer"))

    currency_wise = sorted(
        [
            {
                "currency": k,
                "sales": round(v["sales"], 2),
                "gp": round(v["gp"], 2),
                "gp_pct": round(v["gp"] / v["sales"] * 100, 2) if v["sales"] else 0,
                "orders": len(v["orders"]),
                "customers": len(v["customers"]),
            }
            for k, v in by_currency.items()
        ],
        key=lambda x: x["sales"], reverse=True,
    )

    # Credit exposure = cumulative sales per top customer (proxy without receivables data)
    credit_exposure = cust.get("top20", [])[:15]

    # Low-GP customers (below 15%)
    low_gp = [c for c in cust.get("rows", []) if c["gp_pct"] < 15 and c["sales"] > 0][:15]

    # Mode-wise breakdown (payment terms proxy)
    by_mode = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "orders": set()})
    for t in txs:
        m = t.get("mode") or "UNSPECIFIED"
        by_mode[m]["sales"] += _safe_float(t.get("net_amount"))
        by_mode[m]["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            by_mode[m]["orders"].add(t.get("invoice_no"))
    mode_rows = sorted(
        [
            {
                "mode": k,
                "sales": round(v["sales"], 2),
                "gp": round(v["gp"], 2),
                "orders": len(v["orders"]),
                "gp_pct": round(v["gp"] / v["sales"] * 100, 2) if v["sales"] else 0,
            }
            for k, v in by_mode.items()
        ],
        key=lambda x: x["sales"], reverse=True,
    )

    return {
        "kpis": {
            "total_sales": ov["total_sales"],
            "total_gp": ov["total_gp"],
            "gp_pct": ov["gp_pct"],
            "orders": ov["orders"],
        },
        "has_currency_field": has_currency,
        "currency_wise": currency_wise,
        "top_credit_exposure": credit_exposure,
        "low_gp_customers": low_gp,
        "payment_mode_analysis": mode_rows,
    }
