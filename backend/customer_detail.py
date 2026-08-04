"""Customer 360° detail - single customer's full profile."""
from typing import List, Dict, Any
from collections import defaultdict
from analytics import _safe_float


def customer_360(txs: List[dict], customer: str) -> Dict[str, Any]:
    """Return a full detail view for a single customer."""
    cust_txs = [t for t in txs if t.get("customer") == customer]
    if not cust_txs:
        return {"customer": customer, "found": False}

    total_sales = sum(_safe_float(t.get("net_amount")) for t in cust_txs)
    total_gp = sum(_safe_float(t.get("gp_amount")) for t in cust_txs)
    total_qty = sum(_safe_float(t.get("qty")) for t in cust_txs)
    orders = {t.get("invoice_no") for t in cust_txs if t.get("invoice_no")}
    dates = sorted([t.get("invoice_date") for t in cust_txs if t.get("invoice_date")])
    country = next((t.get("country") for t in cust_txs if t.get("country")), None)
    area = next((t.get("area") for t in cust_txs if t.get("area")), None)

    # Monthly trend
    monthly = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "orders": set()})
    for t in cust_txs:
        d = t.get("invoice_date")
        if not d or len(d) < 7:
            continue
        ym = d[:7]
        monthly[ym]["sales"] += _safe_float(t.get("net_amount"))
        monthly[ym]["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            monthly[ym]["orders"].add(t.get("invoice_no"))
    monthly_list = sorted(
        [{"month": k, "sales": round(v["sales"], 2), "gp": round(v["gp"], 2), "orders": len(v["orders"])} for k, v in monthly.items()],
        key=lambda x: x["month"],
    )

    # Product mix
    by_prod = defaultdict(lambda: {"sales": 0.0, "qty": 0.0, "gp": 0.0, "orders": set(), "category": "", "last": ""})
    for t in cust_txs:
        p = t.get("product")
        if not p:
            continue
        e = by_prod[p]
        e["sales"] += _safe_float(t.get("net_amount"))
        e["qty"] += _safe_float(t.get("qty"))
        e["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            e["orders"].add(t.get("invoice_no"))
        if t.get("category") and not e["category"]:
            e["category"] = t.get("category")
        d = t.get("invoice_date")
        if d and (not e["last"] or d > e["last"]):
            e["last"] = d
    product_mix = sorted(
        [{"product": k, "sales": round(v["sales"], 2), "qty": round(v["qty"], 2), "gp": round(v["gp"], 2), "gp_pct": round(v["gp"]/v["sales"]*100, 2) if v["sales"] else 0, "orders": len(v["orders"]), "category": v["category"], "last_sold": v["last"], "contribution_pct": round(v["sales"]/total_sales*100, 2) if total_sales else 0} for k, v in by_prod.items()],
        key=lambda x: x["sales"], reverse=True,
    )

    # Salesperson history
    by_sp = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "orders": set(), "first": "", "last": ""})
    for t in cust_txs:
        sp = t.get("salesperson") or "UNASSIGNED"
        e = by_sp[sp]
        e["sales"] += _safe_float(t.get("net_amount"))
        e["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            e["orders"].add(t.get("invoice_no"))
        d = t.get("invoice_date")
        if d:
            if not e["first"] or d < e["first"]:
                e["first"] = d
            if not e["last"] or d > e["last"]:
                e["last"] = d
    salesperson_history = sorted(
        [{"salesperson": k, "sales": round(v["sales"], 2), "gp": round(v["gp"], 2), "orders": len(v["orders"]), "first_order": v["first"], "last_order": v["last"], "share_pct": round(v["sales"]/total_sales*100, 2) if total_sales else 0} for k, v in by_sp.items()],
        key=lambda x: x["sales"], reverse=True,
    )

    # Category mix
    by_cat = defaultdict(float)
    for t in cust_txs:
        c = t.get("category") or "UNCATEGORISED"
        by_cat[c] += _safe_float(t.get("net_amount"))
    category_mix = sorted(
        [{"category": k, "sales": round(v, 2), "share_pct": round(v/total_sales*100, 2) if total_sales else 0} for k, v in by_cat.items()],
        key=lambda x: x["sales"], reverse=True,
    )

    # Recent transactions (last 20)
    recent = sorted(
        [t for t in cust_txs if t.get("invoice_date")],
        key=lambda x: x.get("invoice_date", ""), reverse=True,
    )[:20]
    recent_out = [{
        "invoice_no": t.get("invoice_no"),
        "date": t.get("invoice_date"),
        "product": t.get("product"),
        "qty": t.get("qty"),
        "rate": t.get("rate"),
        "net_amount": t.get("net_amount"),
        "gp_amount": t.get("gp_amount"),
        "salesperson": t.get("salesperson"),
    } for t in recent]

    return {
        "customer": customer,
        "found": True,
        "kpis": {
            "total_sales": round(total_sales, 2),
            "total_gp": round(total_gp, 2),
            "gp_pct": round(total_gp / total_sales * 100, 2) if total_sales else 0,
            "total_qty": round(total_qty, 2),
            "orders": len(orders),
            "aov": round(total_sales / len(orders), 2) if orders else 0,
            "products_purchased": len(by_prod),
            "first_purchase": dates[0] if dates else None,
            "last_purchase": dates[-1] if dates else None,
            "country": country,
            "area": area,
            "active_months": len(monthly_list),
        },
        "monthly_trend": monthly_list,
        "product_mix": product_mix,
        "salesperson_history": salesperson_history,
        "category_mix": category_mix,
        "recent_transactions": recent_out,
    }
