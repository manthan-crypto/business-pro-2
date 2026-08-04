import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import OverviewPage from "@/pages/OverviewPage";
import UploadPage from "@/pages/UploadPage";
import CustomersPage from "@/pages/CustomersPage";
import ProductsPage from "@/pages/ProductsPage";
import CountriesPage from "@/pages/CountriesPage";
import TrendsPage from "@/pages/TrendsPage";
import SalespersonsPage from "@/pages/SalespersonsPage";
import AlertsPage from "@/pages/AlertsPage";
import DataEditorPage from "@/pages/DataEditorPage";
import TargetsPage from "@/pages/TargetsPage";
import DatasetsPage from "@/pages/DatasetsPage";

import CeoDashboardPage from "@/pages/CeoDashboardPage";
import SalesDirectorDashboardPage from "@/pages/SalesDirectorDashboardPage";
import FinanceDashboardPage from "@/pages/FinanceDashboardPage";
import QuarterlyPage from "@/pages/QuarterlyPage";
import CustomerMonthlyPage from "@/pages/CustomerMonthlyPage";

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/countries" element={<CountriesPage />} />
              <Route path="/trends" element={<TrendsPage />} />
              <Route path="/quarterly" element={<QuarterlyPage />} />
              <Route path="/customer-monthly" element={<CustomerMonthlyPage />} />
              <Route path="/salespersons" element={<SalespersonsPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/ceo" element={<CeoDashboardPage />} />
              <Route path="/sales-director" element={<SalesDirectorDashboardPage />} />
              <Route path="/finance" element={<FinanceDashboardPage />} />
              <Route path="/data-editor" element={<DataEditorPage />} />
              <Route path="/targets" element={<TargetsPage />} />
              <Route path="/datasets" element={<DatasetsPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
