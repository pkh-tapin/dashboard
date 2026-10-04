import React, { useState, useEffect } from "react";
import { ref, onValue, push, set } from "firebase/database";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import { syncToGoogleSheetsBackground } from "../utils/syncBackup";
import { 
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, 
  ArrowLeft, RefreshCw, FileText, Download, Sparkles
} from "lucide-react";

export default function UploadView({ onNavigateDashboard }) {
  const [templates, setTemplates] = useState({});
  const [selectedTplId, setSelectedTplId] = useState("");
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  // Load Templates dari Firebase
  useEffect(() => {
    const tplRef = ref(db, "templates");
    onValue(tplRef, (snapshot) => {
      const data = snapshot.val() || {};
      setTemplates(data);
      if (Object.keys(data).length > 0 && !selectedTplId) {
        setSelectedTplId(Object.keys(data)[0]);
      }
    });
  }, []);

  const activeTemplate = templates[selectedTplId] || null;

  // FITUR DOWNLOAD FORMAT TEMPLATE EXCEL (.XLSX)
  const handleDownloadTemplate = () => {
    if (!activeTemplate || !activeTemplate.fields) {
      alert("Silakan pilih template terlebih dahulu.");
      return;
    }

    const sampleRow = {};
    activeTemplate.fields.forEach((f) => {
      const lbl = f.label.toUpperCase();
      if (lbl.includes("PROV")) sampleRow[f.label] = "KALIMANTAN SELATAN";
      else if (lbl.includes("KAB") || lbl.includes("KOTA")) sampleRow[f.label] = "KABUPATEN TAPIN";
      else if (lbl.includes("KEC")) sampleRow[f.label] = "TAPIN UTARA";
      else if (lbl.includes("DESA") || lbl.includes("KEL")) sampleRow[f.label] = "RANTAU KIWA";
      else if (f.type === "number") sampleRow[f.label] = 100;
      else sampleRow[f.label] = "Contoh Teks";
    });

    const worksheet = XLSX.utils.json_to_sheet([sampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Format_Isian");

    const cleanFileName = `Format_${activeTemplate.template_name.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(workbook, cleanFileName);
  };

  // Reading File Excel Presisi Tipe Data
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStatusMsg({ type: "", text: "" });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        if (json.length === 0) {
          setStatusMsg({ type: "error", text: "File Excel kosong atau format tidak terbaca." });
          return;
        }

        const extractedHeaders = Object.keys(json[0]);
        setHeaders(extractedHeaders);
        setParsedData(json);
      } catch (err) {
        setStatusMsg({ type: "error", text: `Gagal membaca file Excel: ${err.message}` });
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  // Simpan Data Ke Firebase & Sync Google Sheets Background
  const handleUploadToFirebase = async () => {
    if (!selectedTplId) {
      alert("Silakan pilih template aktivitas terlebih dahulu.");
      return;
    }
    if (parsedData.length === 0) {
      alert("Tidak ada data Excel yang siap diunggah.");
      return;
    }

    setIsProcessing(true);
    setStatusMsg({ type: "info", text: "Memproses unggah data ke Firebase..." });

    try {
      // 1. Buat Record Sesi Unggah Baru
      const sessRef = push(ref(db, "upload_sessions"));
      const sessionId = sessRef.key;

      const sessionPayload = {
        template_id: selectedTplId,
        file_name: file ? file.name : "Data_Excel.xlsx",
        record_count: parsedData.length,
        timestamp: Date.now()
      };
      await set(sessRef, sessionPayload);

      // 2. Simpan Setiap Baris Rekor Dengan Validasi Tipe Data Presisi
      const activitiesRef = ref(db, "activities");
      const templateFields = activeTemplate ? activeTemplate.fields : [];

      for (const row of parsedData) {
        const cleanedRowData = {};

        templateFields.forEach((fieldObj) => {
          const fieldLabel = fieldObj.label;
          const fieldType = fieldObj.type || "text";

          // Pencarian Key Fuzzy Case-Insensitive
          let rawVal = row[fieldLabel];
          if (rawVal === undefined || rawVal === null) {
            const keyMatch = Object.keys(row).find(
              (k) => k.trim().toLowerCase() === fieldLabel.trim().toLowerCase()
            );
            rawVal = keyMatch ? row[keyMatch] : "";
          }

          // PARSING PRESISI TANPA MERUBAH TEKS JADI 0
          if (fieldType === "number") {
            if (typeof rawVal === "number") {
              cleanedRowData[fieldLabel] = isNaN(rawVal) ? 0 : rawVal;
            } else if (typeof rawVal === "string" && rawVal.trim() !== "") {
              const numCleaned = rawVal.replace(/[^0-9.-]/g, "");
              const num = parseFloat(numCleaned);
              cleanedRowData[fieldLabel] = isNaN(num) ? 0 : num;
            } else {
              cleanedRowData[fieldLabel] = 0;
            }
          } else {
            // Kolom Teks / Wilayah (Prov, Kab, Kec, Desa) KUNCI MATI tetap String
            cleanedRowData[fieldLabel] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : "";
          }
        });

        const newActRef = push(activitiesRef);
        await set(newActRef, {
          template_id: selectedTplId,
          session_id: sessionId,
          data: cleanedRowData,
          created_at: Date.now()
        });
      }

      // 3. PANGGIL BACKUP SILENT BACKGROUND KE GOOGLE SHEETS
      const headerLabels = templateFields.map(f => f.label);
      syncToGoogleSheetsBackground(
        activeTemplate ? activeTemplate.template_name : "SYC_DATABASE_MASTER",
        headerLabels,
        parsedData
      );

      setIsProcessing(false);
      setStatusMsg({
        type: "success",
        text: `BERHASIL! ${parsedData.length} baris rekor wilayah telah diunggah & dibackup senyap ke Google Sheets.`
      });

      // Reset
      setFile(null);
      setParsedData([]);
      setHeaders([]);

    } catch (err) {
      setIsProcessing(false);
      setStatusMsg({ type: "error", text: `Gagal mengunggah data: ${err.message}` });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Unggah File Excel Laporan Wilayah</h2>
            <p className="text-xs text-slate-400">
              Impor data dari spreadsheet Excel (.xlsx / .xls) secara presisi ke database master.
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateDashboard}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
        </button>
      </div>

      {/* Selector Template & Download Format Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              1. Pilih Target Template Aktivitas
            </label>
            <select
              value={selectedTplId}
              onChange={(e) => setSelectedTplId(e.target.value)}
              className="w-full rounded-2xl border border-indigo-200 bg-indigo-50/50 px-4 py-3 text-xs font-bold text-indigo-900 outline-none focus:border-indigo-500"
            >
              {Object.keys(templates).map((key) => (
                <option key={key} value={key}>{templates[key].template_name}</option>
              ))}
            </select>
          </div>

          {/* TOMBOL DOWNLOAD FORMAT EXCEL RESMI */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-100 transition active:scale-95 cursor-pointer shrink-0"
          >
            <Download className="h-4 w-4" /> Download Format Excel (.xlsx)
          </button>
        </div>

        {/* Dropzone Upload */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            2. Pilih / Seret File Excel Terisi
          </label>
          <div className="relative border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-3xl p-8 text-center transition cursor-pointer">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-3 pointer-events-none">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-800">
                  {file ? file.name : "Klik atau seret file Excel di sini"}
                </p>
                <p className="text-xs text-slate-400">Format yang didukung: .XLSX, .XLS, .CSV</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg.text && (
          <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
              : statusMsg.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-indigo-50 text-indigo-800 border border-indigo-200"
          }`}>
            {statusMsg.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
            {statusMsg.type === "error" && <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />}
            {statusMsg.type === "info" && <RefreshCw className="h-5 w-5 text-indigo-600 animate-spin shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Preview Data Excel */}
        {parsedData.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" /> Pratinjau Data ({parsedData.length} Baris Terdeteksi)
              </h3>
              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg">
                {headers.length} Kolom
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-60">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    {headers.map((h) => (
                      <th key={h} className="py-2.5 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-400">{idx + 1}</td>
                      {headers.map((h) => (
                        <td key={h} className="py-2 px-3 whitespace-nowrap max-w-xs truncate font-medium text-slate-800">
                          {row[h] !== undefined ? String(row[h]) : "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleUploadToFirebase}
              disabled={isProcessing}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-3 text-xs font-extrabold text-white shadow-lg shadow-indigo-100 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Memproses Unggahan...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Konfirmasi & Simpan ke Database
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}