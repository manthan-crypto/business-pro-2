# Sales MIS Analytics Platform — PRD

## Original Problem Statement
Build a Sales MIS app that ingests Excel of customer-wise / product-wise / monthly sales and produces:
- Customer Analytics (Top 20, GP, Growth vs prev month, Lost/New/Dormant, AOV, Contribution %)
- Product Analytics (Sales, Qty, GP, Fast/Slow/Zero movers, Contribution %)
- Country Analytics (Sales, Growth, Customers, AOV, Ranking)
- Monthly Trends (Daily/Weekly/Monthly, Running Sales, Month-end Forecast, Sales vs Target)
- Salesperson Analytics (Sales, GP, Target vs Achievement)
- Smart Alerts (Sales drop >20%, inactive >90d, product surge >30%, GP threshold, etc.)
- Editable data grid to fill blank fields directly and refresh

## User Choices
- Auth: JWT-based multi-user
- Column mapping: auto-detect with manual override
- Data editor: full inline table + missing-value warnings
- Targets: manually entered per salesperson per month
- Currency: INR

## Architecture
- Backend: FastAPI + MongoDB (motor async), bcrypt+PyJWT httpOnly cookies
  - `/api/auth/*` (register, login, logout, me)
  - `/api/datasets` (upload/list/activate/delete/update-mapping)
  - `/api/transactions` (list, patch)
  - `/api/analytics/*` (overview, customers, products, countries, trends, salespersons, alerts)
  - `/api/targets` (CRUD)
- Excel Parser: auto-detects header row, maps 16 canonical fields (invoice_no, customer, product, qty, rate, cost_price, gp_pct, gp_amount, net_amount, salesperson, country, category, manufacturer, area, mode, invoice_date)
- Frontend: React + Tailwind + Shadcn + Recharts, Swiss/Brutalist Chivo aesthetic, fixed sidebar layout

## What's Implemented (2026-06-30)
- Full JWT auth with admin seeding (admin@salesmis.com / Admin@123)
- Excel upload with auto column detection (verified on 8,563-row Outward file — mapped all 16 canonical fields automatically)
- 11 pages: Overview, Upload, Customers, Products, Countries, Trends, Sales Team, Smart Alerts, Data Editor, Targets, Datasets
- Smart Alerts engine (7 alert categories)
- Data editor with pagination, search, "only missing" filter, inline save
- Targets CRUD with Achievement % on Sales Team page
- Multiple datasets per user with switch-active + column re-mapping

## Backlog / P1
- Quarterly & Yearly executive dashboards (ABC analysis, CLV, lifecycle)
- Sales Director / CEO / Procurement / Finance role dashboards
- Currency-wise sales, credit exposure, payment terms
- Export reports as PDF/Excel
- Multi-file merge (transaction + customer monthly summary)

## Update — Executive Dashboards + Reports + Multi-file Merge (2026-08-01)

### Added
- **Executive Dashboards** (3 new pages):
  - CEO: KPIs, target achievement, MoM growth, top-10 concentration, monthly trend, top customers, top salespersons, growth/decline highlights, month-end forecast
  - Sales Director: Pipeline, growth leaders/decliners, new/lost customers, top salespersons, top products, country ranking
  - Finance: GP margins, currency (country) split, top credit exposure, low-margin customers, payment mode analysis
- **Multi-file Merge**: Excel parser auto-detects `monthly_summary` format (APR..MAR columns) vs `transaction` format. Summary rows are exploded into 12 synthetic month-end transactions. Any page + all executive dashboards accept `dataset_id=all` to merge across ALL uploaded datasets. DatasetSelector toggle (Active/All Merged) appears when ≥2 datasets exist.
- **Report Export**:
  - Excel (xlsxwriter): Customers, Products, Countries multi-sheet reports
  - PDF (reportlab): CEO, Sales Director, Finance branded landscape reports with KPI tables + top-N sections
  - ExportBar component with PDF/Excel buttons on relevant pages
- Sidebar reorganized into sections: OVERVIEW / ANALYTICS / EXECUTIVE / MANAGE

### Verified
- Uploaded VIPL_CUSTOMER_TOP_5.xls → 193 synthetic rows (from monthly summary format)
- Uploaded outward.xls (8,563 rows) → merged view shows ₹53 Cr total sales, 8,566 orders
- All PDF/Excel exports return 200 with valid bytes (Excel 22-186 KB, PDF 4-7 KB)

## Update — Quarterly Business Review + Currency Field (2026-08-01)

### Added
- **QBR (Quarterly Business Review) page**: New `/quarterly` route with fiscal-year (Apr–Mar) grouping
  - FY tabs (auto-detected from data range)
  - Per-FY KPIs (sales, GP, orders, active customers, target achievement)
  - Four Q-cards (Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar) with QoQ + YoY growth, GP%, AOV, target achievement
  - Cross-FY trend chart + detailed table
  - Endpoint: `GET /api/analytics/quarterly?dataset_id=[all|<id>]`
- **Currency canonical field**: Added `currency` to `CANONICAL_FIELDS` (aliases: currency/curr/ccy/cur/fcy)
  - Auto-detected from Excel columns; manually mappable via Datasets page
  - Finance dashboard automatically switches from "Country-wise (proxy)" to true "Currency-wise" grouping when the field is mapped
  - Helpful tip banner shown when currency field is not detected

## Update — Customer × Month Pivot Analysis (2026-08-04)

### Added
- **Customer × Month Analysis page** (`/customer-monthly`): Wide pivot table with one row per customer and one column per month showing net sales (or GP)
  - Sticky first column (Customer)
  - Fiscal Year filter, Sales/GP metric toggle, search across customer/country/salesperson
  - Sortable by any column including individual months
  - Active-Months badge (e.g., 3/3 = ordered every month)
  - Column totals footer + Grand total in header
  - Excel export (2-sheet: Sales pivot + GP pivot)
- Backend: `pivot.py` with `customer_month_pivot(txs, fy=None)`
- Endpoints:
  - `GET /api/analytics/customer-month-pivot?dataset_id=[all|<id>]&fy=<int>`
  - `GET /api/reports/customer_month_pivot.xlsx?...`

### Verified
- Merged view (outward + Top-N summary) → 112 customers × 3 months, ₹53.06 Cr grand total
- Top-N-Summary alone → 112 customers × 3 months, ₹25.34 Cr
- Excel export returns valid .xlsx (20 KB)

## Update — Pivots, ABC Tiering & Month Compare (2026-08-04)

### Added 4 new modules
- **Product × Month** (`/product-monthly`): Wide pivot with sales/qty/GP toggle, trend arrows (last vs first month), filters for surged/declined/dead products
- **Customer × Salesperson** (`/customer-salesperson`): Grid showing revenue split by salesperson per customer, primary owner highlighted, per-SP summary cards, shared-by count
- **ABC Customer Analysis** (`/abc`): Pareto tiering — A (top 80%), B (next 15%), C (last 5%). Verified: 25 A-tier customers = 79.27% revenue. Pareto curve chart + per-tier customer/sales breakdown
- **Compare Months** (`/compare`): Side-by-side month picker with status classification (NEW/LOST/SURGED ≥20%/DROPPED ≥20%/STABLE), growth arrows, status count cards, entity toggle (customers vs products)

### Backend
- Extended `pivot.py` with `product_month_pivot`, `customer_salesperson_pivot`, `abc_analysis`, `month_compare`
- 4 new endpoints under `/api/analytics/*`
- Sidebar reorganised: new "PIVOTS & TIERING" section
