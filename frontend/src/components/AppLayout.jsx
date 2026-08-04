import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { DatasetProvider } from "../context/DatasetContext";
import { CustomerDrawerProvider } from "./CustomerDrawerContext";

export default function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm font-bold uppercase tracking-wider">Loading...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <DatasetProvider>
      <CustomerDrawerProvider>
        <div className="min-h-screen bg-[#FAFAFA]">
          <Sidebar />
          <main className="ml-64 p-6 md:p-8 min-h-screen">
            <Outlet />
          </main>
        </div>
      </CustomerDrawerProvider>
    </DatasetProvider>
  );
}
