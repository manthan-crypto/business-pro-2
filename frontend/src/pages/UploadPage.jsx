import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import api, { formatApiError } from "../lib/api";
import { SectionTitle, Badge } from "../components/Primitives";
import { useDatasets } from "../context/DatasetContext";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const inputRef = useRef();
  const { refresh } = useDatasets();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!file) { setErr("Please select an Excel file."); return; }
    setErr(""); setUploading(true); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    if (name) fd.append("name", name);
    try {
      const { data } = await api.post("/datasets/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(data);
      await refresh();
    } catch (e2) {
      setErr(formatApiError(e2));
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-8">
      <SectionTitle sub="Excel Ingestion">Upload Dataset</SectionTitle>

      <form onSubmit={submit} className="sharp-card p-6 max-w-3xl" data-testid="upload-form">
        <div className="kbd-label">Step 1 — Select your file</div>
        <div
          onClick={() => inputRef.current?.click()}
          className="mt-2 border-2 border-dashed border-slate-300 hover:border-[#002FA7] bg-slate-50 p-10 text-center cursor-pointer transition-colors"
          data-testid="file-dropzone"
        >
          <Upload className="w-8 h-8 mx-auto text-slate-400" strokeWidth={2} />
          <div className="mt-3 text-sm font-bold">
            {file ? file.name : "Click to select Excel file (.xls or .xlsx)"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Outward Details, Customer Top-N, or any sales export</div>
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            data-testid="file-input"
          />
        </div>

        <div className="mt-5">
          <label className="kbd-label">Dataset name (optional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. June 2026 Outward"
            className="mt-1.5 w-full border border-slate-300 px-3 py-2.5 text-sm font-medium bg-white focus:outline-none focus:border-[#002FA7]"
            data-testid="dataset-name-input"
          />
        </div>

        {err && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 font-bold" data-testid="upload-error">{err}</div>}

        <button
          type="submit"
          disabled={uploading || !file}
          className="mt-5 bg-[#002FA7] hover:bg-[#00227A] disabled:opacity-50 text-white px-5 py-2.5 text-sm font-black uppercase tracking-wider inline-flex items-center gap-2"
          data-testid="upload-submit"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {uploading ? "Parsing & analyzing..." : "Upload & Analyze"}
        </button>
      </form>

      {result && (
        <div className="sharp-card p-6 max-w-3xl border-l-4 border-emerald-600" data-testid="upload-success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div className="font-black text-lg">Upload successful</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <div className="kbd-label">Rows parsed</div>
              <div className="text-2xl font-black mono">{result.row_count.toLocaleString()}</div>
            </div>
            <div>
              <div className="kbd-label">Columns detected</div>
              <div className="text-2xl font-black mono">{result.headers.length}</div>
            </div>
            <div>
              <div className="kbd-label">Auto-mapped fields</div>
              <div className="text-2xl font-black mono">{Object.keys(result.mapping).length}/{result.canonical_fields.length}</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="kbd-label mb-2">Column Mapping</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {result.canonical_fields.map((cf) => (
                <div key={cf} className="flex items-center gap-2 border border-slate-200 p-2">
                  <div className="font-bold uppercase tracking-wider text-slate-700 w-32 truncate">{cf}</div>
                  <div className="font-mono text-slate-900 truncate flex-1">{result.mapping[cf] || "—"}</div>
                  {result.mapping[cf] ? <Badge variant="success">OK</Badge> : <Badge variant="warning">missing</Badge>}
                </div>
              ))}
            </div>
            {Object.keys(result.mapping).length < result.canonical_fields.length && (
              <div className="mt-3 bg-amber-50 border border-amber-200 p-3 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  Some canonical fields could not be auto-detected. Open the{" "}
                  <button onClick={() => nav("/datasets")} className="font-bold text-[#002FA7] hover:underline">Datasets page</button>
                  {" "}to adjust the mapping manually.
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={() => nav("/")} className="bg-[#002FA7] hover:bg-[#00227A] text-white px-4 py-2 text-xs font-black uppercase tracking-wider" data-testid="go-to-dashboard">
              Go to Dashboard →
            </button>
            <button onClick={() => nav("/data-editor")} className="border border-slate-300 hover:border-slate-900 text-slate-900 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider" data-testid="go-to-editor">
              Open Data Editor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
