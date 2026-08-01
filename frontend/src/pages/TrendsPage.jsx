import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { SectionTitle, EmptyState, KpiCard } from "../components/Primitives";
import { fmtINR, fmtNum } from "../lib/api";
import { useDatasets } from "../context/DatasetContext";
import { LineChart, Line, Area, AreaChart, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, Calendar, Activity } from "lucide-react";

export default function TrendsPage() {
  const { active } = useDatasets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    api.get("/analytics/trends").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [active?.id]);

  if (!active) return <EmptyState title="No dataset" description="Upload data to see trends." />;
  if (loading || !data) return <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Loading...</div>;

  const fc = data.forecast;
  const tickFmt = (v) => v >= 1e7 ? `${(v/1e7).toFixed(0)}Cr` : v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v;

  return (
    <div className="space-y-8">
      <SectionTitle sub="Sales Trend Analysis">Monthly & Daily Trends</SectionTitle>

      {fc && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard testid="fc-month" label="Forecast Month" value={fc.month} icon={Calendar} />
          <KpiCard testid="fc-actual" label="Actual So Far" value={fmtINR(fc.actual_so_far)} icon={Activity} sub={`${fc.days_passed} of ${fc.total_days} days`} />
          <KpiCard testid="fc-projected" label="Month-end Projection" value={fmtINR(fc.projected)} icon={TrendingUp} />
          <KpiCard testid="fc-paceday" label="Daily Run-rate" value={fmtINR(fc.actual_so_far / Math.max(1, fc.days_passed))} icon={TrendingUp} />
        </div>
      )}

      <div className="sharp-card p-5">
        <div className="kbd-label">Monthly Sales</div>
        <div className="text-lg font-black tracking-tight mt-1 mb-4">Revenue & GP per month</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} />
              <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }} />
              <Bar dataKey="sales" fill="#002FA7" name="Sales" />
              <Bar dataKey="gp" fill="#059669" name="GP" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sharp-card p-5">
          <div className="kbd-label">Daily Sales (last 90)</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-4">Daily Trend</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} />
                <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }} />
                <Line type="monotone" dataKey="sales" stroke="#002FA7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sharp-card p-5">
          <div className="kbd-label">Running Total</div>
          <div className="text-lg font-black tracking-tight mt-1 mb-4">Cumulative Sales</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} />
                <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }} />
                <Area type="monotone" dataKey="running_total" stroke="#002FA7" fill="#002FA722" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="sharp-card p-5">
        <div className="kbd-label">Weekly Sales</div>
        <div className="text-lg font-black tracking-tight mt-1 mb-4">Recent 26 Weeks</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} />
              <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ border: "2px solid #0A0A0A", borderRadius: 2, fontSize: 12, fontWeight: 700 }} />
              <Bar dataKey="sales" fill="#0A0A0A" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
