import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, EmptyState } from "../components/Primitives";
import { useDatasets } from "../context/DatasetContext";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

export default function AlertsPage() {
  const { active } = useDatasets();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    api.get("/analytics/alerts").then((r) => setAlerts(r.data.alerts || [])).finally(() => setLoading(false));
  }, [active?.id]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see alerts." />;

  const filtered = alerts.filter((a) => filter === "all" || a.severity === filter);
  const counts = { all: alerts.length, critical: 0, warning: 0, info: 0 };
  alerts.forEach((a) => { counts[a.severity] = (counts[a.severity] || 0) + 1; });

  const sevConfig = {
    critical: { icon: AlertCircle, color: "border-red-600 bg-red-50", iconColor: "text-red-600" },
    warning: { icon: AlertTriangle, color: "border-amber-500 bg-amber-50", iconColor: "text-amber-600" },
    info: { icon: Info, color: "border-blue-500 bg-blue-50", iconColor: "text-blue-600" },
  };

  return (
    <div className="space-y-8">
      <SectionTitle sub={`${alerts.length} alerts detected from current dataset`}>Smart Alerts</SectionTitle>

      <div className="flex gap-2 flex-wrap" data-testid="alerts-filters">
        {[
          { id: "all", label: "All", c: counts.all },
          { id: "critical", label: "Critical", c: counts.critical },
          { id: "warning", label: "Warning", c: counts.warning },
          { id: "info", label: "Info", c: counts.info },
        ].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border ${filter === f.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700"}`}
            data-testid={`alert-filter-${f.id}`}>
            {f.label} <span className="opacity-70">({f.c})</span>
          </button>
        ))}
      </div>

      {loading ? <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div> :
        filtered.length === 0 ? (
          <div className="sharp-card p-12 text-center text-sm text-slate-500">No alerts match this filter.</div>
        ) : (
          <div className="space-y-2" data-testid="alerts-list">
            {filtered.map((a, i) => {
              const cfg = sevConfig[a.severity] || sevConfig.info;
              const Icon = cfg.icon;
              return (
                <div key={i} className={`sharp-card border-l-4 ${cfg.color} p-4 flex items-start gap-3`}>
                  <Icon className={`w-5 h-5 ${cfg.iconColor} flex-shrink-0`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold">{a.title}</div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{a.type}</span>
                    </div>
                    <div className="text-sm text-slate-700 mt-1">{a.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
