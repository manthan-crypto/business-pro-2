import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, KpiCard, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { Package, Zap, Snowflake, Ban } from "lucide-react";
import { useDatasets } from "../context/DatasetContext";

export default function ProductsPage() {
  const { active } = useDatasets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("top20");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    api.get("/analytics/products").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see product analytics." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const filtered = data.rows.filter((r) => !search || r.product.toLowerCase().includes(search.toLowerCase()));

  const tabs = [
    { id: "top20", label: "Top 20" },
    { id: "all", label: `All (${data.total_products})` },
    { id: "fast", label: `Fast Movers (${data.fast_movers.length})` },
    { id: "slow", label: `Slow Movers (${data.slow_movers.length})` },
    { id: "zero", label: `Zero Sales (${data.zero_sales.length})` },
  ];

  return (
    <div className="space-y-8">
      <SectionTitle sub={`${data.total_products} unique products`}>Product Analytics</SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard testid="prod-kpi-total" label="Total Products" value={fmtNum(data.total_products)} icon={Package} />
        <KpiCard testid="prod-kpi-fast" label="Fast Movers" value={fmtNum(data.fast_movers.length)} icon={Zap} sub="Top 20% by sales" />
        <KpiCard testid="prod-kpi-slow" label="Slow Movers" value={fmtNum(data.slow_movers.length)} icon={Snowflake} sub="Bottom 20%" />
        <KpiCard testid="prod-kpi-zero" label="Zero Sales" value={fmtNum(data.zero_sales.length)} icon={Ban} />
      </div>

      <div className="sharp-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${tab === t.id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
              data-testid={`prod-tab-${t.id}`}>
              {t.label}
            </button>
          ))}
          {(tab === "top20" || tab === "all") && (
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product..."
              className="ml-auto border border-slate-300 px-3 py-1.5 text-xs w-56 focus:outline-none focus:border-[#002FA7]" data-testid="product-search" />
          )}
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <ProductTable rows={
            tab === "top20" ? filtered.slice(0, 20) :
            tab === "all" ? filtered :
            tab === "fast" ? data.fast_movers :
            tab === "slow" ? data.slow_movers :
            data.zero_sales
          } />
        </div>
      </div>
    </div>
  );
}

function ProductTable({ rows }) {
  if (!rows.length) return <div className="p-6 text-sm text-slate-500 text-center">No products.</div>;
  return (
    <table className="dense-table w-full" data-testid="product-table">
      <thead>
        <tr>
          <th className="w-10">#</th>
          <th>Product</th>
          <th>Category</th>
          <th className="text-right">Qty</th>
          <th className="text-right">Sales</th>
          <th className="text-right">GP</th>
          <th className="text-right">GP %</th>
          <th className="text-right">Orders</th>
          <th className="text-right">Contri %</th>
          <th>Last Sold</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.product}>
            <td className="mono text-slate-500">{i + 1}</td>
            <td className="font-bold">{r.product}</td>
            <td className="text-xs">{r.category || "—"}</td>
            <td className="mono text-right">{fmtNum(r.qty)}</td>
            <td className="mono text-right">{fmtINR(r.sales)}</td>
            <td className="mono text-right">{fmtINR(r.gp)}</td>
            <td className="mono text-right">{fmtPct(r.gp_pct)}</td>
            <td className="mono text-right">{fmtNum(r.orders)}</td>
            <td className="mono text-right">{fmtPct(r.contribution_pct)}</td>
            <td className="mono text-xs">{r.last_sold || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
