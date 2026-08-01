import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, KpiCard, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import ExportBar from "../components/ExportBar";
import DatasetSelector from "../components/DatasetSelector";
import { Compass, TrendingUp, TrendingDown, UserPlus, UserX } from "lucide-react";

export default function SalesDirectorDashboardPage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const params = scope === "all" ? { dataset_id: "all" } : {};
    api.get("/analytics/executive/sales_director", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id, scope]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see Sales Director dashboard." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const p = data.pipeline;
  const scopeParam = scope === "all" ? "?dataset_id=all" : "";

  return (
    <div className="space-y-8">
      <SectionTitle sub="Growth, pipeline and team performance" action={
        <div className="flex gap-2">
          <DatasetSelector scope={scope} setScope={setScope} />
          <ExportBar pdfUrl={`/reports/sales_director.pdf${scopeParam}`} filename="sales_director.pdf" testid="export-sd" />
        </div>
      }>
        <div className="flex items-center gap-2"><Compass className="w-5 h-5 text-[#002FA7]" /> Sales Director Dashboard</div>
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard testid="sd-kpi-lm-sales" label="Last Month Sales" value={fmtINR(p.last_month_sales)} icon={TrendingUp} />
        <KpiCard testid="sd-kpi-lm-gp" label="Last Month GP" value={fmtINR(p.last_month_gp)} icon={TrendingUp} />
        <KpiCard testid="sd-kpi-lm-orders" label="Last Month Orders" value={fmtNum(p.last_month_orders)} />
        <KpiCard testid="sd-kpi-churn" label="Net Customer Δ" value={`${data.new_customers.length - data.lost_customers.length}`} sub={`${data.new_customers.length} new / ${data.lost_customers.length} lost`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5" data-testid="sd-growth-leaders">
          <div className="kbd-label flex items-center gap-1 text-emerald-700"><TrendingUp className="w-3 h-3" /> Growth Leaders</div>
          <div className="mt-3 space-y-2">
            {data.customer_growth_leaders.slice(0, 8).map((g) => (
              <div key={g.customer} className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <div className="text-xs font-bold truncate flex-1">{g.customer}</div>
                <div className="mono text-xs text-emerald-700 font-black ml-2">+{g.growth_pct.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="sharp-card p-5" data-testid="sd-decliners">
          <div className="kbd-label flex items-center gap-1 text-red-700"><TrendingDown className="w-3 h-3" /> Decliners</div>
          <div className="mt-3 space-y-2">
            {data.customer_declines.slice(0, 8).map((g) => (
              <div key={g.customer} className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <div className="text-xs font-bold truncate flex-1">{g.customer}</div>
                <div className="mono text-xs text-red-700 font-black ml-2">{g.growth_pct.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5" data-testid="sd-new-customers">
          <div className="kbd-label flex items-center gap-1 text-emerald-700"><UserPlus className="w-3 h-3" /> New Customers ({data.new_customers.length})</div>
          <div className="mt-3 max-h-56 overflow-y-auto scrollbar-thin space-y-1">
            {data.new_customers.length === 0 && <div className="text-xs text-slate-500">None</div>}
            {data.new_customers.map((c) => (
              <div key={c} className="text-xs font-bold border border-emerald-200 bg-emerald-50 px-2 py-1">{c}</div>
            ))}
          </div>
        </div>
        <div className="sharp-card p-5" data-testid="sd-lost-customers">
          <div className="kbd-label flex items-center gap-1 text-red-700"><UserX className="w-3 h-3" /> Lost Customers ({data.lost_customers.length})</div>
          <div className="mt-3 max-h-56 overflow-y-auto scrollbar-thin space-y-1">
            {data.lost_customers.length === 0 && <div className="text-xs text-slate-500">None</div>}
            {data.lost_customers.map((c) => (
              <div key={c} className="text-xs font-bold border border-red-200 bg-red-50 px-2 py-1">{c}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="sharp-card p-5" data-testid="sd-top-salespersons">
        <div className="kbd-label">Top Salespersons</div>
        <div className="overflow-x-auto scrollbar-thin mt-3">
          <table className="dense-table w-full">
            <thead>
              <tr><th>Salesperson</th><th className="text-right">Sales</th><th className="text-right">GP</th><th className="text-right">Customers</th><th className="text-right">Orders</th><th className="text-right">Target Ach</th></tr>
            </thead>
            <tbody>
              {data.top_salespersons.map((s) => (
                <tr key={s.salesperson}>
                  <td className="font-bold">{s.salesperson}</td>
                  <td className="mono text-right">{fmtINR(s.sales)}</td>
                  <td className="mono text-right">{fmtINR(s.gp)}</td>
                  <td className="mono text-right">{s.customers}</td>
                  <td className="mono text-right">{s.orders}</td>
                  <td className="text-right">{s.target ? <Badge variant={s.achievement_pct >= 100 ? "success" : "warning"}>{s.achievement_pct.toFixed(0)}%</Badge> : <span className="text-xs text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5" data-testid="sd-top-products">
          <div className="kbd-label">Top Products</div>
          <table className="dense-table w-full mt-3">
            <thead><tr><th>Product</th><th className="text-right">Sales</th><th className="text-right">GP%</th></tr></thead>
            <tbody>
              {data.top_products.map((p2) => (
                <tr key={p2.product}><td className="font-bold text-xs">{p2.product}</td><td className="mono text-right">{fmtINR(p2.sales)}</td><td className="mono text-right">{fmtPct(p2.gp_pct)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sharp-card p-5" data-testid="sd-country-ranking">
          <div className="kbd-label">Country Ranking</div>
          <table className="dense-table w-full mt-3">
            <thead><tr><th>Country</th><th className="text-right">Sales</th><th className="text-right">Cust.</th><th className="text-right">Contri</th></tr></thead>
            <tbody>
              {data.country_ranking.map((c) => (
                <tr key={c.country}><td className="font-bold text-xs">{c.country}</td><td className="mono text-right">{fmtINR(c.sales)}</td><td className="mono text-right">{c.customers}</td><td className="mono text-right">{fmtPct(c.contribution_pct)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
