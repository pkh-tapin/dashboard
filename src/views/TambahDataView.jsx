import React, { useEffect, useState } from "react";
import { ref, onValue, push, update } from "firebase/database";
import { db } from "../firebase";
import { parseExcelFileFast } from "../utils/excelSmartParser";
import { 
  UploadCloud, FileSpreadsheet, CheckCircle2, Sparkles, UserPlus, Send, Loader2
} from "lucide-react";

export default function AddDataView({ onUploadSuccess }) {
  const [templates, setTemplates] = useState({});
  const [selectedTplId, setSelectedTplId] = useState("AUTO"); // AUTO | TemplateID
  const [activeTab, setActiveTab] = useState("EXCEL"); // EXCEL | MANUAL

  // Excel Upload States
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  // Manual Form State
  const [manualFormData, setManualFormData] = useState({});
  const [isSavingManual, setIsSavingManual] = useState(false);

  useEffect(() => {
    const tplRef = ref(db, "templates");
    onValue(tplRef, (snapshot) => {
      setTemplates(snapshot.val() || {});
    });
  }, []);

  const activeTemplate = selectedTplId !== "AUTO" ? templates[selectedTplId] : null;

  // HANDLER UPLOAD EXCEL INSTAN DENGAN FIREBASE ATOMIC BATCH
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsProcessing(true);
    setUploadStatusText("Membaca Header & Mengurai Data Excel...");

    // Beri jeda 50ms agar UI Spinner sempat merender tanpa lag
    await new Promise((res) => setTimeout(res, 50));

    try {
      const templateFields = activeTemplate ? activeTemplate.fields || [] : [];
      
      // 1. Parse File Excel Super Cepat
      const { rows: parsedRows, detectedHeaderRow } = await parseExcelFileFast(file, templateFields);

      if (parsedRows.length === 0) {
        setIsProcessing(false);
        return alert("File Excel kosong atau format header tidak terdeteksi!");
      }

      setUploadStatusText(`Menyimpan ${parsedRows.length} baris data secara instan...`);
      await new Promise((res) => setTimeout(res, 50));

      // 2. Tentukan Template ID (Auto-detect atau Terpilih)
      let targetTplId = selectedTplId;
      if (targetTplId === "AUTO") {
        const tplKeys = Object.keys(templates);
        targetTplId = tplKeys.length > 0 ? tplKeys[0] : "DEFAULT_TPL";
      }

      // 3. FIREBASE ATOMIC SINGLE BATCH PAYLOAD (Simpan 680+ baris sekaligus)
      const sessionRefKey = push(ref(db, "upload_sessions")).key;
      const batchUpdates = {};

      batchUpdates[`upload_sessions/${sessionRefKey}`] = {
        session_title: file.name,
        template_id: targetTplId,
        timestamp: Date.now(),
        total_items: parsedRows.length,
        detected_header_row: detectedHeaderRow
      };

      parsedRows.forEach((rowData) => {
        const actKey = push(ref(db, "activities")).key;
        batchUpdates[`activities/${actKey}`] = {
          template_id: targetTplId,
          session_id: sessionRefKey,
          data: rowData,
          created_at: Date.now()
        };
      });

      // Transaksi Tunggal ke Firebase (~200 milidetik)
      await update(ref(db), batchUpdates);

      setIsProcessing(false);
      alert(`Berhasil mengunggah ${parsedRows.length} baris data secara instan!`);
      if (onUploadSuccess) onUploadSuccess();

    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      alert("Gagal membaca atau menyimpan file Excel: " + err.message);
    }
  };

  // HANDLER SIMPAN FORM MANUAL
  const handleSaveManualForm = async (e) => {
    e.preventDefault();
    if (selectedTplId === "AUTO" || !activeTemplate) {
      return alert("Silakan pilih Template Spesifik terlebih dahulu di dropdown atas untuk mengisi Form Manual!");
    }

    setIsSavingManual(true);

    try {
      const sessionRefKey = push(ref(db, "upload_sessions")).key;
      const actKey = push(ref(db, "activities")).key;
      const batchUpdates = {};

      batchUpdates[`upload_sessions/${sessionRefKey}`] = {
        session_title: `Entry Manual (${new Date().toLocaleDateString("id-ID")})`,
        template_id: selectedTplId,
        timestamp: Date.now(),
        total_items: 1,
        detected_header_row: 1
      };

      batchUpdates[`activities/${actKey}`] = {
        template_id: selectedTplId,
        session_id: sessionRefKey,
        data: manualFormData,
        created_at: Date.now()
      };

      await update(ref(db), batchUpdates);

      setIsSavingManual(false);
      setManualFormData({});
      alert("Data manual berhasil disimpan!");
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setIsSavingManual(false);
      alert("Gagal menyimpan data manual: " + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Selector Kategori Template */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
          Pilih Kategori Template
        </label>
        <p className="text-xs text-slate-400">Gunakan Smart Auto-Detect atau pilih template manual</p>

        <select
          value={selectedTplId}
          onChange={(e) => setSelectedTplId(e.target.value)}
          className="w-full rounded-2xl border border-indigo-200 bg-indigo-50/40 px-4 py-3 text-xs font-bold text-indigo-900 outline-none focus:border-indigo-500"
        >
          <option value="AUTO">✨ Smart Auto-Detect Template (Otomatis)</option>
          {Object.keys(templates).map((id) => (
            <option key={id} value={id}>
              {templates[id].template_name}
            </option>
          ))}
        </select>
      </div>

      {/* Switcher Mode Input (Upload Excel vs Form Manual) */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab("EXCEL")}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === "EXCEL" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" /> Upload Excel (Smart Reading)
        </button>

        <button
          onClick={() => setActiveTab("MANUAL")}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === "MANUAL" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserPlus className="h-4 w-4" /> Form Manual
        </button>
      </div>

      {/* TAB 1: UPLOAD EXCEL (FAST SMART READING) */}
      {activeTab === "EXCEL" && (
        <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-indigo-200 shadow-xs text-center relative overflow-hidden">
          {isProcessing ? (
            <div className="py-12 space-y-4">
              <Loader2 className="mx-auto h-10 w-10 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-700">{uploadStatusText}</p>
              <p className="text-[11px] text-slate-400">{uploadedFileName}</p>
            </div>
          ) : (
            <div className="py-8 space-y-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <UploadCloud className="h-8 w-8" />
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base">Unggah Berkas Excel (.xlsx, .xls)</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Sistem mengurai file secara instan tanpa lag. Header baris otomatis terdeteksi presisi.
                </p>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition cursor-pointer active:scale-95">
                  <UploadCloud className="h-4 w-4" /> Pilih File Excel
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FORM MANUAL */}
      {activeTab === "MANUAL" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-base">Entry Data Manual</h3>
            <p className="text-xs text-slate-400">
              {activeTemplate
                ? `Isi formulir berikut sesuai skema template "${activeTemplate.template_name}"`
                : "Pilih template spesifik terlebih dahulu pada dropdown di atas!"}
            </p>
          </div>

          {!activeTemplate ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
              Silakan pilih Template Kegiatan spesifik terlebih dahulu pada bagian dropdown di atas.
            </div>
          ) : (
            <form onSubmit={handleSaveManualForm} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(activeTemplate.fields || []).map((f) => (
                  <div key={f.id} className="space-y-1">
                    <label className="block text-xs font-bold text-slate-600 uppercase">
                      {f.label}
                    </label>
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={manualFormData[f.label] || ""}
                      onChange={(e) =>
                        setManualFormData({
                          ...manualFormData,
                          [f.label]: f.type === "number" ? e.target.value : e.target.value
                        })
                      }
                      placeholder={`Masukkan ${f.label}`}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs outline-none focus:border-indigo-500 bg-slate-50/50"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSavingManual}
                  className="w-full rounded-2xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  {isSavingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Simpan Data Manual
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}