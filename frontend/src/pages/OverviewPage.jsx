import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, TrendingUp, Users, Package, ShoppingCart, Percent, Bell, ArrowUpRight, ArrowDownRight } from "lucide-react";
import api from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import { KpiCard, SectionTitle, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";

export default function OverviewPage() {
  const { active } = useDatasets();
  const [ov, setOv] = useState(null);
  const [cust, setCust] = useState(null);
  const [trends, setTrends] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/customers"),
      api.get("/analytics/trends"),
      api.get("/analytics/alerts"),
    ])
      .then(([o, c, t, a]) => {
        setOv(o.data); setCust(c.data); setTrends(t.data); setAlerts(a.data.alerts || []);
      })
      .finally(() => setLoading(false));
  }, [active?.id]);

  if (!active) {
    return (
      <div>
        <SectionTitle sub="Sales Intelligence">Overview</SectionTitle>
        <EmptyState
          title="No dataset loaded"
          description="Upload your monthly Outward Excel to begin analysis. The system auto-detects columns and builds dashboards instantly."
          action={
            <button onClick={() => nav("/upload")} className="bg-[#002FA7] hover:bg-[#00227A] text-white px-5 py-2.5 text-sm font-black uppercase tracking-wider" data-testid="upload-cta">
              Upload Excel →
            </button>
          }
        />
      </div>
    );
  }

  if (loading || !ov) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const monthly = trends?.monthly || [];
  const lastM = monthly[monthly.length - 1];
  const prevM = monthly[monthly.length - 2];
  const moTrend = lastM && prevM && prevM.sales ? ((lastM.sales - prevM.sales) / prevM.sales) * 100 : null;

  return (
    <div className="space-y-8">
      <SectionTitle sub={`Dataset: ${active.name}`}>Overview</SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard testid="kpi-total-sales" label="Total Sales" value={fmtINR(ov.total_sales)} icon={DollarSign} trend={moTrend} sub="vs previous month" />
        <KpiCard testid="kpi-total-gp" label="Total GP" value={fmtINR(ov.total_gp)} icon={TrendingUp} sub={`${ov.gp_pct}% margin`} />
        <KpiCard testid="kpi-orders" label="Orders" value={fmtNum(ov.orders)} icon={ShoppingCart} sub={`AOV ${fmtINR(ov.avg_order_value)}`} />
        <KpiCard testid="kpi-customers" label="Active Customers" value={fmtNum(ov.active_customers)} icon={Users} sub={`${ov.active_products} products`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 sharp-card p-5" data-testid="monthly-trend-chart">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="kbd-label">Monthly Sales Trend</div>
              <div className="text-lg font-black tracking-tight mt-1">Revenue Run-rate</div>
            </div>
            <Badge variant="info">{monthly.length} months</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" tickFormatter={(v) => v >= 1e7 ? `${(v/1e7).toFixed(0)}Cr` : v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v} />
                <Tooltip
                  formatter={(v) => fmtINR(v)}
                  contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }}
                />
                <Bar dataKey="sales" fill="#002FA7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sharp-card p-5" data-testid="top-customers-mini">
          <div className="kbd-label">Top 5 Customers</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-4">By Sales</div>
          <div className="space-y-3">
            {(cust?.top20 || []).slice(0, 5).map((c, i) => (
              <div key={c.customer} className="flex items-center gap-3">
                <div className="w-6 h-6 bg-slate-900 text-white text-xs font-black flex items-center justify-center mono">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{c.customer}</div>
                  <div className="text-[11px] text-slate-500 mono">{fmtINR(c.sales)} · {c.contribution_pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5" data-testid="growth-leaders">
          <div className="kbd-label">Customer Growth Leaders</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-4">Month-on-Month Movers</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Top Risers</div>
              {(cust?.growth || []).slice(0, 5).map((g) => (
                <div key={g.customer} className="py-1.5 border-b border-slate-100 last:border-0">
                  <div className="text-xs font-bold truncate">{g.customer}</div>
                  <div className="text-[11px] mono text-emerald-700">+{g.growth_pct.toFixed(1)}%</div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-2 flex items-center gap-1"><ArrowDownRight className="w-3 h-3" /> Top Decliners</div>
              {(cust?.growth || []).slice(-5).reverse().map((g) => (
                <div key={g.customer} className="py-1.5 border-b border-slate-100 last:border-0">
                  <div className="text-xs font-bold truncate">{g.customer}</div>
                  <div className="text-[11px] mono text-red-700">{g.growth_pct.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sharp-card p-5" data-testid="alerts-preview">
          <div className="flex justify-between items-start">
            <div>
              <div className="kbd-label">Smart Alerts</div>
              <div className="text-lg font-black tracking-tight mt-1">Things that need attention</div>
            </div>
            <Badge variant="danger">{alerts.length}</Badge>
          </div>
          <div className="mt-4 space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
            {alerts.slice(0, 8).map((a, i) => (
              <div key={i} className={`border-l-4 ${a.severity === "critical" ? "border-red-600" : a.severity === "warning" ? "border-amber-500" : "border-blue-500"} bg-slate-50 p-3 flex items-start gap-2`}>
                <Bell className={`w-4 h-4 flex-shrink-0 ${a.severity === "critical" ? "text-red-600" : a.severity === "warning" ? "text-amber-600" : "text-blue-600"}`} />
                <div>
                  <div className="text-xs font-bold">{a.title}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{a.description}</div>
                </div>
              </div>
            ))}
            {alerts.length === 0 && <div className="text-xs text-slate-500 py-6 text-center">No active alerts.</div>}
          </div>
          <button onClick={() => nav("/alerts")} className="mt-4 text-xs font-black uppercase tracking-wider text-[#002FA7] hover:underline">View all alerts →</button>
        </div>
      </div>
    </div>
  );
}
