import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, KpiCard, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import ExportBar from "../components/ExportBar";
import DatasetSelector from "../components/DatasetSelector";
import { Crown, Target as TargetIcon, TrendingUp, Users, ShoppingCart, PieChart, AlertTriangle } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function CeoDashboardPage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active"); // active | all
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const params = scope === "all" ? { dataset_id: "all" } : {};
    api.get("/analytics/executive/ceo", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id, scope]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see CEO dashboard." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const k = data.kpis;
  const tickFmt = (v) => v >= 1e7 ? `${(v/1e7).toFixed(0)}Cr` : v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v;
  const scopeParam = scope === "all" ? "?dataset_id=all" : "";

  return (
    <div className="space-y-8">
      <SectionTitle sub="Executive summary across revenue, GP, growth and risk" action={
        <div className="flex gap-2">
          <DatasetSelector scope={scope} setScope={setScope} />
          <ExportBar pdfUrl={`/reports/ceo.pdf${scopeParam}`} filename="ceo_dashboard.pdf" testid="export-ceo" />
        </div>
      }>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[#002FA7]" /> CEO Dashboard
        </div>
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard testid="ceo-kpi-sales" label="Total Sales" value={fmtINR(k.total_sales)} icon={TrendingUp} trend={k.mom_growth_pct ?? undefined} sub="vs previous month" />
        <KpiCard testid="ceo-kpi-gp" label="Total GP" value={fmtINR(k.total_gp)} icon={PieChart} sub={`${k.gp_pct}% margin`} />
        <KpiCard testid="ceo-kpi-orders" label="Orders" value={fmtNum(k.orders)} icon={ShoppingCart} sub={`AOV ${fmtINR(k.avg_order_value)}`} />
        <KpiCard testid="ceo-kpi-customers" label="Active Customers" value={fmtNum(k.active_customers)} icon={Users} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard testid="ceo-kpi-target" label="Total Target" value={k.total_target ? fmtINR(k.total_target) : "—"} icon={TargetIcon} sub={k.target_achievement_pct ? `${k.target_achievement_pct}% achieved` : "no target set"} />
        <KpiCard testid="ceo-kpi-mom" label="MoM Growth" value={k.mom_growth_pct != null ? `${k.mom_growth_pct}%` : "—"} icon={TrendingUp} />
        <KpiCard testid="ceo-kpi-concentration" label="Top-10 Concentration" value={`${k.top10_concentration_pct}%`} icon={AlertTriangle} sub="revenue share of top 10" />
      </div>

      <div className="sharp-card p-5" data-testid="ceo-monthly-chart">
        <div className="kbd-label">Monthly Revenue</div>
        <div className="text-lg font-black tracking-tight mt-1 mb-4">Trend</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} />
              <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }} />
              <Bar dataKey="sales" fill="#002FA7" />
              <Bar dataKey="gp" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5" data-testid="ceo-top-customers">
          <div className="kbd-label">Top 10 Customers</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-4">Revenue Leaders</div>
          <table className="dense-table w-full">
            <thead>
              <tr><th>#</th><th>Customer</th><th className="text-right">Sales</th><th className="text-right">Contri %</th></tr>
            </thead>
            <tbody>
              {data.top_customers.map((c, i) => (
                <tr key={c.customer}>
                  <td className="mono">{i + 1}</td>
                  <td className="font-bold text-xs">{c.customer}</td>
                  <td className="mono text-right">{fmtINR(c.sales)}</td>
                  <td className="mono text-right">{fmtPct(c.contribution_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sharp-card p-5" data-testid="ceo-top-salespersons">
          <div className="kbd-label">Top 5 Salespersons</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-4">Team Leaderboard</div>
          <table className="dense-table w-full">
            <thead>
              <tr><th>Name</th><th className="text-right">Sales</th><th className="text-right">GP</th><th className="text-right">Target</th></tr>
            </thead>
            <tbody>
              {data.top_salespersons.map((s) => (
                <tr key={s.salesperson}>
                  <td className="font-bold text-xs">{s.salesperson}</td>
                  <td className="mono text-right">{fmtINR(s.sales)}</td>
                  <td className="mono text-right">{fmtINR(s.gp)}</td>
                  <td className="text-right">
                    {s.target ? <Badge variant={s.achievement_pct >= 100 ? "success" : s.achievement_pct >= 80 ? "warning" : "danger"}>{s.achievement_pct.toFixed(0)}%</Badge> : <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5 border-l-4 border-emerald-600">
          <div className="kbd-label text-emerald-700">Highest Growth</div>
          {data.growth_highest ? (
            <>
              <div className="text-xl font-black mt-1">{data.growth_highest.customer}</div>
              <div className="mono text-sm mt-1">{fmtINR(data.growth_highest.previous)} → {fmtINR(data.growth_highest.current)}</div>
              <div className="mt-1 text-emerald-700 font-black text-2xl">+{data.growth_highest.growth_pct.toFixed(1)}%</div>
            </>
          ) : <div className="text-sm text-slate-500 mt-2">No data</div>}
        </div>
        <div className="sharp-card p-5 border-l-4 border-red-600">
          <div className="kbd-label text-red-700">Highest Decline</div>
          {data.decline_highest ? (
            <>
              <div className="text-xl font-black mt-1">{data.decline_highest.customer}</div>
              <div className="mono text-sm mt-1">{fmtINR(data.decline_highest.previous)} → {fmtINR(data.decline_highest.current)}</div>
              <div className="mt-1 text-red-700 font-black text-2xl">{data.decline_highest.growth_pct.toFixed(1)}%</div>
            </>
          ) : <div className="text-sm text-slate-500 mt-2">No data</div>}
        </div>
      </div>

      {data.forecast && (
        <div className="sharp-card p-5 border-l-4 border-[#002FA7]" data-testid="ceo-forecast">
          <div className="kbd-label">Month-end Forecast — {data.forecast.month}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
            <div><div className="kbd-label">Actual so far</div><div className="text-xl font-black mono">{fmtINR(data.forecast.actual_so_far)}</div></div>
            <div><div className="kbd-label">Days passed</div><div className="text-xl font-black mono">{data.forecast.days_passed}/{data.forecast.total_days}</div></div>
            <div><div className="kbd-label">Projected</div><div className="text-xl font-black mono text-[#002FA7]">{fmtINR(data.forecast.projected)}</div></div>
            <div><div className="kbd-label">Daily run-rate</div><div className="text-xl font-black mono">{fmtINR(data.forecast.actual_so_far / Math.max(1, data.forecast.days_passed))}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
