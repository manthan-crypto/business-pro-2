import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api from "../lib/api";
import { fmtINR, fmtNum, fmtPct } from "../lib/api";
import { X, User, MapPin, Package, TrendingUp, Users as UsersIcon, Calendar, ShoppingCart } from "lucide-react";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Badge } from "./Primitives";

const CATEGORY_COLORS = ["#002FA7", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#4B5563"];

export default function CustomerDrawer({ customer, scope, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    setData(null);
    const params = scope === "all" ? { dataset_id: "all" } : {};
    api.get(`/analytics/customer/${encodeURIComponent(customer)}`, { params })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [customer, scope]);

  useEffect(() => {
    if (!customer) return;
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [customer, onClose]);

  if (!customer) return null;

  const drawer = (
    <div className="fixed inset-0 z-50 flex" data-testid="customer-drawer">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} data-testid="drawer-backdrop" />
      <div className="w-full max-w-5xl bg-white h-full overflow-y-auto scrollbar-thin shadow-2xl">
        <div className="sticky top-0 bg-white border-b-2 border-slate-900 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="kbd-label text-[#002FA7]">Customer 360°</div>
            <div className="text-2xl font-black tracking-tight mt-0.5" data-testid="drawer-customer-name">{customer}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 border border-slate-300" data-testid="drawer-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !data ? (
          <div className="p-12 text-center text-sm text-slate-500 font-bold uppercase tracking-wider">Loading customer profile...</div>
        ) : !data.found ? (
          <div className="p-12 text-center text-sm text-slate-500">Customer not found in current dataset.</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Meta */}
            <div className="flex flex-wrap gap-4 text-xs">
              {data.kpis.country && <span className="inline-flex items-center gap-1 border border-slate-200 px-2 py-1"><MapPin className="w-3 h-3" /> {data.kpis.country}{data.kpis.area ? ` · ${data.kpis.area}` : ""}</span>}
              {data.kpis.first_purchase && <span className="inline-flex items-center gap-1 border border-slate-200 px-2 py-1"><Calendar className="w-3 h-3" /> Since {data.kpis.first_purchase}</span>}
              <span className="inline-flex items-center gap-1 border border-slate-200 px-2 py-1"><ShoppingCart className="w-3 h-3" /> Last: {data.kpis.last_purchase || "—"}</span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiMini label="Total Sales" value={fmtINR(data.kpis.total_sales)} />
              <KpiMini label="Total GP" value={fmtINR(data.kpis.total_gp)} sub={`${data.kpis.gp_pct}%`} />
              <KpiMini label="Orders" value={fmtNum(data.kpis.orders)} sub={`AOV ${fmtINR(data.kpis.aov)}`} />
              <KpiMini label="Products" value={fmtNum(data.kpis.products_purchased)} sub={`${data.kpis.active_months} active months`} />
            </div>

            {/* Trend Chart */}
            <div className="sharp-card p-4">
              <div className="kbd-label mb-1"><TrendingUp className="w-3 h-3 inline mr-1" /> Monthly Trend</div>
              <div className="text-sm font-bold mb-3">Sales & GP per month</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v >= 1e7 ? `${(v/1e7).toFixed(0)}Cr` : v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
                    <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }} />
                    <Bar dataKey="sales" fill="#002FA7" name="Sales" />
                    <Bar dataKey="gp" fill="#059669" name="GP" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Salesperson & Category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="sharp-card p-4">
                <div className="kbd-label mb-3"><UsersIcon className="w-3 h-3 inline mr-1" /> Salesperson History</div>
                <table className="dense-table w-full">
                  <thead>
                    <tr><th>Salesperson</th><th className="text-right">Sales</th><th className="text-right">Share</th><th className="text-right">Orders</th></tr>
                  </thead>
                  <tbody>
                    {data.salesperson_history.map((s) => (
                      <tr key={s.salesperson}>
                        <td className="font-bold text-xs">{s.salesperson}</td>
                        <td className="mono text-right">{fmtINR(s.sales)}</td>
                        <td className="mono text-right">{fmtPct(s.share_pct)}</td>
                        <td className="mono text-right">{s.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sharp-card p-4">
                <div className="kbd-label mb-3">Category Mix</div>
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.category_mix.slice(0, 8)} dataKey="sales" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={30}>
                          {data.category_mix.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ border: "1px solid #0A0A0A", fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1">
                    {data.category_mix.slice(0, 8).map((c, i) => (
                      <div key={c.category} className="flex items-center gap-1.5 text-[11px]">
                        <div className="w-2 h-2 flex-shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                        <div className="font-bold truncate flex-1">{c.category}</div>
                        <div className="mono">{fmtPct(c.share_pct)}</div>
                      </div>
                    ))}
                    {data.category_mix.length > 8 && <div className="text-[10px] text-slate-400">+{data.category_mix.length - 8} more</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Product Mix Table */}
            <div className="sharp-card">
              <div className="p-4 border-b border-slate-200">
                <div className="kbd-label"><Package className="w-3 h-3 inline mr-1" /> Product Mix (Top 30)</div>
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="dense-table w-full">
                  <thead>
                    <tr><th>#</th><th>Product</th><th>Category</th><th className="text-right">Sales</th><th className="text-right">Qty</th><th className="text-right">GP %</th><th className="text-right">Contri %</th><th>Last Sold</th></tr>
                  </thead>
                  <tbody>
                    {data.product_mix.slice(0, 30).map((p, i) => (
                      <tr key={p.product}>
                        <td className="mono text-slate-500">{i + 1}</td>
                        <td className="font-bold text-xs">{p.product}</td>
                        <td className="text-xs">{p.category || "—"}</td>
                        <td className="mono text-right">{fmtINR(p.sales)}</td>
                        <td className="mono text-right">{fmtNum(p.qty)}</td>
                        <td className="mono text-right">{fmtPct(p.gp_pct)}</td>
                        <td className="mono text-right">{fmtPct(p.contribution_pct)}</td>
                        <td className="mono text-xs">{p.last_sold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Tx */}
            <div className="sharp-card">
              <div className="p-4 border-b border-slate-200"><div className="kbd-label">Recent 20 Transactions</div></div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="dense-table w-full">
                  <thead>
                    <tr><th>Date</th><th>Invoice</th><th>Product</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th><th className="text-right">GP</th><th>SP</th></tr>
                  </thead>
                  <tbody>
                    {data.recent_transactions.map((t, i) => (
                      <tr key={i}>
                        <td className="mono text-xs">{t.date}</td>
                        <td className="mono text-xs">{t.invoice_no}</td>
                        <td className="font-bold text-xs">{t.product}</td>
                        <td className="mono text-right">{fmtNum(t.qty)}</td>
                        <td className="mono text-right">{fmtNum(t.rate)}</td>
                        <td className="mono text-right">{fmtINR(t.net_amount)}</td>
                        <td className="mono text-right">{fmtINR(t.gp_amount)}</td>
                        <td className="text-xs">{t.salesperson || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}

function KpiMini({ label, value, sub }) {
  return (
    <div className="border border-slate-200 p-3">
      <div className="kbd-label">{label}</div>
      <div className="text-xl font-black mono mt-1">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
