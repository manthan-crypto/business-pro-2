import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, KpiCard, EmptyState, Badge } from "../components/Primitives";
import { fmtINR, fmtPct, fmtNum } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import ExportBar from "../components/ExportBar";
import DatasetSelector from "../components/DatasetSelector";
import { Wallet, PieChart, AlertTriangle } from "lucide-react";

export default function FinanceDashboardPage() {
  const { active } = useDatasets();
  const [scope, setScope] = useState("active");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const params = scope === "all" ? { dataset_id: "all" } : {};
    api.get("/analytics/executive/finance", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id, scope]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see Finance dashboard." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const k = data.kpis;
  const scopeParam = scope === "all" ? "?dataset_id=all" : "";

  return (
    <div className="space-y-8">
      <SectionTitle sub="Margins, currency mix and credit exposure" action={
        <div className="flex gap-2">
          <DatasetSelector scope={scope} setScope={setScope} />
          <ExportBar pdfUrl={`/reports/finance.pdf${scopeParam}`} filename="finance_dashboard.pdf" testid="export-finance" />
        </div>
      }>
        <div className="flex items-center gap-2"><Wallet className="w-5 h-5 text-[#002FA7]" /> Finance Dashboard</div>
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard testid="fin-kpi-sales" label="Total Sales" value={fmtINR(k.total_sales)} icon={Wallet} />
        <KpiCard testid="fin-kpi-gp" label="Total GP" value={fmtINR(k.total_gp)} icon={PieChart} />
        <KpiCard testid="fin-kpi-margin" label="GP Margin" value={`${k.gp_pct}%`} icon={PieChart} />
        <KpiCard testid="fin-kpi-orders" label="Orders" value={fmtNum(k.orders)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5" data-testid="fin-currency-wise">
          <div className="kbd-label">{data.has_currency_field ? "Currency-wise Sales" : "Country-wise Sales (currency proxy)"}</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-3">
            {data.has_currency_field ? "Explicit Currency Split" : "Geographic Revenue Split"}
          </div>
          <div className="overflow-y-auto max-h-96 scrollbar-thin">
            <table className="dense-table w-full">
              <thead><tr><th>{data.has_currency_field ? "Currency" : "Country"}</th><th className="text-right">Sales</th><th className="text-right">GP</th><th className="text-right">Margin</th></tr></thead>
              <tbody>
                {data.currency_wise.slice(0, 20).map((c) => (
                  <tr key={c.currency}><td className="font-bold text-xs">{c.currency}</td><td className="mono text-right">{fmtINR(c.sales)}</td><td className="mono text-right">{fmtINR(c.gp)}</td><td className="mono text-right">{fmtPct(c.gp_pct)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.has_currency_field && (
            <div className="mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
              Tip: Add a <span className="mono font-bold">Currency</span> column to your Excel (or map it in the Datasets page) to see true currency-wise breakdowns.
            </div>
          )}
        </div>

        <div className="sharp-card p-5" data-testid="fin-credit-exposure">
          <div className="kbd-label flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Top Credit Exposure</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-3">Customer Revenue Concentration</div>
          <table className="dense-table w-full">
            <thead><tr><th>Customer</th><th className="text-right">Sales</th><th className="text-right">Contri</th></tr></thead>
            <tbody>
              {data.top_credit_exposure.map((c) => (
                <tr key={c.customer}><td className="font-bold text-xs">{c.customer}</td><td className="mono text-right">{fmtINR(c.sales)}</td><td className="mono text-right">{fmtPct(c.contribution_pct)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5" data-testid="fin-low-gp">
          <div className="kbd-label text-red-700">Low-Margin Customers (&lt;15% GP)</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-3">Margin Risk</div>
          <table className="dense-table w-full">
            <thead><tr><th>Customer</th><th className="text-right">Sales</th><th className="text-right">GP %</th></tr></thead>
            <tbody>
              {data.low_gp_customers.length === 0 && <tr><td colSpan={3} className="text-slate-500 text-xs text-center py-3">All customers above 15% margin ✓</td></tr>}
              {data.low_gp_customers.map((c) => (
                <tr key={c.customer}><td className="font-bold text-xs">{c.customer}</td><td className="mono text-right">{fmtINR(c.sales)}</td><td className="mono text-right"><Badge variant="danger">{c.gp_pct.toFixed(1)}%</Badge></td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sharp-card p-5" data-testid="fin-payment-mode">
          <div className="kbd-label">Payment Mode / Transaction Type</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-3">Terms Analysis</div>
          <table className="dense-table w-full">
            <thead><tr><th>Mode</th><th className="text-right">Sales</th><th className="text-right">GP %</th><th className="text-right">Orders</th></tr></thead>
            <tbody>
              {data.payment_mode_analysis.map((m) => (
                <tr key={m.mode}><td className="font-bold">{m.mode}</td><td className="mono text-right">{fmtINR(m.sales)}</td><td className="mono text-right">{fmtPct(m.gp_pct)}</td><td className="mono text-right">{fmtNum(m.orders)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
