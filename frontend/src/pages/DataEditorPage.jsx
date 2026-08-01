import React, { useEffect, useState, useCallback } from "react";
import api, { formatApiError } from "../lib/api";
import { SectionTitle, EmptyState, Badge } from "../components/Primitives";
import { useDatasets } from "../context/DatasetContext";
import { Save, AlertTriangle } from "lucide-react";

const EDITABLE_FIELDS = ["customer", "product", "invoice_date", "qty", "rate", "net_amount", "gp_amount", "salesperson", "country", "category"];

export default function DataEditorPage() {
  const { active } = useDatasets();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [editing, setEditing] = useState({}); // { row_id: { field: value } }
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(false);
  const LIMIT = 25;

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const params = { skip: page * LIMIT, limit: LIMIT, only_missing: onlyMissing };
      if (search) params.search = search;
      const { data } = await api.get("/transactions", { params });
      setRows(data.rows);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [active?.id, page, onlyMissing, search]);

  useEffect(() => { load(); }, [load]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to edit rows." />;

  const setEdit = (rowId, field, value) => {
    setEditing((p) => ({ ...p, [rowId]: { ...(p[rowId] || {}), [field]: value } }));
  };

  const saveRow = async (rowId) => {
    const updates = editing[rowId];
    if (!updates) return;
    setSaving((p) => ({ ...p, [rowId]: true }));
    try {
      const cleaned = {};
      for (const [k, v] of Object.entries(updates)) {
        if (["qty", "rate", "net_amount", "gp_amount"].includes(k)) {
          cleaned[k] = v === "" ? null : parseFloat(v);
        } else {
          cleaned[k] = v === "" ? null : v;
        }
      }
      await api.patch(`/transactions/${rowId}`, { updates: cleaned });
      setEditing((p) => { const c = { ...p }; delete c[rowId]; return c; });
      await load();
    } catch (e) {
      alert("Failed to save: " + formatApiError(e));
    } finally {
      setSaving((p) => ({ ...p, [rowId]: false }));
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-8">
      <SectionTitle sub={`Edit blank or incorrect values directly. ${total.toLocaleString()} rows`}>Data Editor</SectionTitle>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search customer / product / invoice..."
          className="border border-slate-300 px-3 py-2 text-sm w-80 focus:outline-none focus:border-[#002FA7]"
          data-testid="editor-search"
        />
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => { setOnlyMissing(e.target.checked); setPage(0); }}
            className="w-4 h-4 accent-[#002FA7]"
            data-testid="editor-only-missing"
          />
          Show only rows with missing values
        </label>
        <div className="ml-auto text-xs font-bold text-slate-500 mono">
          Page {page + 1} of {Math.max(1, totalPages)}
        </div>
      </div>

      <div className="sharp-card overflow-x-auto scrollbar-thin">
        <table className="dense-table w-full" data-testid="editor-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Invoice #</th>
              {EDITABLE_FIELDS.map((f) => <th key={f}>{f.replace("_", " ")}</th>)}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isEdited = !!editing[r.row_id];
              const missingSet = new Set(r.missing || []);
              return (
                <tr key={r.row_id}>
                  <td>
                    {missingSet.size > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-bold">
                        <AlertTriangle className="w-3 h-3" /> {missingSet.size}
                      </span>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </td>
                  <td className="mono text-xs">{r.invoice_no || "—"}</td>
                  {EDITABLE_FIELDS.map((f) => {
                    const current = editing[r.row_id]?.[f] ?? (r[f] ?? "");
                    const isMissing = missingSet.has(f);
                    return (
                      <td key={f} className={isMissing && !editing[r.row_id]?.[f] ? "missing-cell" : ""}>
                        <input
                          className="bare text-xs px-1 py-1 min-w-[80px]"
                          value={current ?? ""}
                          onChange={(e) => setEdit(r.row_id, f, e.target.value)}
                          data-testid={`edit-${r.row_id}-${f}`}
                        />
                      </td>
                    );
                  })}
                  <td>
                    <button
                      disabled={!isEdited || saving[r.row_id]}
                      onClick={() => saveRow(r.row_id)}
                      className="bg-[#002FA7] hover:bg-[#00227A] disabled:opacity-30 text-white px-2 py-1 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                      data-testid={`save-${r.row_id}`}
                    >
                      <Save className="w-3 h-3" /> Save
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && <tr><td colSpan={EDITABLE_FIELDS.length + 3} className="text-center py-6 text-slate-500">No rows.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider disabled:opacity-30" data-testid="page-prev">← Prev</button>
        <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider disabled:opacity-30" data-testid="page-next">Next →</button>
      </div>
    </div>
  );
}
