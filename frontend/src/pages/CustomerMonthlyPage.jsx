import React, { useEffect, useState, useMemo } from "react";
import api from "../lib/api";
import { SectionTitle, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtPct } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import ExportBar from "../components/ExportBar";
import DatasetSelector from "../components/DatasetSelector";
import { CustomerLink } from "../components/CustomerDrawerContext";
import { CalendarRange, Search } from "lucide-react";

const MONTH_LABEL = { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec" };

export default function CustomerMonthlyPage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active");
  const [fy, setFy] = useState(""); // "" = all FYs
  const [metric, setMetric] = useState("sales"); // sales | gp
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("total_sales");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const params = {};
    if (scope === "all") params.dataset_id = "all";
    if (fy) params.fy = parseInt(fy);
    api.get("/analytics/customer-month-pivot", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id, scope, fy]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = search
      ? data.rows.filter((r) => r.customer.toLowerCase().includes(search.toLowerCase())
        || (r.country || "").toLowerCase().includes(search.toLowerCase())
        || (r.salesperson || "").toLowerCase().includes(search.toLowerCase()))
      : [...data.rows];
    rows.sort((a, b) => {
      let va, vb;
      if (sortKey.startsWith("m:")) {
        const ym = sortKey.slice(2);
        va = (metric === "gp" ? a.months_gp[ym] : a.months[ym]) || 0;
        vb = (metric === "gp" ? b.months_gp[ym] : b.months[ym]) || 0;
      } else {
        va = a[sortKey] ?? 0; vb = b[sortKey] ?? 0;
      }
      if (typeof va === "string") { return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va); }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return rows;
  }, [data, search, sortKey, sortDir, metric]);

  const clickSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  if (!active) return <EmptyState title="No dataset" description="Upload data to see monthly customer analysis." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const monthCol = (ym) => {
    const [y, m] = ym.split("-");
    return `${MONTH_LABEL[m]} '${y.slice(2)}`;
  };
  const scopeParam = scope === "all" ? "&dataset_id=all" : "";
  const fyParam = fy ? `&fy=${fy}` : "";
  const cellKey = metric === "gp" ? "months_gp" : "months";
  const colTotalKey = metric === "gp" ? "col_totals_gp" : "col_totals";
  const totalCol = metric === "gp" ? "total_gp" : "total_sales";

  return (
    <div className="space-y-8">
      <SectionTitle sub={`${data.customers} customers × ${data.months.length} months  ·  Grand total ${fmtINR(metric === "gp" ? data.grand_gp : data.grand_total)}`} action={
        <div className="flex gap-2">
          <DatasetSelector scope={scope} setScope={setScope} />
          <ExportBar xlsxUrl={`/reports/customer_month_pivot.xlsx?_=1${scopeParam}${fyParam}`} filename={`customer_month_pivot${fy ? `_fy${fy}` : ""}.xlsx`} testid="export-pivot" />
        </div>
      }>
        <div className="flex items-center gap-2"><CalendarRange className="w-5 h-5 text-[#002FA7]" /> Customer × Month Analysis</div>
      </SectionTitle>

      <div className="sharp-card p-4 flex flex-wrap items-center gap-3" data-testid="pivot-controls">
        <div>
          <div className="kbd-label mb-1">Fiscal Year</div>
          <select value={fy} onChange={(e) => setFy(e.target.value)} className="border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-[#002FA7]" data-testid="pivot-fy">
            <option value="">All FYs</option>
            {(data.available_fiscal_years || []).map((f) => <option key={f} value={f}>FY{f}-{String(f + 1).slice(-2)}</option>)}
          </select>
        </div>
        <div>
          <div className="kbd-label mb-1">Metric</div>
          <div className="inline-flex border border-slate-300">
            <button onClick={() => setMetric("sales")} className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${metric === "sales" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`} data-testid="metric-sales">Sales</button>
            <button onClick={() => setMetric("gp")} className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${metric === "gp" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`} data-testid="metric-gp">GP</button>
          </div>
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="kbd-label mb-1">Search</div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer / country / salesperson..."
              className="border border-slate-300 pl-7 pr-3 py-1.5 text-xs w-full focus:outline-none focus:border-[#002FA7]"
              data-testid="pivot-search"
            />
          </div>
        </div>
      </div>

      {data.months.length === 0 ? (
        <div className="sharp-card p-12 text-center text-sm text-slate-500">No monthly data found for this scope.</div>
      ) : (
        <div className="sharp-card overflow-x-auto scrollbar-thin">
          <table className="dense-table w-full" data-testid="pivot-table">
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: "#F8FAFC", zIndex: 2 }}>
                  <button onClick={() => clickSort("customer")} className="uppercase tracking-wider font-bold">
                    Customer {sortKey === "customer" && (sortDir === "asc" ? "▲" : "▼")}
                  </button>
                </th>
                <th>Country</th>
                <th>Salesperson</th>
                {data.months.map((ym) => (
                  <th key={ym} className="text-right cursor-pointer" onClick={() => clickSort(`m:${ym}`)}>
                    {monthCol(ym)} {sortKey === `m:${ym}` && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                ))}
                <th className="text-right cursor-pointer" onClick={() => clickSort(totalCol)}>Total {sortKey === totalCol && (sortDir === "asc" ? "▲" : "▼")}</th>
                <th className="text-right">GP %</th>
                <th className="text-right cursor-pointer" onClick={() => clickSort("active_months")}>Active Mo</th>
                <th className="text-right cursor-pointer" onClick={() => clickSort("contribution_pct")}>Contri %</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={r.customer}>
                  <td className="font-bold text-xs" style={{ position: "sticky", left: 0, background: "white", zIndex: 1 }}>
                    <span className="text-slate-400 mono mr-2">{i + 1}</span><CustomerLink name={r.customer} />
                  </td>
                  <td className="text-xs">{r.country || "—"}</td>
                  <td className="text-xs">{r.salesperson || "—"}</td>
                  {data.months.map((ym) => {
                    const v = r[cellKey][ym] || 0;
                    return (
                      <td key={ym} className={`mono text-right ${v === 0 ? "text-slate-300" : ""}`}>
                        {v === 0 ? "—" : fmtINR(v)}
                      </td>
                    );
                  })}
                  <td className="mono text-right font-black">{fmtINR(r[totalCol])}</td>
                  <td className="mono text-right">{fmtPct(r.gp_pct)}</td>
                  <td className="mono text-right">
                    <Badge variant={r.active_months === data.months.length ? "success" : r.active_months === 0 ? "danger" : "default"}>
                      {r.active_months}/{data.months.length}
                    </Badge>
                  </td>
                  <td className="mono text-right">{fmtPct(r.contribution_pct)}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && <tr><td colSpan={data.months.length + 7} className="text-center py-6 text-slate-500">No matches.</td></tr>}
            </tbody>
            <tfoot>
              <tr style={{ background: "#0A0A0A", color: "white", fontWeight: "bold" }}>
                <td style={{ position: "sticky", left: 0, background: "#0A0A0A", color: "white" }} colSpan={3} className="uppercase text-xs tracking-wider py-2 px-4">Total (all customers)</td>
                {data.months.map((ym) => (
                  <td key={ym} className="mono text-right py-2 px-4">{fmtINR(data[colTotalKey][ym] || 0)}</td>
                ))}
                <td className="mono text-right py-2 px-4">{fmtINR(metric === "gp" ? data.grand_gp : data.grand_total)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
