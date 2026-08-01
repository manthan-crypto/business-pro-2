import React, { useState } from "react";
import { Download, FileText } from "lucide-react";
import api, { API } from "../lib/api";

/**
 * ExportBar: shows Download buttons for PDF and/or Excel.
 * pdfUrl / xlsxUrl are RELATIVE api paths, e.g. "/reports/ceo.pdf"
 */
export default function ExportBar({ pdfUrl, xlsxUrl, filename, testid }) {
  const [busy, setBusy] = useState("");

  const download = async (url, name, kind) => {
    setBusy(kind);
    try {
      const res = await api.get(url, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      alert("Export failed: " + (e?.message || "unknown"));
    } finally { setBusy(""); }
  };

  return (
    <div className="flex gap-2" data-testid={testid}>
      {pdfUrl && (
        <button
          onClick={() => download(pdfUrl, filename || "report.pdf", "pdf")}
          disabled={busy === "pdf"}
          className="border border-slate-300 hover:border-slate-900 bg-white text-slate-900 px-3 py-1.5 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 disabled:opacity-50"
          data-testid={`${testid}-pdf`}
        >
          <FileText className="w-3.5 h-3.5" />
          {busy === "pdf" ? "..." : "PDF"}
        </button>
      )}
      {xlsxUrl && (
        <button
          onClick={() => download(xlsxUrl, filename || "report.xlsx", "xlsx")}
          disabled={busy === "xlsx"}
          className="border border-slate-300 hover:border-slate-900 bg-white text-slate-900 px-3 py-1.5 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 disabled:opacity-50"
          data-testid={`${testid}-xlsx`}
        >
          <Download className="w-3.5 h-3.5" />
          {busy === "xlsx" ? "..." : "Excel"}
        </button>
      )}
    </div>
  );
}
