import React, { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Activity, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@salesmis.com");
  const [password, setPassword] = useState("Admin@123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    const r = await login(email, password);
    setLoading(false);
    if (r.ok) nav("/");
    else setErr(r.error || "Login failed");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAFAFA]">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[#0A0A0A] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white flex items-center justify-center">
              <Activity className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-black text-lg tracking-tight">SALES MIS</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold -mt-0.5">Analytics OS</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="kbd-label text-slate-400 mb-3">Built for analysts</div>
          <h1 className="text-5xl font-black tracking-tighter leading-[1.05]">
            Turn raw<br/>Excel exports<br/>into <span className="text-[#5B7CFF]">decisions.</span>
          </h1>
          <p className="text-sm text-slate-300 mt-5 leading-relaxed">
            Upload your monthly outward data. Get customer, product, country and salesperson analytics — with smart alerts that flag what matters.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6">
          {[
            { v: "112+", l: "Customers" },
            { v: "2.6K", l: "Products" },
            { v: "₹27Cr", l: "Sales Tracked" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-2xl font-black mono">{s.v}</div>
              <div className="kbd-label text-slate-400 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="kbd-label">Sign in</div>
          <h2 className="text-4xl font-black tracking-tighter mt-1">Welcome back.</h2>
          <p className="text-sm text-slate-500 mt-2">Use your work email to continue.</p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="kbd-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full border border-slate-300 px-3 py-2.5 text-sm font-medium bg-white focus:outline-none focus:border-[#002FA7] focus:ring-2 focus:ring-[#002FA7]/10"
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="kbd-label">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full border border-slate-300 px-3 py-2.5 text-sm font-medium bg-white focus:outline-none focus:border-[#002FA7] focus:ring-2 focus:ring-[#002FA7]/10"
                data-testid="login-password"
              />
            </div>
            {err && <div className="text-xs text-red-600 font-bold" data-testid="login-error">{err}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#002FA7] hover:bg-[#00227A] text-white px-4 py-3 text-sm font-black uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="login-submit"
            >
              {loading ? "Signing in..." : "Sign in"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            No account?{" "}
            <Link to="/register" className="font-bold text-[#002FA7] hover:underline" data-testid="login-register-link">Create one →</Link>
          </div>

          <div className="mt-8 border border-amber-200 bg-amber-50 p-3 text-xs">
            <div className="font-bold uppercase tracking-wider text-amber-900 mb-1">Demo account</div>
            <div className="text-amber-800 mono">admin@salesmis.com / Admin@123</div>
          </div>
        </form>
      </div>
    </div>
  );
}
