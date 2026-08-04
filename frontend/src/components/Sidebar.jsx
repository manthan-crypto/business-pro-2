import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Upload, Users, Package, Globe, TrendingUp,
  UserCheck, Bell, Pencil, Target, LogOut, Activity, Database,
  Crown, Compass, Wallet, Calendar, CalendarRange,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDatasets } from "../context/DatasetContext";

const NAV = [
  { section: "OVERVIEW" },
  { to: "/", label: "Overview", icon: LayoutDashboard, testid: "nav-overview" },
  { to: "/upload", label: "Upload Data", icon: Upload, testid: "nav-upload" },
  { section: "ANALYTICS" },
  { to: "/customers", label: "Customers", icon: Users, testid: "nav-customers" },
  { to: "/products", label: "Products", icon: Package, testid: "nav-products" },
  { to: "/countries", label: "Countries", icon: Globe, testid: "nav-countries" },
  { to: "/trends", label: "Trends", icon: TrendingUp, testid: "nav-trends" },
  { to: "/quarterly", label: "Quarterly (QBR)", icon: Calendar, testid: "nav-quarterly" },
  { to: "/customer-monthly", label: "Customer × Month", icon: CalendarRange, testid: "nav-customer-monthly" },
  { to: "/salespersons", label: "Sales Team", icon: UserCheck, testid: "nav-salespersons" },
  { to: "/alerts", label: "Smart Alerts", icon: Bell, testid: "nav-alerts" },
  { section: "EXECUTIVE" },
  { to: "/ceo", label: "CEO Dashboard", icon: Crown, testid: "nav-ceo" },
  { to: "/sales-director", label: "Sales Director", icon: Compass, testid: "nav-sd" },
  { to: "/finance", label: "Finance", icon: Wallet, testid: "nav-finance" },
  { section: "MANAGE" },
  { to: "/data-editor", label: "Data Editor", icon: Pencil, testid: "nav-data-editor" },
  { to: "/targets", label: "Targets", icon: Target, testid: "nav-targets" },
  { to: "/datasets", label: "Datasets", icon: Database, testid: "nav-datasets" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { active } = useDatasets();
  const nav = useNavigate();

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <aside className="w-64 fixed h-screen border-r border-slate-200 bg-white flex flex-col" data-testid="sidebar">
      <div className="px-5 py-5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#002FA7] flex items-center justify-center rounded-sm">
            <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-black text-base tracking-tight">SALES MIS</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold -mt-0.5">Analytics OS</div>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
        <div className="kbd-label">Active Dataset</div>
        <div className="text-sm font-bold mt-1 truncate" data-testid="active-dataset-name">
          {active ? active.name : "— No data loaded —"}
        </div>
        {active && (
          <div className="text-xs text-slate-500 mono mt-0.5">
            {active.row_count.toLocaleString()} rows
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((n, idx) => {
          if (n.section) {
            return (
              <div key={`sec-${idx}`} className="px-5 pt-4 pb-1 text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
                {n.section}
              </div>
            );
          }
          return (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testid}
              end={n.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2 text-sm font-bold transition-colors border-l-2 ${
                  isActive
                    ? "bg-[#002FA7]/5 text-[#002FA7] border-[#002FA7]"
                    : "text-slate-700 border-transparent hover:bg-slate-50"
                }`
              }
            >
              <n.icon className="w-4 h-4" strokeWidth={2} />
              {n.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-5 py-3 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{user?.name || user?.email}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{user?.role || "user"}</div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="p-2 hover:bg-slate-100 rounded-sm transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
