import React, { useEffect, useState, useMemo } from "react";
import api from "../lib/api";
import { SectionTitle, EmptyState, Badge, KpiCard } from "../components/Primitives";
import { fmtINR, fmtNum } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import DatasetSelector from "../components/DatasetSelector";
import ExportBar from "../components/ExportBar";
import { CustomerLink } from "../components/CustomerDrawerContext";
import { ArrowLeftRight, TrendingUp, TrendingDown, Sparkles, XCircle, Search } from "lucide-react";

const STATUS_STYLES = {
  new: { color: "text-emerald-700 bg-emerald-50 border-emerald-300", label: "NEW" },
  lost: { color: "text-red-700 bg-red-50 border-red-300", label: "LOST" },
  surged: { color: "text-emerald-700 bg-emerald-50 border-emerald-300", label: "SURGED" },
  dropped: { color: "text-red-700 bg-red-50 border-red-300", label: "DROPPED" },
  stable: { color: "text-slate-600 bg-slate-50 border-slate-200", label: "STABLE" },
};

export default function MonthComparePage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active");
  const [monthA, setMonthA] = useState("");
  const [monthB, setMonthB] = useState("");
  const [availableMonths, setAvailableMonths] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState("customer"); // customer | product
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Fetch available months on first load using a dummy call to fetch months only
  useEffect(() => {
    if (!active) return;
    const params = scope === "all" ? { dataset_id: "all" } : {};
    // We use customer-month-pivot to get available months quickly
    api.get("/analytics/customer-month-pivot", { params }).then((r) => {
      const months = r.data.months || [];
      setAvailableMonths(months);
      if (months.length >= 2) {
        setMonthA(months[months.length - 2]);
        setMonthB(months[months.length - 1]);
      } else if (months.length === 1) {
        setMonthA(months[0]);
        setMonthB(months[0]);
      }
    });
  }, [active?.id, scope]);

  useEffect(() => {
    if (!active || !monthA || !monthB) return;
    setLoading(true);
    const params = { month_a: monthA, month_b: monthB };
    if (scope === "all") params.dataset_id = "all";
    api.get("/analytics/month-compare", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id, scope, monthA, monthB]);

  const rows = data ? (entity === "customer" ? data.customers : data.products) : [];
  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((x) => (x[entity] || "").toLowerCase().includes(s) || (x.country || "").toLowerCase().includes(s));
    }
    return r;
  }, [rows, statusFilter, search, entity]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to compare months." />;
  if (availableMonths.length < 2) return <EmptyState title="Need 2+ months of data" description="Upload data spanning at least two months to compare." />;

  return (
    <div className="space-y-8">
      <SectionTitle sub="Side-by-side month comparison with growth arrows" action={
        <div className="flex gap-2">
          <DatasetSelector scope={scope} setScope={setScope} />
          <ExportBar xlsxUrl={monthA && monthB ? `/reports/month_compare.xlsx?month_a=${monthA}&month_b=${monthB}${scope === "all" ? "&dataset_id=all" : ""}` : null} filename={`month_compare_${monthA}_vs_${monthB}.xlsx`} testid="export-compare" />
        </div>
      }>
        <div className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-[#002FA7]" /> Compare Two Months</div>
      </SectionTitle>

      <div className="sharp-card p-4 flex flex-wrap items-end gap-3" data-testid="compare-controls">
        <div>
          <div className="kbd-label mb-1">Month A (baseline)</div>
          <select value={monthA} onChange={(e) => setMonthA(e.target.value)} className="border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#002FA7]" data-testid="compare-month-a">
            {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="text-2xl text-slate-400 pb-1">→</div>
        <div>
          <div className="kbd-label mb-1">Month B (comparison)</div>
          <select value={monthB} onChange={(e) => setMonthB(e.target.value)} className="border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#002FA7]" data-testid="compare-month-b">
            {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <div>
            <div className="kbd-label mb-1">Compare by</div>
            <div className="inline-flex border border-slate-300">
              {[["customer", "Customers"], ["product", "Products"]].map(([k, l]) => (
                <button key={k} onClick={() => setEntity(k)}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${entity === k ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                  data-testid={`compare-entity-${k}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading || !data ? (
        <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading comparison...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard testid="cmp-total-a" label={`${monthA} Total`} value={fmtINR(data.summary.total_a)} />
            <KpiCard testid="cmp-total-b" label={`${monthB} Total`} value={fmtINR(data.summary.total_b)}
              trend={data.summary.growth_pct} sub="MoM change" />
            <KpiCard testid="cmp-delta" label="Δ Change" value={fmtINR(data.summary.delta)} sub={data.summary.delta >= 0 ? "growth" : "decline"} />
            <KpiCard testid="cmp-growth" label="Growth %" value={data.summary.growth_pct == null ? "—" : `${data.summary.growth_pct}%`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="status-cards">
            {[
              { key: "new", icon: Sparkles, label: "New" },
              { key: "surged", icon: TrendingUp, label: "Surged ≥20%" },
              { key: "stable", icon: ArrowLeftRight, label: "Stable" },
              { key: "dropped", icon: TrendingDown, label: "Dropped ≥20%" },
              { key: "lost", icon: XCircle, label: "Lost" },
            ].map((c) => (
              <button key={c.key} onClick={() => setStatusFilter(c.key === statusFilter ? "all" : c.key)}
                className={`sharp-card p-3 text-left border-2 ${statusFilter === c.key ? "border-slate-900" : "border-transparent"}`}
                data-testid={`compare-status-${c.key}`}>
                <div className="flex items-center gap-2">
                  <c.icon className="w-4 h-4 text-slate-600" />
                  <div className="kbd-label">{c.label}</div>
                </div>
                <div className="text-2xl font-black mono mt-1">{data.customer_status_counts[c.key] || 0}</div>
              </button>
            ))}
          </div>

          <div className="sharp-card p-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex border border-slate-300">
              {["all", "new", "surged", "dropped", "lost", "stable"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${statusFilter === s ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                  data-testid={`compare-filter-${s}`}>{s === "all" ? "All" : s}</button>
              ))}
            </div>
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                  className="border border-slate-300 pl-7 pr-3 py-1.5 text-xs w-full focus:outline-none focus:border-[#002FA7]" data-testid="compare-search" />
              </div>
            </div>
          </div>

          <div className="sharp-card overflow-x-auto scrollbar-thin">
            <table className="dense-table w-full" data-testid="compare-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{entity === "customer" ? "Customer" : "Product"}</th>
                  <th>{entity === "customer" ? "Country" : "Category"}</th>
                  <th className="text-right">{monthA}</th>
                  <th className="text-right">{monthB}</th>
                  <th className="text-right">Δ Change</th>
                  <th className="text-right">Growth %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((r, i) => {
                  const st = STATUS_STYLES[r.status] || STATUS_STYLES.stable;
                  return (
                    <tr key={r[entity]}>
                      <td className="mono text-slate-500">{i + 1}</td>
                      <td className="font-bold text-xs">{entity === "customer" ? <CustomerLink name={r[entity]} /> : r[entity]}</td>
                      <td className="text-xs">{entity === "customer" ? (r.country || "—") : (r.category || "—")}</td>
                      <td className="mono text-right">{fmtINR(r.sales_a)}</td>
                      <td className="mono text-right">{fmtINR(r.sales_b)}</td>
                      <td className={`mono text-right font-bold ${r.delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {r.delta >= 0 ? "▲" : "▼"} {fmtINR(Math.abs(r.delta))}
                      </td>
                      <td className={`mono text-right font-black ${r.growth_pct == null ? "text-slate-400" : r.growth_pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {r.growth_pct == null ? "—" : `${r.growth_pct.toFixed(1)}%`}
                      </td>
                      <td>
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-black tracking-wider border ${st.color}`}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-slate-500">No {entity}s match this filter.</td></tr>}
              </tbody>
            </table>
            {filtered.length > 300 && <div className="p-3 text-xs text-slate-500 text-center">Showing first 300 of {filtered.length}. Use filters to narrow down.</div>}
          </div>
        </>
      )}
    </div>
  );
}
