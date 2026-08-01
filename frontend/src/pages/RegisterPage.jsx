import React, { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    const r = await register(email, password, name);
    setLoading(false);
    if (r.ok) nav("/");
    else setErr(r.error || "Registration failed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAFAFA]">
      <form onSubmit={submit} className="w-full max-w-md sharp-card p-8" data-testid="register-form">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-[#002FA7] flex items-center justify-center"><Activity className="w-4 h-4 text-white" /></div>
          <div className="font-black tracking-tight">SALES MIS</div>
        </div>
        <h2 className="text-3xl font-black tracking-tighter">Create your account</h2>
        <p className="text-sm text-slate-500 mt-1">Start analyzing your sales data in minutes.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="kbd-label">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full border border-slate-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#002FA7]" data-testid="register-name" />
          </div>
          <div>
            <label className="kbd-label">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full border border-slate-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#002FA7]" data-testid="register-email" />
          </div>
          <div>
            <label className="kbd-label">Password (min 6 chars)</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full border border-slate-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#002FA7]" data-testid="register-password" />
          </div>
          {err && <div className="text-xs text-red-600 font-bold" data-testid="register-error">{err}</div>}
          <button type="submit" disabled={loading} className="w-full bg-[#002FA7] hover:bg-[#00227A] text-white px-4 py-3 text-sm font-black uppercase tracking-wider disabled:opacity-50" data-testid="register-submit">
            {loading ? "Creating..." : "Create account"}
          </button>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          Already have an account? <Link to="/login" className="font-bold text-[#002FA7] hover:underline">Sign in →</Link>
        </div>
      </form>
    </div>
  );
}
