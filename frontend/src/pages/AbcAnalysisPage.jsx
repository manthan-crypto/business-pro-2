import React, { useEffect, useState, useMemo } from "react";
import api from "../lib/api";
import { SectionTitle, EmptyState, Badge, KpiCard } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import DatasetSelector from "../components/DatasetSelector";
import ExportBar from "../components/ExportBar";
import { CustomerLink } from "../components/CustomerDrawerContext";
import { Award, Search } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";

const TIER_STYLES = {
  A: { bg: "bg-emerald-50", border: "border-emerald-600", pill: "success", label: "A · Top 80% revenue", color: "#059669" },
  B: { bg: "bg-amber-50", border: "border-amber-500", pill: "warning", label: "B · Next 15%", color: "#D97706" },
  C: { bg: "bg-slate-50", border: "border-slate-400", pill: "default", label: "C · Last 5%", color: "#64748B" },
};

export default function AbcAnalysisPage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const params = scope === "all" ? { dataset_id: "all" } : {};
    api.get("/analytics/abc", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id, scope]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) =>
      (tier === "all" || r.tier === tier)
      && (!search || r.customer.toLowerCase().includes(search.toLowerCase()) || (r.country || "").toLowerCase().includes(search.toLowerCase()))
    );
  }, [data, tier, search]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to run ABC analysis." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const paretoData = data.rows.map((r, i) => ({ idx: i + 1, cumulative: r.cumulative_pct, sales: r.sales }));

  return (
    <div className="space-y-8">
      <SectionTitle sub={`Pareto tiering — ${data.total_customers} customers · ${fmtINR(data.total_sales)}`} action={
        <div className="flex gap-2">
          <DatasetSelector scope={scope} setScope={setScope} />
          <ExportBar xlsxUrl={`/reports/abc.xlsx${scope === "all" ? "?dataset_id=all" : ""}`} filename="abc_analysis.xlsx" testid="export-abc" />
        </div>
      }>
        <div className="flex items-center gap-2"><Award className="w-5 h-5 text-[#002FA7]" /> ABC Customer Analysis</div>
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["A", "B", "C"].map((t) => {
          const ts = data.tiers[t];
          const s = TIER_STYLES[t];
          return (
            <div key={t} className={`sharp-card p-5 border-l-4 ${s.border}`} data-testid={`tier-card-${t}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className={`inline-block px-2 py-0.5 text-xs font-black tracking-wider text-white rounded-sm`} style={{ background: s.color }}>{t}</div>
                  <div className="kbd-label mt-2">{s.label}</div>
                </div>
                <div className="text-3xl font-black mono">{ts.count}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div>
                  <div className="kbd-label">Sales</div>
                  <div className="font-black mono">{fmtINR(ts.sales)}</div>
                  <div className="text-[11px] text-slate-500 mono">{ts.sales_pct}% of revenue</div>
                </div>
                <div>
                  <div className="kbd-label">Customers</div>
                  <div className="font-black mono">{ts.customer_pct}%</div>
                  <div className="text-[11px] text-slate-500 mono">of total {data.total_customers}</div>
                </div>
                <div>
                  <div className="kbd-label">GP</div>
                  <div className="font-black mono">{fmtINR(ts.gp)}</div>
                </div>
                <div>
                  <div className="kbd-label">GP margin</div>
                  <div className="font-black mono">{ts.sales ? ((ts.gp / ts.sales) * 100).toFixed(1) : 0}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sharp-card p-5">
        <div className="kbd-label">Pareto Curve</div>
        <div className="text-lg font-black tracking-tight mt-1 mb-4">Cumulative revenue % vs. customer rank</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={paretoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="idx" tick={{ fontSize: 10 }} label={{ value: "Customer rank", position: "insideBottom", offset: -5, fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v, n) => n === "cumulative" ? `${v}%` : fmtINR(v)} contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }} />
              <Line type="monotone" dataKey="cumulative" stroke="#002FA7" strokeWidth={2} dot={false} name="Cumulative %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="sharp-card p-4 flex flex-wrap items-center gap-3">
        <div>
          <div className="kbd-label mb-1">Filter tier</div>
          <div className="inline-flex border border-slate-300">
            {["all", "A", "B", "C"].map((t) => (
              <button key={t} onClick={() => setTier(t)} className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${tier === t ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`} data-testid={`abc-tier-${t}`}>
                {t === "all" ? "All" : `Tier ${t}`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="kbd-label mb-1">Search</div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer or country..."
              className="border border-slate-300 pl-7 pr-3 py-1.5 text-xs w-full focus:outline-none focus:border-[#002FA7]" data-testid="abc-search" />
          </div>
        </div>
      </div>

      <div className="sharp-card overflow-x-auto scrollbar-thin">
        <table className="dense-table w-full" data-testid="abc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Country</th>
              <th>Salesperson</th>
              <th className="text-right">Sales</th>
              <th className="text-right">GP</th>
              <th className="text-right">GP %</th>
              <th className="text-right">Orders</th>
              <th className="text-right">Contri %</th>
              <th className="text-right">Cum %</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.customer} className={TIER_STYLES[r.tier].bg}>
                <td className="mono text-slate-500">{i + 1}</td>
                <td className="font-bold text-xs"><CustomerLink name={r.customer} /></td>
                <td className="text-xs">{r.country || "—"}</td>
                <td className="text-xs">{r.salesperson || "—"}</td>
                <td className="mono text-right">{fmtINR(r.sales)}</td>
                <td className="mono text-right">{fmtINR(r.gp)}</td>
                <td className="mono text-right">{fmtPct(r.gp_pct)}</td>
                <td className="mono text-right">{fmtNum(r.orders)}</td>
                <td className="mono text-right">{fmtPct(r.contribution_pct)}</td>
                <td className="mono text-right font-bold">{fmtPct(r.cumulative_pct)}</td>
                <td>
                  <span className="inline-block px-2 py-0.5 text-[10px] font-black text-white rounded-sm" style={{ background: TIER_STYLES[r.tier].color }}>{r.tier}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
