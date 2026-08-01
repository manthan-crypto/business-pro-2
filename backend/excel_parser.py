"""Excel ingestion - auto-detects TRANSACTION or SUMMARY format and produces canonical transactions."""
import pandas as pd
import re
from typing import Dict, List, Tuple, Optional
from datetime import datetime, date
import calendar
import io

# Canonical fields the system understands.
CANONICAL_FIELDS = {
    "invoice_no": ["invno", "invoice", "invoiceno", "bill no", "bill", "billno", "doc no"],
    "invoice_date": ["invdate", "invoicedate", "date", "bill date", "billdate", "doc date"],
    "customer": ["ledger account", "customer", "customer name", "party", "buyer", "client", "account", "ledger"],
    "product": ["product name", "product", "item", "item name", "description", "particulars"],
    "category": ["pcategory", "category", "therapeutic", "ccategory"],
    "manufacturer": ["manufacturer", "manufacturer / division", "brand", "mfg"],
    "qty": ["qty", "quantity", "qnty", "units"],
    "rate": ["rate", "price", "sell price", "sale rate", "selling price"],
    "cost_price": ["cp", "cost", "cost price", "purchase rate", "purchase price", "buy price"],
    "gp_pct": ["gp%", "gp %", "gp pct", "gp percent", "margin%", "margin %", "svg%"],
    "gp_amount": ["gpamt", "gp amount", "gp amt", "gross profit", "margin"],
    "net_amount": ["netamt", "net amount", "net amt", "total", "amount", "sale value", "value", "net"],
    "salesperson": ["sman", "salesman", "salesperson", "sales person", "sales rep", "rep", "agent"],
    "country": ["city", "country", "nation"],
    "area": ["area", "region", "location", "p_areacity"],
    "mode": ["mode", "type", "transaction type"],
    "currency": ["currency", "curr", "ccy", "cur", "fcy"],
}

MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
MONTH_IDX = {m: i + 1 for i, m in enumerate(MONTH_NAMES)}


def _norm(s) -> str:
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s).strip().lower())


def detect_header_row(df: pd.DataFrame, max_scan: int = 15) -> int:
    hints = set()
    for vlist in CANONICAL_FIELDS.values():
        hints.update(vlist)
    hints.update([m.lower() for m in MONTH_NAMES])
    best_row, best_score = 0, 0
    for i in range(min(max_scan, len(df))):
        row_vals = [_norm(v) for v in df.iloc[i].tolist()]
        score = sum(1 for v in row_vals if v in hints)
        if score > best_score:
            best_score, best_row = score, i
    return best_row if best_score >= 3 else 0


def _detect_summary_format(headers: List[str]) -> Tuple[bool, str]:
    """Detects if this is a monthly summary format (e.g., customer with APR..MAR cols)."""
    upper = [str(h).strip().upper() for h in headers]
    months_found = [m for m in MONTH_NAMES if m in upper]
    # summary if at least 3 month columns present alongside a customer column
    has_cust = any(("customer" in _norm(h) or _norm(h) == "ledger account") for h in headers)
    return (len(months_found) >= 3 and has_cust, "monthly_summary" if len(months_found) >= 3 and has_cust else "transaction")


def auto_map_columns(headers: List[str]) -> Dict[str, str]:
    mapping = {}
    norm_headers = {_norm(h): h for h in headers if h}
    for canonical, aliases in CANONICAL_FIELDS.items():
        for a in aliases:
            if a in norm_headers:
                mapping[canonical] = norm_headers[a]
                break
    return mapping


def _to_float(v) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        if isinstance(v, str):
            v = v.replace(",", "").strip()
            if v == "" or v == "-":
                return None
        f = float(v)
        return f if not (f != f) else None  # NaN check
    except (ValueError, TypeError):
        return None


def _to_date(v) -> Optional[str]:
    if v is None or v == "":
        return None
    if isinstance(v, str):
        for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%y"):
            try:
                return datetime.strptime(v.split("T")[0] if "T" in v else v, fmt).date().isoformat()
            except ValueError:
                continue
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    return None


def parse_excel(file_bytes: bytes, filename: str) -> Tuple[List[str], List[dict], Dict[str, str], int, str]:
    """Returns (headers, raw_rows_as_dicts, auto_mapping, header_row_idx, file_kind)."""
    bio = io.BytesIO(file_bytes)
    ext = filename.lower().split(".")[-1]
    engine = "xlrd" if ext == "xls" else "openpyxl"
    df_raw = pd.read_excel(bio, sheet_name=0, header=None, engine=engine)
    header_idx = detect_header_row(df_raw)
    headers_row = df_raw.iloc[header_idx].tolist()
    headers = []
    seen = {}
    for i, h in enumerate(headers_row):
        name = str(h).strip() if h is not None and not (isinstance(h, float) and pd.isna(h)) else f"col_{i}"
        if name in seen:
            seen[name] += 1
            name = f"{name}_{seen[name]}"
        else:
            seen[name] = 0
        headers.append(name)
    data = df_raw.iloc[header_idx + 1:].copy()
    data.columns = headers
    data = data.dropna(how="all")
    rows = []
    for _, r in data.iterrows():
        d = {}
        for h in headers:
            v = r[h]
            if isinstance(v, float) and pd.isna(v):
                d[h] = None
            elif isinstance(v, (pd.Timestamp, datetime)):
                d[h] = v.isoformat()
            else:
                d[h] = v
        rows.append(d)
    is_summary, kind = _detect_summary_format(headers)
    mapping = auto_map_columns(headers)
    return headers, rows, mapping, header_idx, kind


def _infer_year(filename: str) -> int:
    m = re.search(r"(20\d{2})", filename)
    if m:
        return int(m.group(1))
    return datetime.now().year


def _summary_to_transactions(rows: List[dict], mapping: Dict[str, str], headers: List[str], filename: str) -> List[dict]:
    """Explode a monthly-summary row into 12 synthetic transactions (one per month with sales > 0)."""
    year = _infer_year(filename)
    # Financial year: APR is month 4 of `year`, JAN-MAR are next calendar year.
    upper_headers = {str(h).strip().upper(): h for h in headers}
    out = []
    for r in rows:
        customer = r.get(mapping.get("customer", ""))
        if not customer or (isinstance(customer, float) and pd.isna(customer)):
            continue
        country = r.get(mapping.get("country", ""))
        salesperson = r.get(mapping.get("salesperson", ""))
        category = r.get(mapping.get("category", ""))
        area = r.get(mapping.get("area", ""))
        currency = r.get(mapping.get("currency", "")) if mapping.get("currency") else None
        gp_pct_val = _to_float(r.get(mapping.get("gp_pct", "")))
        total_gp = _to_float(r.get(mapping.get("gp_amount", "")))
        total_sales = _to_float(r.get(mapping.get("net_amount", "")))
        for month_name in MONTH_NAMES:
            if month_name not in upper_headers:
                continue
            v = _to_float(r.get(upper_headers[month_name]))
            if not v or v == 0:
                continue
            month_num = MONTH_IDX[month_name]
            # Financial year: APR-DEC in `year`, JAN-MAR in `year+1`
            calendar_year = year if month_num >= 4 else year + 1
            last_day = calendar.monthrange(calendar_year, month_num)[1]
            iso_date = date(calendar_year, month_num, last_day).isoformat()
            # allocate GP proportionally if total available
            gp_amount = None
            if total_gp is not None and total_sales:
                gp_amount = round(total_gp * (v / total_sales), 2)
            elif gp_pct_val:
                gp_amount = round(v * gp_pct_val / 100, 2)
            out.append({
                "raw": {**r, "_synthetic_month": month_name},
                "missing": [],
                "customer": str(customer).strip(),
                "product": "-- Monthly Summary --",
                "category": (str(category).strip() if category else None),
                "manufacturer": None,
                "qty": None,
                "rate": None,
                "cost_price": None,
                "gp_pct": gp_pct_val,
                "gp_amount": gp_amount,
                "net_amount": v,
                "salesperson": (str(salesperson).strip() if salesperson else None),
                "country": (str(country).strip() if country else None),
                "area": (str(area).strip() if area else None),
                "currency": (str(currency).strip() if currency else None),
                "mode": "SUMMARY",
                "invoice_no": f"SUM-{month_name}-{calendar_year}",
                "invoice_date": iso_date,
                "year_month": iso_date[:7],
                "source_kind": "monthly_summary",
            })
    return out


def canonicalize_rows(rows: List[dict], mapping: Dict[str, str], file_kind: str = "transaction", filename: str = "", headers: List[str] = None) -> List[dict]:
    """Convert rows -> canonical transaction docs, handling both transaction and summary formats."""
    if file_kind == "monthly_summary":
        return _summary_to_transactions(rows, mapping, headers or [], filename)

    out = []
    for r in rows:
        doc = {"raw": r, "missing": [], "source_kind": "transaction"}
        for canonical, src in mapping.items():
            val = r.get(src)
            if canonical in ("qty", "rate", "cost_price", "gp_pct", "gp_amount", "net_amount"):
                doc[canonical] = _to_float(val)
            elif canonical == "invoice_date":
                doc[canonical] = _to_date(val)
            else:
                doc[canonical] = (str(val).strip() if val is not None else None)
        if doc.get("net_amount") is None and doc.get("qty") and doc.get("rate"):
            doc["net_amount"] = doc["qty"] * doc["rate"]
        if doc.get("gp_amount") is None and doc.get("qty") and doc.get("rate") and doc.get("cost_price"):
            doc["gp_amount"] = doc["qty"] * (doc["rate"] - doc["cost_price"])
        if doc.get("gp_pct") is None and doc.get("net_amount") and doc.get("gp_amount") is not None and doc["net_amount"] != 0:
            doc["gp_pct"] = round((doc["gp_amount"] / doc["net_amount"]) * 100, 2)
        for key in ["customer", "product", "invoice_date", "net_amount"]:
            if doc.get(key) in (None, "", "nan"):
                doc["missing"].append(key)
        if doc.get("invoice_date"):
            doc["year_month"] = doc["invoice_date"][:7]
        out.append(doc)
    return out


def merge_datasets_txs(datasets_txs: List[List[dict]]) -> List[dict]:
    """Combine transactions from multiple datasets into a single stream."""
    merged = []
    for txs in datasets_txs:
        merged.extend(txs)
    return merged
