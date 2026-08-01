import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";

export default function SalespersonsPage() {
  const { active } = useDatasets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    api.get("/analytics/salespersons").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see sales team analytics." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  return (
    <div className="space-y-8">
      <SectionTitle sub={`${data.rows.length} salespersons`}>Sales Team Performance</SectionTitle>

      <div className="sharp-card overflow-x-auto scrollbar-thin">
        <table className="dense-table w-full" data-testid="salesperson-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Salesperson</th>
              <th className="text-right">Sales</th>
              <th className="text-right">GP</th>
              <th className="text-right">GP %</th>
              <th className="text-right">Customers</th>
              <th className="text-right">Orders</th>
              <th className="text-right">Target</th>
              <th className="text-right">Achievement</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={r.salesperson}>
                <td className="mono font-black">#{i + 1}</td>
                <td className="font-bold">{r.salesperson}</td>
                <td className="mono text-right">{fmtINR(r.sales)}</td>
                <td className="mono text-right">{fmtINR(r.gp)}</td>
                <td className="mono text-right">{fmtPct(r.gp_pct)}</td>
                <td className="mono text-right">{fmtNum(r.customers)}</td>
                <td className="mono text-right">{fmtNum(r.orders)}</td>
                <td className="mono text-right">{r.target ? fmtINR(r.target) : "—"}</td>
                <td className="text-right">
                  {r.target ? (
                    <Badge variant={r.achievement_pct >= 100 ? "success" : r.achievement_pct >= 80 ? "warning" : "danger"}>
                      {r.achievement_pct.toFixed(0)}%
                    </Badge>
                  ) : <span className="text-slate-400 text-xs">no target</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
