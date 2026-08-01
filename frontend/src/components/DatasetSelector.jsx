import React from "react";
import { useDatasets } from "../context/DatasetContext";

/**
 * DatasetSelector: toggle between "active dataset only" and "all datasets merged".
 * Only meaningful when the user has 2+ datasets uploaded.
 */
export default function DatasetSelector({ scope, setScope }) {
  const { datasets } = useDatasets();
  if (!datasets || datasets.length < 2) return null;
  return (
    <div className="inline-flex border border-slate-300 rounded-sm overflow-hidden" data-testid="dataset-scope-selector">
      <button
        onClick={() => setScope("active")}
        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${scope === "active" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
        data-testid="scope-active"
      >
        Active only
      </button>
      <button
        onClick={() => setScope("all")}
        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${scope === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
        data-testid="scope-all"
      >
        All merged ({datasets.length})
      </button>
    </div>
  );
}
