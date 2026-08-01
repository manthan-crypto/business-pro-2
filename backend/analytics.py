"""Analytics engine - all dashboard queries operate on canonical transactions."""
from typing import List, Dict, Any
from collections import defaultdict
from datetime import datetime, timedelta, timezone


def _safe_float(x):
    try:
        return float(x) if x is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def _ym(date_str: str) -> str:
    return date_str[:7] if date_str else ""


def _group_sum(txs: List[dict], key: str, value_key: str = "net_amount") -> Dict[str, float]:
    out = defaultdict(float)
    for t in txs:
        k = t.get(key)
        if k:
            out[k] += _safe_float(t.get(value_key))
    return dict(out)


def overview_kpis(txs: List[dict]) -> Dict[str, Any]:
    total_sales = sum(_safe_float(t.get("net_amount")) for t in txs)
    total_gp = sum(_safe_float(t.get("gp_amount")) for t in txs)
    customers = {t.get("customer") for t in txs if t.get("customer")}
    products = {t.get("product") for t in txs if t.get("product")}
    invoices = {t.get("invoice_no") for t in txs if t.get("invoice_no")}
    orders = len(invoices) if invoices else len(txs)
    aov = (total_sales / orders) if orders else 0
    gp_pct = (total_gp / total_sales * 100) if total_sales else 0
    return {
        "total_sales": round(total_sales, 2),
        "total_gp": round(total_gp, 2),
        "gp_pct": round(gp_pct, 2),
        "orders": orders,
        "active_customers": len(customers),
        "active_products": len(products),
        "avg_order_value": round(aov, 2),
    }


def customer_analytics(txs: List[dict]) -> Dict[str, Any]:
    by_cust_sales = defaultdict(float)
    by_cust_gp = defaultdict(float)
    by_cust_orders = defaultdict(set)
    by_cust_months = defaultdict(set)
    by_cust_last = {}
    by_cust_country = {}
    for t in txs:
        c = t.get("customer")
        if not c:
            continue
        by_cust_sales[c] += _safe_float(t.get("net_amount"))
        by_cust_gp[c] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            by_cust_orders[c].add(t.get("invoice_no"))
        if t.get("year_month"):
            by_cust_months[c].add(t.get("year_month"))
        d = t.get("invoice_date")
        if d:
            cur = by_cust_last.get(c)
            if cur is None or d > cur:
                by_cust_last[c] = d
        if t.get("country") and c not in by_cust_country:
            by_cust_country[c] = t.get("country")

    total_sales = sum(by_cust_sales.values()) or 1.0
    rows = []
    for c, s in by_cust_sales.items():
        orders = len(by_cust_orders.get(c, set())) or 1
        rows.append({
            "customer": c,
            "country": by_cust_country.get(c, ""),
            "sales": round(s, 2),
            "gp": round(by_cust_gp.get(c, 0), 2),
            "gp_pct": round(by_cust_gp.get(c, 0) / s * 100, 2) if s else 0,
            "orders": orders,
            "aov": round(s / orders, 2),
            "contribution_pct": round(s / total_sales * 100, 2),
            "active_months": len(by_cust_months.get(c, set())),
            "last_purchase": by_cust_last.get(c, ""),
        })
    rows.sort(key=lambda r: r["sales"], reverse=True)

    # month-on-month growth
    all_months = sorted({t.get("year_month") for t in txs if t.get("year_month")})
    growth = []
    if len(all_months) >= 2:
        last_m, prev_m = all_months[-1], all_months[-2]
        cust_last = defaultdict(float)
        cust_prev = defaultdict(float)
        for t in txs:
            ym = t.get("year_month")
            c = t.get("customer")
            if not c:
                continue
            if ym == last_m:
                cust_last[c] += _safe_float(t.get("net_amount"))
            elif ym == prev_m:
                cust_prev[c] += _safe_float(t.get("net_amount"))
        for c in set(list(cust_last.keys()) + list(cust_prev.keys())):
            prev = cust_prev.get(c, 0)
            cur = cust_last.get(c, 0)
            change = cur - prev
            pct = (change / prev * 100) if prev else (100.0 if cur else 0)
            growth.append({
                "customer": c,
                "previous": round(prev, 2),
                "current": round(cur, 2),
                "change": round(change, 2),
                "growth_pct": round(pct, 2),
            })
        growth.sort(key=lambda r: r["growth_pct"], reverse=True)

    # new / lost / dormant
    today = datetime.now(timezone.utc).date()
    new_cust, lost_cust, dormant = [], [], []
    if all_months:
        last_m = all_months[-1]
        prev_m = all_months[-2] if len(all_months) >= 2 else None
        cust_in_last = {t.get("customer") for t in txs if t.get("year_month") == last_m and t.get("customer")}
        cust_in_prev = {t.get("customer") for t in txs if prev_m and t.get("year_month") == prev_m and t.get("customer")}
        cust_before_last = {t.get("customer") for t in txs if t.get("year_month") and t.get("year_month") < last_m and t.get("customer")}
        new_cust = sorted(list(cust_in_last - cust_before_last))
        lost_cust = sorted(list(cust_in_prev - cust_in_last))
    for c, last in by_cust_last.items():
        try:
            d = datetime.fromisoformat(last).date()
            if (today - d).days > 90:
                dormant.append({"customer": c, "last_purchase": last, "days_since": (today - d).days})
        except (ValueError, TypeError):
            pass
    dormant.sort(key=lambda x: x["days_since"], reverse=True)

    return {
        "rows": rows,
        "top20": rows[:20],
        "growth": growth,
        "highest_growth": growth[0] if growth else None,
        "highest_decline": growth[-1] if growth else None,
        "new_customers": new_cust,
        "lost_customers": lost_cust,
        "dormant_customers": dormant[:50],
        "total_customers": len(rows),
    }


def product_analytics(txs: List[dict]) -> Dict[str, Any]:
    by_prod = defaultdict(lambda: {"sales": 0.0, "qty": 0.0, "gp": 0.0, "orders": set(), "category": "", "manufacturer": "", "last": ""})
    for t in txs:
        p = t.get("product")
        if not p:
            continue
        e = by_prod[p]
        e["sales"] += _safe_float(t.get("net_amount"))
        e["qty"] += _safe_float(t.get("qty"))
        e["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            e["orders"].add(t.get("invoice_no"))
        if t.get("category"):
            e["category"] = t.get("category")
        if t.get("manufacturer"):
            e["manufacturer"] = t.get("manufacturer")
        d = t.get("invoice_date")
        if d and (not e["last"] or d > e["last"]):
            e["last"] = d

    total_sales = sum(e["sales"] for e in by_prod.values()) or 1.0
    rows = []
    for p, e in by_prod.items():
        rows.append({
            "product": p,
            "category": e["category"],
            "manufacturer": e["manufacturer"],
            "sales": round(e["sales"], 2),
            "qty": round(e["qty"], 2),
            "gp": round(e["gp"], 2),
            "gp_pct": round(e["gp"] / e["sales"] * 100, 2) if e["sales"] else 0,
            "orders": len(e["orders"]),
            "contribution_pct": round(e["sales"] / total_sales * 100, 2),
            "last_sold": e["last"],
        })
    rows.sort(key=lambda r: r["sales"], reverse=True)

    # fast / slow / zero
    sales_vals = [r["sales"] for r in rows]
    if sales_vals:
        sorted_v = sorted(sales_vals)
        q80 = sorted_v[int(len(sorted_v) * 0.8)] if len(sorted_v) > 1 else sorted_v[0]
        q20 = sorted_v[int(len(sorted_v) * 0.2)] if len(sorted_v) > 1 else sorted_v[0]
    else:
        q80, q20 = 0, 0
    fast = [r for r in rows if r["sales"] >= q80][:50]
    slow = [r for r in rows if r["sales"] <= q20 and r["sales"] > 0][:50]
    zero = [r for r in rows if r["sales"] == 0][:50]

    return {
        "rows": rows,
        "top20": rows[:20],
        "fast_movers": fast,
        "slow_movers": slow,
        "zero_sales": zero,
        "total_products": len(rows),
    }


def country_analytics(txs: List[dict]) -> Dict[str, Any]:
    by_country = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "customers": set(), "orders": set()})
    for t in txs:
        c = t.get("country")
        if not c:
            continue
        e = by_country[c]
        e["sales"] += _safe_float(t.get("net_amount"))
        e["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("customer"):
            e["customers"].add(t.get("customer"))
        if t.get("invoice_no"):
            e["orders"].add(t.get("invoice_no"))

    total = sum(e["sales"] for e in by_country.values()) or 1.0
    rows = []
    for c, e in by_country.items():
        orders = len(e["orders"]) or 1
        rows.append({
            "country": c,
            "sales": round(e["sales"], 2),
            "gp": round(e["gp"], 2),
            "customers": len(e["customers"]),
            "orders": orders,
            "aov": round(e["sales"] / orders, 2),
            "contribution_pct": round(e["sales"] / total * 100, 2),
        })
    rows.sort(key=lambda r: r["sales"], reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    # growth
    all_months = sorted({t.get("year_month") for t in txs if t.get("year_month")})
    growth = []
    if len(all_months) >= 2:
        last_m, prev_m = all_months[-1], all_months[-2]
        cl = defaultdict(float)
        cp = defaultdict(float)
        for t in txs:
            c = t.get("country")
            if not c:
                continue
            if t.get("year_month") == last_m:
                cl[c] += _safe_float(t.get("net_amount"))
            elif t.get("year_month") == prev_m:
                cp[c] += _safe_float(t.get("net_amount"))
        for c in set(list(cl.keys()) + list(cp.keys())):
            prev = cp.get(c, 0)
            cur = cl.get(c, 0)
            pct = ((cur - prev) / prev * 100) if prev else (100.0 if cur else 0)
            growth.append({"country": c, "previous": round(prev, 2), "current": round(cur, 2), "growth_pct": round(pct, 2)})
        growth.sort(key=lambda r: r["growth_pct"], reverse=True)

    return {"rows": rows, "growth": growth}


def trend_analytics(txs: List[dict]) -> Dict[str, Any]:
    daily = defaultdict(lambda: {"sales": 0.0, "gp": 0.0})
    monthly = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "orders": set()})
    weekly = defaultdict(lambda: {"sales": 0.0, "gp": 0.0})
    for t in txs:
        d = t.get("invoice_date")
        if not d:
            continue
        try:
            dt = datetime.fromisoformat(d).date()
        except (ValueError, TypeError):
            continue
        daily[d]["sales"] += _safe_float(t.get("net_amount"))
        daily[d]["gp"] += _safe_float(t.get("gp_amount"))
        ym = d[:7]
        monthly[ym]["sales"] += _safe_float(t.get("net_amount"))
        monthly[ym]["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("invoice_no"):
            monthly[ym]["orders"].add(t.get("invoice_no"))
        iso = dt.isocalendar()
        wk = f"{iso[0]}-W{iso[1]:02d}"
        weekly[wk]["sales"] += _safe_float(t.get("net_amount"))
        weekly[wk]["gp"] += _safe_float(t.get("gp_amount"))

    daily_list = sorted([{"date": k, **v} for k, v in daily.items()], key=lambda x: x["date"])
    weekly_list = sorted([{"week": k, **v} for k, v in weekly.items()], key=lambda x: x["week"])
    monthly_list = sorted(
        [{"month": k, "sales": round(v["sales"], 2), "gp": round(v["gp"], 2), "orders": len(v["orders"])} for k, v in monthly.items()],
        key=lambda x: x["month"],
    )

    # running total
    running = 0
    for d in daily_list:
        running += d["sales"]
        d["running_total"] = round(running, 2)

    # month-end forecast for latest month (linear from days so far)
    forecast = None
    if daily_list:
        last_date = daily_list[-1]["date"]
        last_ym = last_date[:7]
        days_in_month = [d for d in daily_list if d["date"].startswith(last_ym)]
        if days_in_month:
            days_passed = len(days_in_month)
            sum_so_far = sum(d["sales"] for d in days_in_month)
            avg = sum_so_far / days_passed
            try:
                year, month = int(last_ym[:4]), int(last_ym[5:7])
                if month == 12:
                    next_first = datetime(year + 1, 1, 1).date()
                else:
                    next_first = datetime(year, month + 1, 1).date()
                this_first = datetime(year, month, 1).date()
                total_days = (next_first - this_first).days
                forecast = {
                    "month": last_ym,
                    "actual_so_far": round(sum_so_far, 2),
                    "days_passed": days_passed,
                    "total_days": total_days,
                    "projected": round(avg * total_days, 2),
                }
            except (ValueError, TypeError):
                pass

    return {
        "daily": daily_list[-90:],
        "weekly": weekly_list[-26:],
        "monthly": monthly_list,
        "forecast": forecast,
    }


def smart_alerts(txs: List[dict], targets: List[dict] = None) -> List[Dict[str, Any]]:
    alerts = []
    cust = customer_analytics(txs)
    prod = product_analytics(txs)
    country = country_analytics(txs)
    overview = overview_kpis(txs)

    for g in cust.get("growth", []):
        if g["previous"] > 0 and g["growth_pct"] <= -20:
            alerts.append({
                "severity": "critical", "type": "customer_decline",
                "title": f"Customer sales dropped >20%",
                "description": f"{g['customer']} fell {g['growth_pct']}% month-on-month (₹{g['previous']:,.0f} → ₹{g['current']:,.0f})",
            })
    for d in cust.get("dormant_customers", [])[:10]:
        alerts.append({
            "severity": "warning", "type": "customer_inactive",
            "title": f"Customer inactive >90 days",
            "description": f"{d['customer']} hasn't ordered in {d['days_since']} days",
        })

    # product growth via monthly
    all_months = sorted({t.get("year_month") for t in txs if t.get("year_month")})
    if len(all_months) >= 2:
        last_m, prev_m = all_months[-1], all_months[-2]
        prod_l = defaultdict(float)
        prod_p = defaultdict(float)
        for t in txs:
            p = t.get("product")
            if not p:
                continue
            if t.get("year_month") == last_m:
                prod_l[p] += _safe_float(t.get("net_amount"))
            elif t.get("year_month") == prev_m:
                prod_p[p] += _safe_float(t.get("net_amount"))
        for p in set(list(prod_l.keys()) + list(prod_p.keys())):
            prev, cur = prod_p.get(p, 0), prod_l.get(p, 0)
            if prev > 0:
                pct = (cur - prev) / prev * 100
                if pct >= 30:
                    alerts.append({
                        "severity": "info", "type": "product_growth",
                        "title": f"Product sales surged >30%",
                        "description": f"{p}: ₹{prev:,.0f} → ₹{cur:,.0f} (+{pct:.1f}%)",
                    })

    if overview["gp_pct"] < 15 and overview["total_sales"] > 0:
        alerts.append({
            "severity": "warning", "type": "low_gp",
            "title": "Overall GP below 15%",
            "description": f"Current GP margin is {overview['gp_pct']}%",
        })

    for g in country.get("growth", []):
        if g["previous"] > 0 and g["growth_pct"] <= -25:
            alerts.append({
                "severity": "warning", "type": "country_decline",
                "title": "Country sales declined sharply",
                "description": f"{g['country']} dropped {g['growth_pct']}% (₹{g['previous']:,.0f} → ₹{g['current']:,.0f})",
            })

    # zero sales products
    for p in prod.get("zero_sales", [])[:5]:
        alerts.append({
            "severity": "info", "type": "zero_sales",
            "title": "Product with zero sales",
            "description": f"{p['product']} has no sales in current dataset",
        })

    # target misses
    if targets:
        ach = {}
        for t in txs:
            s = t.get("salesperson")
            ym = t.get("year_month")
            if s and ym:
                ach[(s, ym)] = ach.get((s, ym), 0) + _safe_float(t.get("net_amount"))
        for tg in targets:
            achieved = ach.get((tg["salesperson"], tg["month"]), 0)
            if achieved < tg["target"] * 0.9 and tg["target"] > 0:
                alerts.append({
                    "severity": "warning", "type": "target_miss",
                    "title": "Salesperson missed monthly target",
                    "description": f"{tg['salesperson']} achieved ₹{achieved:,.0f} of ₹{tg['target']:,.0f} for {tg['month']}",
                })

    return alerts


def salesperson_analytics(txs: List[dict], targets: List[dict] = None) -> Dict[str, Any]:
    by_sp = defaultdict(lambda: {"sales": 0.0, "gp": 0.0, "customers": set(), "orders": set()})
    for t in txs:
        s = t.get("salesperson")
        if not s:
            continue
        e = by_sp[s]
        e["sales"] += _safe_float(t.get("net_amount"))
        e["gp"] += _safe_float(t.get("gp_amount"))
        if t.get("customer"):
            e["customers"].add(t.get("customer"))
        if t.get("invoice_no"):
            e["orders"].add(t.get("invoice_no"))

    target_map = defaultdict(float)
    if targets:
        for tg in targets:
            target_map[tg["salesperson"]] += tg["target"]

    rows = []
    for s, e in by_sp.items():
        target = target_map.get(s, 0)
        rows.append({
            "salesperson": s,
            "sales": round(e["sales"], 2),
            "gp": round(e["gp"], 2),
            "gp_pct": round(e["gp"] / e["sales"] * 100, 2) if e["sales"] else 0,
            "customers": len(e["customers"]),
            "orders": len(e["orders"]),
            "target": round(target, 2),
            "achievement_pct": round(e["sales"] / target * 100, 2) if target else 0,
        })
    rows.sort(key=lambda r: r["sales"], reverse=True)
    return {"rows": rows}
