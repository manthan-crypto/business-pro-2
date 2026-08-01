import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, KpiCard, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import DatasetSelector from "../components/DatasetSelector";
import { Calendar, TrendingUp, TrendingDown, Target as TargetIcon } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";

export default function QuarterlyPage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFy, setActiveFy] = useState(null);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const params = scope === "all" ? { dataset_id: "all" } : {};
    api.get("/analytics/quarterly", { params }).then((r) => {
      setData(r.data);
      const fys = r.data.fiscal_years || [];
      if (fys.length) setActiveFy(fys[fys.length - 1].fiscal_year);
    }).finally(() => setLoading(false));
  }, [active?.id, scope]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see quarterly business review." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const fys = data.fiscal_years || [];
  const rows = data.quarterly_rows || [];
  const currentFy = fys.find((f) => f.fiscal_year === activeFy) || fys[fys.length - 1];
  const chartData = rows.map((r) => ({
    label: `${r.fy_label} ${r.q_label}`,
    sales: r.sales, gp: r.gp,
  }));
  const tickFmt = (v) => v >= 1e7 ? `${(v/1e7).toFixed(0)}Cr` : v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v;

  return (
    <div className="space-y-8">
      <SectionTitle sub="Fiscal quarters (Apr–Mar) with QoQ / YoY growth and target achievement" action={
        <DatasetSelector scope={scope} setScope={setScope} />
      }>
        <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-[#002FA7]" /> Quarterly Business Review</div>
      </SectionTitle>

      {fys.length === 0 ? (
        <div className="sharp-card p-12 text-center text-sm text-slate-500">No quarterly data available.</div>
      ) : (
        <>
          {/* FY tabs */}
          <div className="flex flex-wrap gap-2" data-testid="fy-tabs">
            {fys.map((f) => (
              <button
                key={f.fiscal_year}
                onClick={() => setActiveFy(f.fiscal_year)}
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider border ${activeFy === f.fiscal_year ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"}`}
                data-testid={`fy-tab-${f.fiscal_year}`}
              >
                {f.fy_label}
                <span className="ml-2 opacity-70 mono">{fmtINR(f.sales)}</span>
              </button>
            ))}
          </div>

          {currentFy && (
            <>
              {/* FY summary KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard testid="qbr-fy-sales" label={`${currentFy.fy_label} Sales`} value={fmtINR(currentFy.sales)} />
                <KpiCard testid="qbr-fy-gp" label="Total GP" value={fmtINR(currentFy.gp)} sub={`${currentFy.gp_pct}% margin`} />
                <KpiCard testid="qbr-fy-orders" label="Orders" value={fmtNum(currentFy.orders)} />
                <KpiCard testid="qbr-fy-customers" label="Active Customers" value={fmtNum(currentFy.customers)} />
                <KpiCard testid="qbr-fy-target" label="Target Achievement" value={currentFy.achievement_pct != null ? `${currentFy.achievement_pct}%` : "—"} sub={currentFy.target ? `of ${fmtINR(currentFy.target)}` : "no target"} icon={TargetIcon} />
              </div>

              {/* Quarter cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="quarter-cards">
                {[1, 2, 3, 4].map((q) => {
                  const qr = currentFy.quarters.find((x) => x.quarter === q);
                  const months = { 1: "Apr–Jun", 2: "Jul–Sep", 3: "Oct–Dec", 4: "Jan–Mar" }[q];
                  const noData = !qr;
                  return (
                    <div key={q} className={`sharp-card p-5 ${noData ? "opacity-50" : ""}`} data-testid={`quarter-card-Q${q}`}>
                      <div className="flex items-center justify-between">
                        <div className="kbd-label">Q{q} · {months}</div>
                        {!noData && qr.qoq_growth_pct != null && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-sm ${qr.qoq_growth_pct >= 0 ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
                            {qr.qoq_growth_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {qr.qoq_growth_pct.toFixed(1)}% QoQ
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-black mono mt-2">{noData ? "—" : fmtINR(qr.sales)}</div>
                      {!noData && (
                        <div className="space-y-1.5 mt-3 text-xs">
                          <div className="flex justify-between"><span className="text-slate-500">GP</span><span className="mono font-bold">{fmtINR(qr.gp)} ({qr.gp_pct}%)</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Orders</span><span className="mono font-bold">{fmtNum(qr.orders)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Customers</span><span className="mono font-bold">{fmtNum(qr.customers)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">AOV</span><span className="mono font-bold">{fmtINR(qr.aov)}</span></div>
                          {qr.yoy_growth_pct != null && (
                            <div className="flex justify-between border-t border-slate-100 pt-1.5"><span className="text-slate-500">YoY Growth</span><span className={`mono font-black ${qr.yoy_growth_pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>{qr.yoy_growth_pct.toFixed(1)}%</span></div>
                          )}
                          <div className="flex justify-between"><span className="text-slate-500">Target</span><span className="mono font-bold">{qr.target ? fmtINR(qr.target) : "—"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Achievement</span>
                            {qr.achievement_pct != null ? (
                              <Badge variant={qr.achievement_pct >= 100 ? "success" : qr.achievement_pct >= 80 ? "warning" : "danger"}>{qr.achievement_pct.toFixed(0)}%</Badge>
                            ) : <span className="text-xs text-slate-400">—</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Multi-FY trend chart */}
          <div className="sharp-card p-5" data-testid="qbr-trend-chart">
            <div className="kbd-label">Quarterly Trend</div>
            <div className="text-lg font-black tracking-tight mt-1 mb-3">Sales & GP across all quarters</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} />
                  <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }} />
                  <Bar dataKey="sales" fill="#002FA7" name="Sales" />
                  <Bar dataKey="gp" fill="#059669" name="GP" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed quarterly table */}
          <div className="sharp-card overflow-x-auto scrollbar-thin">
            <table className="dense-table w-full" data-testid="quarterly-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="text-right">Sales</th>
                  <th className="text-right">GP</th>
                  <th className="text-right">GP %</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Customers</th>
                  <th className="text-right">AOV</th>
                  <th className="text-right">QoQ %</th>
                  <th className="text-right">YoY %</th>
                  <th className="text-right">Target</th>
                  <th className="text-right">Achievement</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.period}>
                    <td className="font-bold">{r.period}</td>
                    <td className="mono text-right">{fmtINR(r.sales)}</td>
                    <td className="mono text-right">{fmtINR(r.gp)}</td>
                    <td className="mono text-right">{fmtPct(r.gp_pct)}</td>
                    <td className="mono text-right">{fmtNum(r.orders)}</td>
                    <td className="mono text-right">{fmtNum(r.customers)}</td>
                    <td className="mono text-right">{fmtINR(r.aov)}</td>
                    <td className={`mono text-right font-bold ${r.qoq_growth_pct == null ? "text-slate-400" : r.qoq_growth_pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {r.qoq_growth_pct == null ? "—" : `${r.qoq_growth_pct.toFixed(1)}%`}
                    </td>
                    <td className={`mono text-right font-bold ${r.yoy_growth_pct == null ? "text-slate-400" : r.yoy_growth_pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {r.yoy_growth_pct == null ? "—" : `${r.yoy_growth_pct.toFixed(1)}%`}
                    </td>
                    <td className="mono text-right">{r.target ? fmtINR(r.target) : "—"}</td>
                    <td className="text-right">
                      {r.achievement_pct != null ? <Badge variant={r.achievement_pct >= 100 ? "success" : r.achievement_pct >= 80 ? "warning" : "danger"}>{r.achievement_pct.toFixed(0)}%</Badge> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
