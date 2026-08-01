import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function KpiCard({ label, value, sub, trend, icon: Icon, testid }) {
  const trendUp = typeof trend === "number" && trend >= 0;
  return (
    <div className="sharp-card p-5 flex flex-col gap-3" data-testid={testid}>
      <div className="flex justify-between items-start">
        <div className="kbd-label">{label}</div>
        {Icon && <Icon className="w-4 h-4 text-slate-400" strokeWidth={2} />}
      </div>
      <div className="kpi-value mono" data-testid={`${testid}-value`}>{value}</div>
      <div className="flex items-center gap-2 min-h-[20px]">
        {typeof trend === "number" && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-sm inline-flex items-center gap-1 ${
              trendUp ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
            }`}
          >
            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.toFixed(1)}%
          </span>
        )}
        {sub && <div className="text-xs text-slate-500 font-medium">{sub}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({ children, sub, action }) {
  return (
    <div className="flex items-end justify-between mb-4 border-b border-slate-300 pb-2">
      <div>
        <h2 className="text-2xl font-black tracking-tight">{children}</h2>
        {sub && <div className="text-xs text-slate-500 mt-0.5 font-medium uppercase tracking-wider">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="sharp-card p-12 text-center" data-testid="empty-state">
      <div className="text-base font-bold text-slate-900">{title}</div>
      <div className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{description}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ children, variant = "default" }) {
  const styles = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    danger: "bg-red-50 text-red-700 border border-red-200",
    warning: "bg-amber-50 text-amber-800 border border-amber-200",
    info: "bg-blue-50 text-blue-700 border border-blue-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider ${styles[variant]}`}>
      {children}
    </span>
  );
}
