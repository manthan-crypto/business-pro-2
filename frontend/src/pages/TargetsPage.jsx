import React, { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import { SectionTitle, EmptyState } from "../components/Primitives";
import { fmtINR } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import { Plus, Trash2 } from "lucide-react";

export default function TargetsPage() {
  const { active } = useDatasets();
  const [targets, setTargets] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [form, setForm] = useState({ salesperson: "", month: "", target: "" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [t, s] = await Promise.all([
      api.get("/targets"),
      active ? api.get("/analytics/salespersons") : Promise.resolve({ data: { rows: [] } }),
    ]);
    setTargets(t.data);
    setSalespersons(s.data.rows.map((r) => r.salesperson));
  };

  useEffect(() => { load(); }, [active?.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.salesperson || !form.month || !form.target) return;
    setLoading(true);
    try {
      await api.post("/targets", {
        salesperson: form.salesperson,
        month: form.month,
        target: parseFloat(form.target),
      });
      setForm({ salesperson: "", month: "", target: "" });
      await load();
    } catch (e) {
      alert(formatApiError(e));
    } finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this target?")) return;
    await api.delete(`/targets/${id}`);
    await load();
  };

  return (
    <div className="space-y-8">
      <SectionTitle sub="Configure monthly targets per salesperson">Sales Targets</SectionTitle>

      <form onSubmit={submit} className="sharp-card p-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end" data-testid="target-form">
        <div>
          <label className="kbd-label">Salesperson</label>
          {salespersons.length > 0 ? (
            <select value={form.salesperson} onChange={(e) => setForm({ ...form, salesperson: e.target.value })}
              className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#002FA7]" data-testid="target-salesperson-select">
              <option value="">Select...</option>
              {salespersons.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input value={form.salesperson} onChange={(e) => setForm({ ...form, salesperson: e.target.value })}
              placeholder="Enter salesperson name"
              className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#002FA7]" data-testid="target-salesperson-input" />
          )}
        </div>
        <div>
          <label className="kbd-label">Month (YYYY-MM)</label>
          <input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}
            className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#002FA7]" data-testid="target-month" required />
        </div>
        <div>
          <label className="kbd-label">Target (₹)</label>
          <input type="number" min="0" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}
            placeholder="1000000"
            className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#002FA7]" data-testid="target-amount" required />
        </div>
        <button type="submit" disabled={loading}
          className="bg-[#002FA7] hover:bg-[#00227A] text-white px-4 py-2.5 text-sm font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 disabled:opacity-50"
          data-testid="target-submit">
          <Plus className="w-4 h-4" /> Add/Update Target
        </button>
      </form>

      <div className="sharp-card overflow-x-auto scrollbar-thin">
        <table className="dense-table w-full" data-testid="targets-table">
          <thead>
            <tr>
              <th>Salesperson</th>
              <th>Month</th>
              <th className="text-right">Target</th>
              <th className="w-20">Action</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.id}>
                <td className="font-bold">{t.salesperson}</td>
                <td className="mono">{t.month}</td>
                <td className="mono text-right">{fmtINR(t.target)}</td>
                <td>
                  <button onClick={() => remove(t.id)} className="p-1.5 hover:bg-red-50 text-red-600" data-testid={`target-delete-${t.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {targets.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-500 text-sm">No targets set. Add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
