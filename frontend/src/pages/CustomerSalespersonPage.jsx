import React, { useEffect, useState, useMemo } from "react";
import api from "../lib/api";
import { SectionTitle, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtPct } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import DatasetSelector from "../components/DatasetSelector";
import ExportBar from "../components/ExportBar";
import { CustomerLink } from "../components/CustomerDrawerContext";
import { UsersRound, Search } from "lucide-react";

export default function CustomerSalespersonPage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const params = scope === "all" ? { dataset_id: "all" } : {};
    api.get("/analytics/customer-salesperson-pivot", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id, scope]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) =>
      (!search || r.customer.toLowerCase().includes(search.toLowerCase()) || (r.country || "").toLowerCase().includes(search.toLowerCase()))
      && (!ownerFilter || r.owner === ownerFilter)
    );
  }, [data, search, ownerFilter]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see the customer × salesperson grid." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  return (
    <div className="space-y-8">
      <SectionTitle sub={`${data.customers} customers × ${data.salespersons.length} salespersons  ·  Grand ${fmtINR(data.grand_total)}`} action={
        <div className="flex gap-2">
          <DatasetSelector scope={scope} setScope={setScope} />
          <ExportBar xlsxUrl={`/reports/customer_salesperson_pivot.xlsx${scope === "all" ? "?dataset_id=all" : ""}`} filename="customer_salesperson_pivot.xlsx" testid="export-cs" />
        </div>
      }>
        <div className="flex items-center gap-2"><UsersRound className="w-5 h-5 text-[#002FA7]" /> Customer × Salesperson Grid</div>
      </SectionTitle>

      <div className="sharp-card p-4 flex flex-wrap items-center gap-3">
        <div>
          <div className="kbd-label mb-1">Owner (Primary SP)</div>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-[#002FA7]" data-testid="cs-owner-filter">
            <option value="">All owners</option>
            {data.salespersons.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="kbd-label mb-1">Search</div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer or country..."
              className="border border-slate-300 pl-7 pr-3 py-1.5 text-xs w-full focus:outline-none focus:border-[#002FA7]" data-testid="cs-search" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.salespersons.map((sp) => (
          <div key={sp} className="sharp-card p-4" data-testid={`sp-summary-${sp}`}>
            <div className="kbd-label truncate">{sp}</div>
            <div className="text-2xl font-black mono mt-1">{fmtINR(data.col_totals[sp] || 0)}</div>
            <div className="text-xs text-slate-500 mt-1">{data.col_customer_counts[sp] || 0} customers</div>
          </div>
        ))}
      </div>

      <div className="sharp-card overflow-x-auto scrollbar-thin">
        <table className="dense-table w-full" data-testid="cust-sp-table">
          <thead>
            <tr>
              <th style={{ position:"sticky", left:0, background:"#F8FAFC", zIndex:2 }}>Customer</th>
              <th>Country</th>
              <th>Owner</th>
              <th className="text-right">Shared</th>
              {data.salespersons.map((sp) => <th key={sp} className="text-right text-[10px]">{sp}</th>)}
              <th className="text-right">Total</th>
              <th className="text-right">Contri %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((r, i) => (
              <tr key={r.customer}>
                <td className="font-bold text-xs" style={{ position:"sticky", left:0, background:"white", zIndex:1 }}>
                  <span className="text-slate-400 mono mr-2">{i + 1}</span><CustomerLink name={r.customer} />
                </td>
                <td className="text-xs">{r.country || "—"}</td>
                <td className="text-xs font-bold">{r.owner}</td>
                <td className="mono text-right">
                  <Badge variant={r.shared_by === 1 ? "success" : r.shared_by > 1 ? "warning" : "default"}>{r.shared_by}</Badge>
                </td>
                {data.salespersons.map((sp) => {
                  const v = r.cells[sp] || 0;
                  const isOwner = r.owner === sp && v > 0;
                  return (
                    <td key={sp} className={`mono text-right ${v === 0 ? "text-slate-300" : ""} ${isOwner ? "bg-blue-50 font-black" : ""}`}>
                      {v === 0 ? "—" : fmtINR(v)}
                    </td>
                  );
                })}
                <td className="mono text-right font-black">{fmtINR(r.total_sales)}</td>
                <td className="mono text-right">{fmtPct(r.contribution_pct)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={data.salespersons.length + 6} className="text-center py-6 text-slate-500">No matches.</td></tr>}
          </tbody>
          <tfoot>
            <tr style={{ background:"#0A0A0A", color:"white", fontWeight:"bold" }}>
              <td style={{ position:"sticky", left:0, background:"#0A0A0A", color:"white" }} colSpan={4} className="uppercase text-xs tracking-wider py-2 px-4">SP Totals</td>
              {data.salespersons.map((sp) => (
                <td key={sp} className="mono text-right py-2 px-4">{fmtINR(data.col_totals[sp] || 0)}</td>
              ))}
              <td className="mono text-right py-2 px-4">{fmtINR(data.grand_total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        {filtered.length > 300 && <div className="p-3 text-xs text-slate-500 text-center">Showing first 300 of {filtered.length}. Use filters to narrow down.</div>}
      </div>
    </div>
  );
}
