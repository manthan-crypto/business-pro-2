"""Excel ingestion - auto-detects column mapping and parses transactions."""
import pandas as pd
import re
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timezone
import io

# Canonical fields the system understands.
CANONICAL_FIELDS = {
    "invoice_no": ["invno", "invoice", "invoiceno", "bill no", "bill", "billno", "doc no"],
    "invoice_date": ["invdate", "invoicedate", "date", "bill date", "billdate", "doc date"],
    "customer": ["ledger account", "customer", "customer name", "party", "buyer", "client", "account", "ledger"],
    "product": ["product name", "product", "item", "item name", "description", "particulars"],
    "category": ["pcategory", "category", "therapeutic"],
    "manufacturer": ["manufacturer", "manufacturer / division", "brand", "mfg"],
    "qty": ["qty", "quantity", "qnty", "units"],
    "rate": ["rate", "price", "sell price", "sale rate", "selling price"],
    "cost_price": ["cp", "cost", "cost price", "purchase rate", "purchase price", "buy price"],
    "gp_pct": ["gp%", "gp %", "gp pct", "gp percent", "margin%", "margin %"],
    "gp_amount": ["gpamt", "gp amount", "gp amt", "gross profit", "margin"],
    "net_amount": ["netamt", "net amount", "net amt", "total", "amount", "sale value", "value", "net"],
    "salesperson": ["sman", "salesman", "salesperson", "sales person", "sales rep", "rep", "agent"],
    "country": ["city", "country", "nation"],
    "area": ["area", "region", "location", "p_areacity"],
    "mode": ["mode", "type", "transaction type"],
}


def _norm(s) -> str:
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s).strip().lower())


def detect_header_row(df: pd.DataFrame, max_scan: int = 15) -> int:
    """Find the row that looks like a header (has known canonical hints)."""
    hints = set()
    for vlist in CANONICAL_FIELDS.values():
        hints.update(vlist)
    best_row, best_score = 0, 0
    for i in range(min(max_scan, len(df))):
        row_vals = [_norm(v) for v in df.iloc[i].tolist()]
        score = sum(1 for v in row_vals if v in hints)
        if score > best_score:
            best_score, best_row = score, i
    return best_row if best_score >= 3 else 0


def auto_map_columns(headers: List[str]) -> Dict[str, str]:
    """Map canonical_field -> header_name."""
    mapping = {}
    norm_headers = {_norm(h): h for h in headers if h}
    for canonical, aliases in CANONICAL_FIELDS.items():
        for a in aliases:
            if a in norm_headers:
                mapping[canonical] = norm_headers[a]
                break
    return mapping


def parse_excel(file_bytes: bytes, filename: str) -> Tuple[List[str], List[dict], Dict[str, str], int]:
    """Returns (headers, raw_rows_as_dicts, auto_mapping, header_row_idx)."""
    bio = io.BytesIO(file_bytes)
    ext = filename.lower().split(".")[-1]
    engine = "xlrd" if ext == "xls" else "openpyxl"
    df_raw = pd.read_excel(bio, sheet_name=0, header=None, engine=engine)
    header_idx = detect_header_row(df_raw)
    headers_row = df_raw.iloc[header_idx].tolist()
    # Sanitize header names
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
    # drop fully empty rows
    data = data.dropna(how="all")
    # convert to dicts, normalize NaN -> None
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
    mapping = auto_map_columns(headers)
    return headers, rows, mapping, header_idx


def _to_float(v) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        if isinstance(v, str):
            v = v.replace(",", "").strip()
            if v == "" or v == "-":
                return None
        return float(v)
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


def canonicalize_rows(rows: List[dict], mapping: Dict[str, str]) -> List[dict]:
    """Convert rows -> canonical transaction docs."""
    out = []
    for r in rows:
        doc = {"raw": r, "missing": []}
        for canonical, src in mapping.items():
            val = r.get(src)
            if canonical in ("qty", "rate", "cost_price", "gp_pct", "gp_amount", "net_amount"):
                doc[canonical] = _to_float(val)
            elif canonical == "invoice_date":
                doc[canonical] = _to_date(val)
            else:
                doc[canonical] = (str(val).strip() if val is not None else None)
        # compute derived if missing
        if doc.get("net_amount") is None and doc.get("qty") and doc.get("rate"):
            doc["net_amount"] = doc["qty"] * doc["rate"]
        if doc.get("gp_amount") is None and doc.get("qty") and doc.get("rate") and doc.get("cost_price"):
            doc["gp_amount"] = doc["qty"] * (doc["rate"] - doc["cost_price"])
        if doc.get("gp_pct") is None and doc.get("net_amount") and doc.get("gp_amount") is not None and doc["net_amount"] != 0:
            doc["gp_pct"] = round((doc["gp_amount"] / doc["net_amount"]) * 100, 2)
        # detect missing required
        for key in ["customer", "product", "invoice_date", "net_amount"]:
            if doc.get(key) in (None, "", "nan"):
                doc["missing"].append(key)
        # month bucket
        if doc.get("invoice_date"):
            doc["year_month"] = doc["invoice_date"][:7]
        out.append(doc)
    return out
