import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, KpiCard, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { Users, UserPlus, UserX, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { useDatasets } from "../context/DatasetContext";
import ExportBar from "../components/ExportBar";
import DatasetSelector from "../components/DatasetSelector";
import { CustomerLink } from "../components/CustomerDrawerContext";

export default function CustomersPage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("top20");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const params = scope === "all" ? { dataset_id: "all" } : {};
    api.get("/analytics/customers", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id, scope]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see customer analytics." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const filteredRows = data.rows.filter((r) => !search || r.customer.toLowerCase().includes(search.toLowerCase()));
  const tabs = [
    { id: "top20", label: "Top 20" },
    { id: "all", label: `All (${data.total_customers})` },
    { id: "growth", label: "Growth M-o-M" },
    { id: "new", label: `New (${data.new_customers.length})` },
    { id: "lost", label: `Lost (${data.lost_customers.length})` },
    { id: "dormant", label: `Dormant (${data.dormant_customers.length})` },
  ];
  const scopeParam = scope === "all" ? "?dataset_id=all" : "";

  return (
    <div className="space-y-8">
      <SectionTitle sub={`${data.total_customers} unique customers`} action={
        <div className="flex gap-2">
          <DatasetSelector scope={scope} setScope={setScope} />
          <ExportBar xlsxUrl={`/reports/customers.xlsx${scopeParam}`} filename="customers.xlsx" testid="export-customers" />
        </div>
      }>Customer Analytics</SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard testid="cust-kpi-total" label="Total Customers" value={fmtNum(data.total_customers)} icon={Users} />
        <KpiCard testid="cust-kpi-new" label="New (this month)" value={fmtNum(data.new_customers.length)} icon={UserPlus} />
        <KpiCard testid="cust-kpi-lost" label="Lost (vs prev)" value={fmtNum(data.lost_customers.length)} icon={UserX} />
        <KpiCard testid="cust-kpi-dormant" label="Dormant (90d+)" value={fmtNum(data.dormant_customers.length)} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5" data-testid="highest-growth-card">
          <div className="kbd-label flex items-center gap-1 text-emerald-700"><TrendingUp className="w-3 h-3" /> Highest Growing</div>
          {data.highest_growth ? (
            <>
              <div className="text-xl font-black tracking-tight mt-2 truncate">{data.highest_growth.customer}</div>
              <div className="mt-2 mono text-sm">{fmtINR(data.highest_growth.previous)} → {fmtINR(data.highest_growth.current)}</div>
              <div className="mt-1 text-emerald-700 font-black text-2xl">+{data.highest_growth.growth_pct.toFixed(1)}%</div>
            </>
          ) : <div className="text-sm text-slate-500 mt-2">No data</div>}
        </div>
        <div className="sharp-card p-5" data-testid="highest-decline-card">
          <div className="kbd-label flex items-center gap-1 text-red-700"><TrendingDown className="w-3 h-3" /> Highest Declining</div>
          {data.highest_decline ? (
            <>
              <div className="text-xl font-black tracking-tight mt-2 truncate">{data.highest_decline.customer}</div>
              <div className="mt-2 mono text-sm">{fmtINR(data.highest_decline.previous)} → {fmtINR(data.highest_decline.current)}</div>
              <div className="mt-1 text-red-700 font-black text-2xl">{data.highest_decline.growth_pct.toFixed(1)}%</div>
            </>
          ) : <div className="text-sm text-slate-500 mt-2">No data</div>}
        </div>
      </div>

      <div className="sharp-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3" data-testid="customer-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${tab === t.id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
              data-testid={`tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
          {(tab === "top20" || tab === "all") && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer..."
              className="ml-auto border border-slate-300 px-3 py-1.5 text-xs w-56 focus:outline-none focus:border-[#002FA7]"
              data-testid="customer-search"
            />
          )}
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          {tab === "top20" && <CustomerTable rows={filteredRows.slice(0, 20)} />}
          {tab === "all" && <CustomerTable rows={filteredRows} />}
          {tab === "growth" && <GrowthTable rows={data.growth} />}
          {tab === "new" && <SimpleList items={data.new_customers} empty="No new customers detected." />}
          {tab === "lost" && <SimpleList items={data.lost_customers} empty="No lost customers detected." />}
          {tab === "dormant" && <DormantTable rows={data.dormant_customers} />}
        </div>
      </div>
    </div>
  );
}

function CustomerTable({ rows }) {
  return (
    <table className="dense-table w-full" data-testid="customer-table">
      <thead>
        <tr>
          <th className="w-10">#</th>
          <th>Customer</th>
          <th>Country</th>
          <th className="text-right">Sales</th>
          <th className="text-right">GP</th>
          <th className="text-right">GP %</th>
          <th className="text-right">Orders</th>
          <th className="text-right">AOV</th>
          <th className="text-right">Contri %</th>
          <th>Last Order</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.customer}>
            <td className="mono text-slate-500">{i + 1}</td>
            <td className="font-bold"><CustomerLink name={r.customer} /></td>
            <td>{r.country || "—"}</td>
            <td className="mono text-right">{fmtINR(r.sales)}</td>
            <td className="mono text-right">{fmtINR(r.gp)}</td>
            <td className="mono text-right">{fmtPct(r.gp_pct)}</td>
            <td className="mono text-right">{fmtNum(r.orders)}</td>
            <td className="mono text-right">{fmtINR(r.aov)}</td>
            <td className="mono text-right">{fmtPct(r.contribution_pct)}</td>
            <td className="mono text-xs">{r.last_purchase || "—"}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={10} className="text-center text-slate-400 py-6">No results.</td></tr>}
      </tbody>
    </table>
  );
}

function GrowthTable({ rows }) {
  return (
    <table className="dense-table w-full" data-testid="growth-table">
      <thead>
        <tr>
          <th>Customer</th>
          <th className="text-right">Previous</th>
          <th className="text-right">Current</th>
          <th className="text-right">Change</th>
          <th className="text-right">Growth %</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.customer}>
            <td className="font-bold"><CustomerLink name={r.customer} /></td>
            <td className="mono text-right">{fmtINR(r.previous)}</td>
            <td className="mono text-right">{fmtINR(r.current)}</td>
            <td className={`mono text-right ${r.change >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtINR(r.change)}</td>
            <td className={`mono text-right font-bold ${r.growth_pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>{r.growth_pct.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SimpleList({ items, empty }) {
  if (!items.length) return <div className="p-6 text-sm text-slate-500 text-center">{empty}</div>;
  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {items.map((c) => (
        <div key={c} className="border border-slate-200 px-3 py-2 text-sm font-bold bg-slate-50"><CustomerLink name={c} /></div>
      ))}
    </div>
  );
}

function DormantTable({ rows }) {
  if (!rows.length) return <div className="p-6 text-sm text-slate-500 text-center">No dormant customers.</div>;
  return (
    <table className="dense-table w-full" data-testid="dormant-table">
      <thead>
        <tr>
          <th>Customer</th>
          <th>Last Purchase</th>
          <th className="text-right">Days Inactive</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.customer}>
            <td className="font-bold"><CustomerLink name={r.customer} /></td>
            <td className="mono text-xs">{r.last_purchase}</td>
            <td className="mono text-right">
              <Badge variant={r.days_since > 180 ? "danger" : "warning"}>{r.days_since}d</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
