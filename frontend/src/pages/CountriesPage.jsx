import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, EmptyState } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function CountriesPage() {
  const { active } = useDatasets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    api.get("/analytics/countries").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see country analytics." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  return (
    <div className="space-y-8">
      <SectionTitle sub={`${data.rows.length} countries`}>Country Analytics</SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 sharp-card p-5">
          <div className="kbd-label">Sales by Country (Top 10)</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-4">Geographic Distribution</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.rows.slice(0, 10)} layout="vertical" margin={{ left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1e7 ? `${(v/1e7).toFixed(0)}Cr` : v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v} />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 11, fontWeight: 700 }} width={120} />
                <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }} />
                <Bar dataKey="sales" fill="#002FA7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sharp-card p-5" data-testid="country-growth-card">
          <div className="kbd-label">Growth Leaders / Decliners</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-4">Month-on-Month</div>
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {(data.growth || []).slice(0, 5).map((g) => (
              <div key={g.country} className="border border-emerald-200 bg-emerald-50 p-2 flex justify-between items-center">
                <div className="text-xs font-bold truncate">{g.country}</div>
                <div className="mono text-xs text-emerald-700 font-black">+{g.growth_pct.toFixed(1)}%</div>
              </div>
            ))}
            {(data.growth || []).slice(-5).reverse().map((g) => g.growth_pct < 0 && (
              <div key={g.country} className="border border-red-200 bg-red-50 p-2 flex justify-between items-center">
                <div className="text-xs font-bold truncate">{g.country}</div>
                <div className="mono text-xs text-red-700 font-black">{g.growth_pct.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sharp-card overflow-x-auto scrollbar-thin">
        <table className="dense-table w-full" data-testid="country-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Country</th>
              <th className="text-right">Sales</th>
              <th className="text-right">GP</th>
              <th className="text-right">Customers</th>
              <th className="text-right">Orders</th>
              <th className="text-right">Avg Order Size</th>
              <th className="text-right">Contri %</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.country}>
                <td className="mono font-black">#{r.rank}</td>
                <td className="font-bold">{r.country}</td>
                <td className="mono text-right">{fmtINR(r.sales)}</td>
                <td className="mono text-right">{fmtINR(r.gp)}</td>
                <td className="mono text-right">{fmtNum(r.customers)}</td>
                <td className="mono text-right">{fmtNum(r.orders)}</td>
                <td className="mono text-right">{fmtINR(r.aov)}</td>
                <td className="mono text-right">{fmtPct(r.contribution_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
