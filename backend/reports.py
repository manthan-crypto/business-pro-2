"""Report export - Excel (xlsxwriter) and PDF (reportlab)."""
import io
from typing import List, Dict, Any
import pandas as pd
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT


def _fmt_inr(v):
    if v is None or v == "" or (isinstance(v, float) and v != v):
        return "-"
    try:
        n = float(v)
        return f"₹{n:,.0f}"
    except (ValueError, TypeError):
        return str(v)


def _fmt_num(v):
    if v is None or v == "":
        return "-"
    try:
        return f"{float(v):,.0f}"
    except (ValueError, TypeError):
        return str(v)


def _fmt_pct(v):
    if v is None or v == "":
        return "-"
    try:
        return f"{float(v):.2f}%"
    except (ValueError, TypeError):
        return str(v)


# ------------- Excel Export -------------
def export_excel(sheets: Dict[str, List[dict]], title: str) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="xlsxwriter") as writer:
        wb = writer.book
        header_fmt = wb.add_format({"bold": True, "bg_color": "#0A0A0A", "font_color": "white", "border": 1})
        cur_fmt = wb.add_format({"num_format": "#,##0.00"})
        for sheet_name, rows in sheets.items():
            if not rows:
                pd.DataFrame([{"note": "No data"}]).to_excel(writer, sheet_name=sheet_name[:31], index=False)
                continue
            df = pd.DataFrame(rows)
            df.to_excel(writer, sheet_name=sheet_name[:31], index=False, startrow=1)
            ws = writer.sheets[sheet_name[:31]]
            ws.write(0, 0, title, wb.add_format({"bold": True, "font_size": 14}))
            for i, col in enumerate(df.columns):
                ws.write(1, i, col, header_fmt)
                col_len = max(len(str(col)), *(len(str(v)) for v in df[col].head(50).fillna("")))
                ws.set_column(i, i, min(col_len + 2, 40))
    buf.seek(0)
    return buf.getvalue()


# ------------- PDF Export -------------
def _pdf_table(data: List[List[Any]], col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0A0A0A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#BBBBBB")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FAFAFA")),
    ]))
    return t


def export_pdf(title: str, subtitle: str, sections: List[Dict[str, Any]]) -> bytes:
    """sections: [{'heading': str, 'columns': [...], 'rows': [[...],...]}]"""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=1 * cm, rightMargin=1 * cm, topMargin=1 * cm, bottomMargin=1 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=18, textColor=colors.HexColor("#0A0A0A"), alignment=TA_LEFT, spaceAfter=2)
    sub_style = ParagraphStyle("s", parent=styles["Normal"], fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#555555"), spaceAfter=12)
    h_style = ParagraphStyle("h", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11, textColor=colors.HexColor("#002FA7"), spaceBefore=8, spaceAfter=4)
    story = [Paragraph(title, title_style), Paragraph(subtitle, sub_style)]
    for sec in sections:
        story.append(Paragraph(sec["heading"], h_style))
        rows = sec.get("rows", [])
        cols = sec.get("columns", [])
        if not rows:
            story.append(Paragraph("<i>No data.</i>", styles["Normal"]))
            continue
        data = [cols] + rows
        story.append(_pdf_table(data))
        story.append(Spacer(1, 0.2 * cm))
    doc.build(story)
    buf.seek(0)
    return buf.getvalue()


# ------------- Dashboard-specific builders -------------
def build_customer_report_excel(cust_data: Dict[str, Any]) -> bytes:
    return export_excel({
        "Top 20 Customers": cust_data.get("top20", []),
        "All Customers": cust_data.get("rows", []),
        "Growth M-o-M": cust_data.get("growth", []),
        "New Customers": [{"customer": c} for c in cust_data.get("new_customers", [])],
        "Lost Customers": [{"customer": c} for c in cust_data.get("lost_customers", [])],
        "Dormant Customers": cust_data.get("dormant_customers", []),
    }, "Customer Analytics Report")


def build_product_report_excel(prod_data: Dict[str, Any]) -> bytes:
    return export_excel({
        "Top 20 Products": prod_data.get("top20", []),
        "All Products": prod_data.get("rows", []),
        "Fast Movers": prod_data.get("fast_movers", []),
        "Slow Movers": prod_data.get("slow_movers", []),
        "Zero Sales": prod_data.get("zero_sales", []),
    }, "Product Analytics Report")


def build_country_report_excel(country_data: Dict[str, Any]) -> bytes:
    return export_excel({
        "Country Ranking": country_data.get("rows", []),
        "Growth by Country": country_data.get("growth", []),
    }, "Country Analytics Report")


def build_ceo_pdf(ceo: Dict[str, Any]) -> bytes:
    k = ceo["kpis"]
    kpi_rows = [
        ["Total Sales", _fmt_inr(k["total_sales"])],
        ["Total GP", f'{_fmt_inr(k["total_gp"])} ({k["gp_pct"]}%)'],
        ["Orders", _fmt_num(k["orders"])],
        ["Active Customers", _fmt_num(k["active_customers"])],
        ["Avg Order Value", _fmt_inr(k["avg_order_value"])],
        ["MoM Growth", _fmt_pct(k.get("mom_growth_pct"))],
        ["Target", _fmt_inr(k.get("total_target"))],
        ["Target Achievement", _fmt_pct(k.get("target_achievement_pct"))],
        ["Top-10 Concentration", _fmt_pct(k.get("top10_concentration_pct"))],
    ]
    top_c_rows = [[i + 1, r["customer"][:35], _fmt_inr(r["sales"]), _fmt_pct(r["contribution_pct"]), _fmt_inr(r["gp"])] for i, r in enumerate(ceo.get("top_customers", []))]
    top_sp_rows = [[r["salesperson"][:30], _fmt_inr(r["sales"]), _fmt_inr(r["gp"]), _fmt_pct(r["achievement_pct"]) if r["target"] else "-"] for r in ceo.get("top_salespersons", [])]
    monthly_rows = [[m["month"], _fmt_inr(m["sales"]), _fmt_inr(m["gp"]), _fmt_num(m["orders"])] for m in ceo.get("monthly_trend", [])]
    return export_pdf(
        "CEO Dashboard",
        "Executive summary of revenue, GP, top customers, sales team and momentum.",
        [
            {"heading": "Key Performance Indicators", "columns": ["Metric", "Value"], "rows": kpi_rows},
            {"heading": "Top 10 Customers", "columns": ["#", "Customer", "Sales", "Contri %", "GP"], "rows": top_c_rows},
            {"heading": "Top 5 Salespersons", "columns": ["Salesperson", "Sales", "GP", "Target Ach"], "rows": top_sp_rows},
            {"heading": "Monthly Trend", "columns": ["Month", "Sales", "GP", "Orders"], "rows": monthly_rows},
        ],
    )


def build_sales_director_pdf(sd: Dict[str, Any]) -> bytes:
    pipeline = sd["pipeline"]
    kpi_rows = [
        ["Last Month Sales", _fmt_inr(pipeline["last_month_sales"])],
        ["Last Month GP", _fmt_inr(pipeline["last_month_gp"])],
        ["Last Month Orders", _fmt_num(pipeline["last_month_orders"])],
        ["New Customers", str(len(sd["new_customers"]))],
        ["Lost Customers", str(len(sd["lost_customers"]))],
    ]
    growth_rows = [[g["customer"][:35], _fmt_inr(g["previous"]), _fmt_inr(g["current"]), _fmt_pct(g["growth_pct"])] for g in sd.get("customer_growth_leaders", [])]
    decline_rows = [[g["customer"][:35], _fmt_inr(g["previous"]), _fmt_inr(g["current"]), _fmt_pct(g["growth_pct"])] for g in sd.get("customer_declines", [])]
    sp_rows = [[r["salesperson"][:30], _fmt_inr(r["sales"]), _fmt_inr(r["gp"]), _fmt_num(r["customers"])] for r in sd.get("top_salespersons", [])]
    prod_rows = [[r["product"][:40], _fmt_inr(r["sales"]), _fmt_num(r["qty"]), _fmt_pct(r["gp_pct"])] for r in sd.get("top_products", [])]
    country_rows = [[r["country"][:30], _fmt_inr(r["sales"]), _fmt_num(r["customers"]), _fmt_pct(r["contribution_pct"])] for r in sd.get("country_ranking", [])]
    return export_pdf(
        "Sales Director Dashboard",
        "Growth leaders, pipeline, top salespersons, product performance and geography.",
        [
            {"heading": "Pipeline & Metrics", "columns": ["Metric", "Value"], "rows": kpi_rows},
            {"heading": "Top Growing Customers", "columns": ["Customer", "Previous", "Current", "Growth %"], "rows": growth_rows},
            {"heading": "Top Declining Customers", "columns": ["Customer", "Previous", "Current", "Growth %"], "rows": decline_rows},
            {"heading": "Top Salespersons", "columns": ["Name", "Sales", "GP", "Customers"], "rows": sp_rows},
            {"heading": "Top Products", "columns": ["Product", "Sales", "Qty", "GP %"], "rows": prod_rows},
            {"heading": "Country Ranking", "columns": ["Country", "Sales", "Customers", "Contri %"], "rows": country_rows},
        ],
    )


def build_finance_pdf(fin: Dict[str, Any]) -> bytes:
    k = fin["kpis"]
    kpi_rows = [
        ["Total Sales", _fmt_inr(k["total_sales"])],
        ["Total GP", _fmt_inr(k["total_gp"])],
        ["GP Margin", _fmt_pct(k["gp_pct"])],
        ["Orders", _fmt_num(k["orders"])],
    ]
    cur_rows = [[c["country"][:30], _fmt_inr(c["sales"]), _fmt_inr(c["gp"]), _fmt_pct(c["gp_pct"])] for c in fin.get("currency_wise", [])[:15]]
    ce_rows = [[c["customer"][:35], _fmt_inr(c["sales"]), _fmt_pct(c["contribution_pct"])] for c in fin.get("top_credit_exposure", [])]
    lgp_rows = [[c["customer"][:35], _fmt_inr(c["sales"]), _fmt_pct(c["gp_pct"])] for c in fin.get("low_gp_customers", [])]
    mode_rows = [[m["mode"], _fmt_inr(m["sales"]), _fmt_pct(m["gp_pct"]), _fmt_num(m["orders"])] for m in fin.get("payment_mode_analysis", [])]
    return export_pdf(
        "Finance Dashboard",
        "GP margins, currency (country) split, credit exposure and payment mode analysis.",
        [
            {"heading": "KPIs", "columns": ["Metric", "Value"], "rows": kpi_rows},
            {"heading": "Currency / Country-wise Sales", "columns": ["Country", "Sales", "GP", "GP %"], "rows": cur_rows},
            {"heading": "Top Credit Exposure (by sales)", "columns": ["Customer", "Sales", "Contri %"], "rows": ce_rows},
            {"heading": "Low-Margin Customers", "columns": ["Customer", "Sales", "GP %"], "rows": lgp_rows},
            {"heading": "Payment Mode / Transaction Type", "columns": ["Mode", "Sales", "GP %", "Orders"], "rows": mode_rows},
        ],
    )
