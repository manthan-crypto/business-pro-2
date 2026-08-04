import React, { useEffect, useState, useMemo } from "react";
import api from "../lib/api";
import { SectionTitle, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import DatasetSelector from "../components/DatasetSelector";
import { Package, Search, TrendingUp, TrendingDown } from "lucide-react";

const MONTH_LABEL = { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec" };

export default function ProductMonthlyPage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active");
  const [fy, setFy] = useState("");
  const [metric, setMetric] = useState("sales"); // sales | qty | gp
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | surged | declined | new | dead

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const params = {};
    if (scope === "all") params.dataset_id = "all";
    if (fy) params.fy = parseInt(fy);
    api.get("/analytics/product-month-pivot", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id, scope, fy]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (search) rows = rows.filter((r) => r.product.toLowerCase().includes(search.toLowerCase()) || (r.category || "").toLowerCase().includes(search.toLowerCase()));
    if (statusFilter === "surged") rows = rows.filter((r) => (r.trend_pct ?? -999) >= 20);
    else if (statusFilter === "declined") rows = rows.filter((r) => (r.trend_pct ?? 999) <= -20);
    else if (statusFilter === "new") rows = rows.filter((r) => r.active_months === 1 && r.months[data.months[data.months.length - 1]] > 0);
    else if (statusFilter === "dead") rows = rows.filter((r) => r.active_months < data.months.length / 2);
    return rows;
  }, [data, search, statusFilter]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see product-monthly analysis." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const monthCol = (ym) => `${MONTH_LABEL[ym.split("-")[1]]} '${ym.split("-")[0].slice(2)}`;
  const cellKey = metric === "gp" ? "months_gp" : metric === "qty" ? "months_qty" : "months";
  const colTotalKey = metric === "gp" ? "col_totals_gp" : metric === "qty" ? "col_totals_qty" : "col_totals";
  const totalCol = metric === "gp" ? "total_gp" : metric === "qty" ? "total_qty" : "total_sales";
  const fmt = metric === "qty" ? fmtNum : fmtINR;

  return (
    <div className="space-y-8">
      <SectionTitle sub={`${data.products} products × ${data.months.length} months  ·  Grand ${fmt(data[metric === "gp" ? "grand_gp" : metric === "qty" ? "grand_qty" : "grand_total"])}`} action={
        <DatasetSelector scope={scope} setScope={setScope} />
      }>
        <div className="flex items-center gap-2"><Package className="w-5 h-5 text-[#002FA7]" /> Product × Month Analysis</div>
      </SectionTitle>

      <div className="sharp-card p-4 flex flex-wrap items-center gap-3">
        <div>
          <div className="kbd-label mb-1">Fiscal Year</div>
          <select value={fy} onChange={(e) => setFy(e.target.value)} className="border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-[#002FA7]" data-testid="pmonth-fy">
            <option value="">All FYs</option>
            {(data.available_fiscal_years || []).map((f) => <option key={f} value={f}>FY{f}-{String(f + 1).slice(-2)}</option>)}
          </select>
        </div>
        <div>
          <div className="kbd-label mb-1">Metric</div>
          <div className="inline-flex border border-slate-300">
            {[["sales","Sales"],["qty","Qty"],["gp","GP"]].map(([k,l]) => (
              <button key={k} onClick={() => setMetric(k)}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${metric === k ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                data-testid={`pmonth-metric-${k}`}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="kbd-label mb-1">Movement</div>
          <div className="inline-flex border border-slate-300 flex-wrap">
            {[["all","All"],["surged","Surged ≥20%"],["declined","Declined ≥20%"],["dead","Slow/Dead"]].map(([k,l]) => (
              <button key={k} onClick={() => setStatusFilter(k)}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${statusFilter === k ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                data-testid={`pmonth-status-${k}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="kbd-label mb-1">Search</div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product or category..."
              className="border border-slate-300 pl-7 pr-3 py-1.5 text-xs w-full focus:outline-none focus:border-[#002FA7]" data-testid="pmonth-search" />
          </div>
        </div>
      </div>

      <div className="sharp-card overflow-x-auto scrollbar-thin">
        <table className="dense-table w-full" data-testid="product-month-table">
          <thead>
            <tr>
              <th style={{ position:"sticky", left:0, background:"#F8FAFC", zIndex:2 }}>Product</th>
              <th>Category</th>
              {data.months.map((ym) => <th key={ym} className="text-right">{monthCol(ym)}</th>)}
              <th className="text-right">Total</th>
              <th className="text-right">GP %</th>
              <th className="text-right">Trend</th>
              <th className="text-right">Active</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.slice(0, 200).map((r, i) => (
              <tr key={r.product}>
                <td className="font-bold text-xs" style={{ position:"sticky", left:0, background:"white", zIndex:1 }}>
                  <span className="text-slate-400 mono mr-2">{i + 1}</span>{r.product}
                </td>
                <td className="text-xs">{r.category || "—"}</td>
                {data.months.map((ym) => {
                  const v = r[cellKey][ym] || 0;
                  return <td key={ym} className={`mono text-right ${v === 0 ? "text-slate-300" : ""}`}>{v === 0 ? "—" : fmt(v)}</td>;
                })}
                <td className="mono text-right font-black">{fmt(r[totalCol])}</td>
                <td className="mono text-right">{fmtPct(r.gp_pct)}</td>
                <td className="mono text-right">
                  {r.trend_pct == null ? <span className="text-slate-400">—</span> :
                    <span className={`inline-flex items-center gap-0.5 font-bold ${r.trend_pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {r.trend_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {r.trend_pct.toFixed(0)}%
                    </span>
                  }
                </td>
                <td className="mono text-right">
                  <Badge variant={r.active_months === data.months.length ? "success" : r.active_months === 0 ? "danger" : "default"}>
                    {r.active_months}/{data.months.length}
                  </Badge>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && <tr><td colSpan={data.months.length + 6} className="text-center py-6 text-slate-500">No products match.</td></tr>}
          </tbody>
          <tfoot>
            <tr style={{ background:"#0A0A0A", color:"white", fontWeight:"bold" }}>
              <td style={{ position:"sticky", left:0, background:"#0A0A0A", color:"white" }} colSpan={2} className="uppercase text-xs tracking-wider py-2 px-4">Total (all products)</td>
              {data.months.map((ym) => (
                <td key={ym} className="mono text-right py-2 px-4">{fmt(data[colTotalKey][ym] || 0)}</td>
              ))}
              <td className="mono text-right py-2 px-4">{fmt(data[metric === "gp" ? "grand_gp" : metric === "qty" ? "grand_qty" : "grand_total"])}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
        {filteredRows.length > 200 && <div className="p-3 text-xs text-slate-500 text-center">Showing first 200 of {filteredRows.length} products. Use search / filters to narrow down.</div>}
      </div>
    </div>
  );
}
