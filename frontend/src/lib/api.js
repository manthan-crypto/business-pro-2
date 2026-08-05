import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach Bearer token from localStorage as fallback (in case httpOnly cookies fail).
api.interceptors.request.use((config) => {
  try {
    const t = localStorage.getItem("access_token");
    if (t) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) config.headers.Authorization = `Bearer ${t}`;
    }
  } catch (e) { /* localStorage may be unavailable */ }
  return config;
});

export default api;

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Something went wrong.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => (e?.msg || JSON.stringify(e))).join(" ");
  if (d?.msg) return d.msg;
  return String(d);
}

export const fmtINR = (v) => {
  if (v == null || isNaN(v)) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(2)} K`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const fmtNum = (v) => {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

export const fmtPct = (v) => {
  if (v == null || isNaN(v)) return "—";
  return `${Number(v).toFixed(2)}%`;
};
