import React, { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import { SectionTitle, Badge } from "../components/Primitives";
import { useDatasets } from "../context/DatasetContext";
import { CheckCircle, Trash2, Edit3, Save, X } from "lucide-react";

const CANONICAL = ["invoice_no", "invoice_date", "customer", "product", "category", "manufacturer", "qty", "rate", "cost_price", "gp_pct", "gp_amount", "net_amount", "salesperson", "country", "area", "mode"];

export default function DatasetsPage() {
  const { datasets, active, refresh, activate, remove } = useDatasets();
  const [editingMap, setEditingMap] = useState(null); // dataset id
  const [mapping, setMapping] = useState({});
  const [saving, setSaving] = useState(false);

  const startEdit = (ds) => {
    setEditingMap(ds.id);
    setMapping(ds.mapping || {});
  };

  const saveMapping = async (id) => {
    setSaving(true);
    try {
      await api.put(`/datasets/${id}/mapping`, { mapping });
      setEditingMap(null);
      await refresh();
    } catch (e) {
      alert(formatApiError(e));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-8">
      <SectionTitle sub="Manage uploaded datasets and column mappings">Datasets</SectionTitle>

      <div className="space-y-3">
        {datasets.map((d) => {
          const editing = editingMap === d.id;
          return (
            <div key={d.id} className="sharp-card p-5" data-testid={`dataset-${d.id}`}>
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-black tracking-tight">{d.name}</div>
                    {d.is_active && <Badge variant="success">ACTIVE</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 mono">
                    {d.filename} · {d.row_count.toLocaleString()} rows · {d.headers.length} columns · {d.kind === "monthly_summary" ? "monthly summary" : "transaction"} · uploaded {d.uploaded_at.split("T")[0]}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!d.is_active && (
                    <button onClick={() => activate(d.id)} className="border border-slate-300 hover:border-slate-900 text-slate-900 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1" data-testid={`activate-${d.id}`}>
                      <CheckCircle className="w-3 h-3" /> Set Active
                    </button>
                  )}
                  {!editing ? (
                    <button onClick={() => startEdit(d)} className="border border-slate-300 hover:border-slate-900 text-slate-900 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1" data-testid={`edit-mapping-${d.id}`}>
                      <Edit3 className="w-3 h-3" /> Edit Mapping
                    </button>
                  ) : (
                    <>
                      <button onClick={() => saveMapping(d.id)} disabled={saving} className="bg-[#002FA7] hover:bg-[#00227A] disabled:opacity-50 text-white px-3 py-1.5 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1" data-testid={`save-mapping-${d.id}`}>
                        <Save className="w-3 h-3" /> {saving ? "Saving..." : "Save & Reprocess"}
                      </button>
                      <button onClick={() => setEditingMap(null)} className="border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </>
                  )}
                  <button onClick={() => window.confirm("Delete this dataset and all its data?") && remove(d.id)} className="border border-red-300 hover:bg-red-50 text-red-700 px-3 py-1.5 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1" data-testid={`delete-${d.id}`}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>

              {editing && (
                <div className="mt-5 border-t border-slate-200 pt-5">
                  <div className="kbd-label mb-3">Column Mapping — assign each canonical field to a source column</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {CANONICAL.map((cf) => (
                      <div key={cf} className="flex items-center gap-2">
                        <div className="w-32 text-xs font-bold uppercase tracking-wider text-slate-700">{cf}</div>
                        <select value={mapping[cf] || ""} onChange={(e) => setMapping({ ...mapping, [cf]: e.target.value })}
                          className="flex-1 border border-slate-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#002FA7]"
                          data-testid={`map-select-${d.id}-${cf}`}>
                          <option value="">— None —</option>
                          {d.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {datasets.length === 0 && (
          <div className="sharp-card p-12 text-center text-sm text-slate-500">
            No datasets uploaded yet. Go to <span className="font-bold text-[#002FA7]">Upload Data</span>.
          </div>
        )}
      </div>
    </div>
  );
}
