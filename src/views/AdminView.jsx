import React, { useState, useEffect, useMemo } from "react";
import { ref, onValue, set, remove, push, update } from "firebase/database";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import { 
  ShieldCheck, Lock, Key, Trash2, Plus, Edit3, Save, 
  AlertTriangle, Eye, EyeOff, Database, Layers, 
  RefreshCw, ShieldAlert, CheckCircle2, Search,
  ChevronLeft, ChevronRight, X, FileSpreadsheet, Sparkles, UploadCloud, Check
} from "lucide-react";

export default function AdminView() {
  // 1. DUKUNGAN 1 KALI LOGIN (PERSISTENT SESSION STORAGE)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("syc_admin_auth") === "true";
  });

  // Auth States
  const [inputPassword, setInputPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  // Change Password States
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passMsg, setPassMsg] = useState("");

  // Data States
  const [templates, setTemplates] = useState({});
  const [sessions, setSessions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedTplId, setSelectedTplId] = useState("");
  const [search, setSearch] = useState("");

  // Direct Inline Data Edit State
  const [editingActId, setEditingActId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Template Builder States
  const [editingTplId, setEditingTplId] = useState(null);
  const [tplName, setTplName] = useState("");
  const [calcMode, setCalcMode] = useState("LATEST");
  const [fields, setFields] = useState([
    { label: "PROVINSI", type: "text" },
    { label: "KOTA_KAB", type: "text" },
    { label: "KECAMATAN", type: "text" },
    { label: "DESA_KELURAHAN", type: "text" },
    { label: "TOTAL_KK", type: "number" }
  ]);

  // SMART EXCEL TEMPLATE READER STATE
  const [smartExcelFile, setSmartExcelFile] = useState(null);
  const [smartMsg, setSmartMsg] = useState({ type: "", text: "" });

  // Modal Format Confirmation State
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [formatConfirmText, setFormatConfirmText] = useState("");
  const [formatSuccessMsg, setFormatSuccessMsg] = useState("");

  // Table Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Load Data & Admin Config dari Firebase Realtime
  useEffect(() => {
    const configRef = ref(db, "admin_config/password");
    const tplRef = ref(db, "templates");
    const sessRef = ref(db, "upload_sessions");
    const actRef = ref(db, "activities");

    onValue(configRef, (snap) => {
      if (snap.exists()) {
        setAdminPassword(snap.val());
      }
    });

    onValue(tplRef, (snap) => {
      const data = snap.val() || {};
      setTemplates(data);
      if (Object.keys(data).length > 0 && !selectedTplId) {
        setSelectedTplId(Object.keys(data)[0]);
      }
    });

    onValue(sessRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        setSessions(list.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setSessions([]);
      }
    });

    onValue(actRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        setActivities(list);
      } else {
        setActivities([]);
      }
    });
  }, []);

  // VERIFIKASI KUNCI ADMIN
  const handleLogin = (e) => {
    e.preventDefault();
    if (inputPassword === adminPassword) {
      sessionStorage.setItem("syc_admin_auth", "true");
      setIsAuthenticated(true);
      setAuthError("");
      setInputPassword("");
    } else {
      setAuthError("Kata sandi yang Anda masukkan salah. Akses ditolak!");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("syc_admin_auth");
    setIsAuthenticated(false);
  };

  // Simpan Perubahan Password Admin
  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!newPass || newPass.length < 6) {
      setPassMsg("Kata sandi baru minimal 6 karakter.");
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    set(ref(db, "admin_config/password"), newPass)
      .then(() => {
        setAdminPassword(newPass);
        setNewPass("");
        setConfirmPass("");
        setPassMsg("SUCCESS: Kata sandi Admin berhasil diperbarui!");
        setTimeout(() => setPassMsg(""), 4000);
      })
      .catch((err) => {
        setPassMsg(`Gagal memperbarui: ${err.message}`);
      });
  };

  // SMART EXCEL HEADER & TYPE DETECTOR (UPLOAD TEMPLATE EXCEL)
  const handleSmartReadExcelTemplate = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSmartExcelFile(file);
    setSmartMsg({ type: "info", text: "Membaca file Excel dan memindai header..." });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        if (json.length === 0) {
          setSmartMsg({ type: "error", text: "File Excel kosong atau tidak terbaca." });
          return;
        }

        const rawHeaders = Object.keys(json[0]);
        const detectedFields = rawHeaders.map((headerLabel) => {
          // Deteksi tipe data cerdas dari baris sampel
          let isNumeric = true;
          let sampleCount = 0;

          for (let i = 0; i < Math.min(json.length, 10); i++) {
            const val = json[i][headerLabel];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              sampleCount++;
              const cleanedVal = String(val).replace(/[^0-9.-]/g, "");
              if (isNaN(Number(cleanedVal))) {
                isNumeric = false;
                break;
              }
            }
          }

          const lblUpper = headerLabel.toUpperCase().trim();
          // Pengecualian nama wilayah selalu Teks
          if (lblUpper.includes("PROV") || lblUpper.includes("KAB") || lblUpper.includes("KOTA") || lblUpper.includes("KEC") || lblUpper.includes("DESA") || lblUpper.includes("KEL")) {
            isNumeric = false;
          }

          return {
            label: headerLabel.trim(),
            type: isNumeric && sampleCount > 0 ? "number" : "text"
          };
        });

        // Set nama template dari nama file Excel
        const defaultName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ").toUpperCase();
        setTplName(defaultName);
        setFields(detectedFields);
        setEditingTplId(null);

        setSmartMsg({
          type: "success",
          text: `SMART SYSTEM SUCCESS! ${detectedFields.length} kolom header & tipe data berhasil dipindai dari file "${file.name}". Silakan tinjau lalu klik "Buat Template Baru" di bawah.`
        });

      } catch (err) {
        setSmartMsg({ type: "error", text: `Gagal membaca template Excel: ${err.message}` });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Template Builder Helpers
  const addField = () => {
    setFields([...fields, { label: "", type: "text" }]);
  };

  const removeField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index, key, value) => {
    const updated = [...fields];
    updated[index][key] = value;
    setFields(updated);
  };

  const handleSaveTemplate = (e) => {
    e.preventDefault();
    if (!tplName.trim()) {
      alert("Nama template harus diisi.");
      return;
    }

    const cleanedFields = fields.filter(f => f.label.trim() !== "");
    if (cleanedFields.length === 0) {
      alert("Template harus memiliki minimal 1 kolom header.");
      return;
    }

    const payload = {
      template_name: tplName.trim(),
      calc_mode: calcMode,
      fields: cleanedFields,
      updated_at: Date.now()
    };

    if (editingTplId) {
      set(ref(db, `templates/${editingTplId}`), payload)
        .then(() => {
          alert("Template berhasil diperbarui!");
          resetTplForm();
        });
    } else {
      push(ref(db, "templates"), payload)
        .then(() => {
          alert("Template baru dari Smart Excel berhasil disimpan!");
          resetTplForm();
        });
    }
  };

  const handleEditTemplate = (id, tpl) => {
    setEditingTplId(id);
    setTplName(tpl.template_name || "");
    setCalcMode(tpl.calc_mode || "LATEST");
    setFields(tpl.fields || []);
  };

  const handleDeleteTemplate = (id, name) => {
    if (window.confirm(`Hapus template "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      remove(ref(db, `templates/${id}`));
    }
  };

  const resetTplForm = () => {
    setEditingTplId(null);
    setTplName("");
    setCalcMode("LATEST");
    setSmartExcelFile(null);
    setSmartMsg({ type: "", text: "" });
    setFields([
      { label: "PROVINSI", type: "text" },
      { label: "KOTA_KAB", type: "text" },
      { label: "KECAMATAN", type: "text" },
      { label: "DESA_KELURAHAN", type: "text" },
      { label: "TOTAL_KK", type: "number" }
    ]);
  };

  // Edit Baris Data Aktivitas
  const handleStartEditActivity = (act) => {
    setEditingActId(act.id);
    setEditFormData({ ...(act.data || {}) });
  };

  const handleSaveEditActivity = (actId) => {
    update(ref(db, `activities/${actId}/data`), editFormData)
      .then(() => {
        alert("Data rekor berhasil diperbarui!");
        setEditingActId(null);
      })
      .catch((err) => {
        alert(`Gagal memperbarui data: ${err.message}`);
      });
  };

  const handleDeleteSingleActivity = (actId) => {
    if (window.confirm("Hapus baris data rekor ini secara permanen?")) {
      remove(ref(db, `activities/${actId}`));
    }
  };

  // Hapus Sesi Unggahan
  const handleDeleteSession = (sessId) => {
    if (window.confirm("Hapus sesi unggahan ini beserta seluruh data aktivitas terkaitnya?")) {
      remove(ref(db, `upload_sessions/${sessId}`));
      activities.forEach((act) => {
        if (act.session_id === sessId) {
          remove(ref(db, `activities/${act.id}`));
        }
      });
    }
  };

  // FORMAT TOTAL DATABASE
  const handleExecuteFormatDatabase = () => {
    if (formatConfirmText !== "FORMAT") {
      alert("Kata kunci konfirmasi salah! Ketik 'FORMAT' dengan huruf kapital.");
      return;
    }

    Promise.all([
      remove(ref(db, "activities")),
      remove(ref(db, "upload_sessions")),
      remove(ref(db, "templates"))
    ])
      .then(() => {
        setFormatSuccessMsg("DATABASE BERHASIL DIFORMAT TOTAL! Seluruh data terhapus bersih.");
        setShowFormatModal(false);
        setFormatConfirmText("");
        setTimeout(() => setFormatSuccessMsg(""), 6000);
      })
      .catch((err) => {
        alert(`Gagal melakukan format database: ${err.message}`);
      });
  };

  // Filtered Activities
  const templateActivities = useMemo(() => {
    return activities.filter((a) => a.template_id === selectedTplId);
  }, [activities, selectedTplId]);

  const filteredActivities = useMemo(() => {
    return templateActivities.filter((act) => {
      if (!search) return true;
      return JSON.stringify(act.data || {}).toLowerCase().includes(search.toLowerCase());
    });
  }, [templateActivities, search]);

  const activeTemplate = templates[selectedTplId] || null;
  const orderedFieldLabels = useMemo(() => {
    if (activeTemplate && activeTemplate.fields) {
      return activeTemplate.fields.map((f) => f.label);
    }
    return [];
  }, [activeTemplate]);

  const paginatedActivities = useMemo(() => {
    return filteredActivities.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [filteredActivities, currentPage]);

  const totalPages = Math.ceil(filteredActivities.length / rowsPerPage) || 1;

  // JIKA BELUM TERAUTENTIKASI: LAYAR LOGIN BERSIH
  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 animate-fadeIn">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-800">Akses Mode Admin</h2>
            <p className="text-xs text-slate-400">
              Masukkan kata sandi admin untuk mengakses panel kontrol.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                MASUKKAN KATA SANDI
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  placeholder="Masukkan kata sandi admin..."
                  autoComplete="off"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-100 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" /> Masuk Kunci Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Admin Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Panel Admin & Manajemen Database Master</h2>
            <p className="text-xs text-slate-400">
              Akses Full Admin: Smart Upload Template, Full Edit Rekor, Sesi Unggah, & Password.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFormatModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition cursor-pointer"
          >
            <Trash2 className="h-4 w-4" /> Format Semua Data
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <Lock className="h-4 w-4" /> Kunci Admin (Logout)
          </button>
        </div>
      </div>

      {formatSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{formatSuccessMsg}</span>
        </div>
      )}

      {/* Grid Row: Ubah Kata Sandi & Ringkasan Database */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* KARTU PENGATURAN KATA SANDI ADMIN */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Key className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">Ganti Kata Sandi Keamanan Admin</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Kata Sandi Baru</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Minimal 6 karakter..."
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Konfirmasi Kata Sandi Baru</label>
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Ulangi kata sandi baru..."
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold outline-none focus:border-indigo-500"
              />
            </div>

            {passMsg && (
              <p className={`text-xs font-bold ${passMsg.startsWith("SUCCESS") ? "text-emerald-600" : "text-red-500"}`}>
                {passMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              Simpan Kata Sandi Baru
            </button>
          </form>
        </div>

        {/* KARTU RINGKASAN DATABASE REALTIME */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Database className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">Ringkasan Beban Database Firebase</h3>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-center">
              <span className="text-[10px] font-bold text-indigo-600 uppercase block">Template</span>
              <span className="text-2xl font-black text-indigo-900">{Object.keys(templates).length}</span>
            </div>

            <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100 text-center">
              <span className="text-[10px] font-bold text-purple-600 uppercase block">Sesi Unggah</span>
              <span className="text-2xl font-black text-purple-900">{sessions.length}</span>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
              <span className="text-[10px] font-bold text-emerald-600 uppercase block">Baris Rekor</span>
              <span className="text-2xl font-black text-emerald-900">{activities.length}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            Database Firebase terhubung secara aman dan siap melakukan perubahan data langsung.
          </p>
        </div>
      </div>

      {/* FITUR BARU: UPLOAD / GENERATE TEMPLATE OTOMATIS DARI EXCEL (SMART EXCEL TEMPLATE READER) */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-indigo-200 shadow-xs space-y-4 bg-gradient-to-br from-white via-indigo-50/20 to-white">
        <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" /> Smart Upload Template File Excel (.xlsx / .xls)
            </h3>
            <p className="text-xs text-slate-500">
              Unggah file Excel contoh untuk otomatis mendeteksi nama kolom (Header) dan tipe data (Teks/Angka) tanpa perlu mengetik manual.
            </p>
          </div>
          <span className="text-[10px] font-extrabold bg-indigo-600 text-white px-3 py-1 rounded-full uppercase">
            Smart Auto-Generator
          </span>
        </div>

        <div className="relative border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-indigo-50/40 hover:bg-indigo-50/70 rounded-3xl p-6 text-center transition cursor-pointer">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleSmartReadExcelTemplate}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="space-y-2 pointer-events-none">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-800">
                {smartExcelFile ? smartExcelFile.name : "Klik atau seret file Excel di sini untuk Ekstrak Template Otomatis"}
              </p>
              <p className="text-[11px] text-slate-400">Sistem akan secara otomatis menyusun skema header dan tipe kolom.</p>
            </div>
          </div>
        </div>

        {smartMsg.text && (
          <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            smartMsg.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
              : smartMsg.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-indigo-50 text-indigo-800 border border-indigo-200"
          }`}>
            {smartMsg.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
            {smartMsg.type === "error" && <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />}
            {smartMsg.type === "info" && <RefreshCw className="h-4 w-4 text-indigo-600 animate-spin shrink-0" />}
            <span>{smartMsg.text}</span>
          </div>
        )}
      </div>

      {/* SECTION MANAJEMEN TEMPLATE BUILDER (FULL CRUD TEMPLATES & HEADERS) */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" /> Template Builder & Pengaturan Skema Header Aktivitas
            </h3>
            <p className="text-xs text-slate-400">
              Buat, tinjau, atau sesuaikan kolom header template dan tentukan mode kalkulasi per-template.
            </p>
          </div>

          {editingTplId && (
            <button
              onClick={resetTplForm}
              className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Batal Edit (Buat Baru)
            </button>
          )}
        </div>

        {/* FORM BUAT / EDIT TEMPLATE */}
        <form onSubmit={handleSaveTemplate} className="space-y-5 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nama Template Aktivitas</label>
              <input
                type="text"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Contoh: LAPORAN BANTUAN SOSIAL 2026..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mode Kalkulasi Akumulasi</label>
              <select
                value={calcMode}
                onChange={(e) => setCalcMode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="LATEST">LATEST: Mengambil Update Sesi Terakhir Per-Wilayah</option>
                <option value="ACCUMULATE">ACCUMULATE: Akumulasi Total Semua Unggahan</option>
              </select>
            </div>
          </div>

          {/* LIST DYNAMIC FIELDS */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Daftar Kolom Header Template ({fields.length} Kolom Terdaftar)
              </label>
              <button
                type="button"
                onClick={addField}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Tambah Kolom Header Manual
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
              {fields.map((field, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(idx, "label", e.target.value)}
                    placeholder="Nama Header..."
                    className="w-full text-xs font-bold text-slate-800 outline-none"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(idx, "type", e.target.value)}
                    className="text-[10px] font-bold text-slate-500 border border-slate-200 rounded-lg px-1.5 py-1 outline-none bg-slate-50"
                  >
                    <option value="text">Teks</option>
                    <option value="number">Angka</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeField(idx)}
                    className="text-slate-300 hover:text-red-500 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer flex items-center gap-2"
          >
            <Save className="h-4 w-4" /> {editingTplId ? "Simpan Perubahan Template" : "Simpan Sebagai Template Baru"}
          </button>
        </form>

        {/* DAFTAR TEMPLATE TERSEDIA */}
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Daftar Template Aktif
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.keys(templates).length === 0 ? (
              <p className="text-xs text-slate-400 col-span-full">Belum ada template yang terdaftar.</p>
            ) : (
              Object.keys(templates).map((key) => {
                const t = templates[key];
                return (
                  <div key={key} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 hover:border-indigo-300 transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">{t.template_name}</h4>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                          Mode: {t.calc_mode || "LATEST"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditTemplate(key, t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                          title="Edit Template"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(key, t.template_name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Hapus Template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                      {(t.fields || []).map((f, i) => (
                        <span key={i} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SECTION MANAJEMEN EDIT BARIS DATA SANGAT LENGKAP */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-indigo-600" /> Modul Full Edit Data Rekor Aktivitas
            </h3>
            <p className="text-xs text-slate-400">
              Admin dapat mengedit nilai kolom baris mana saja secara langsung di tabel.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedTplId}
              onChange={(e) => { setSelectedTplId(e.target.value); setCurrentPage(1); }}
              className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-xs font-bold text-indigo-900 outline-none"
            >
              {Object.keys(templates).map((key) => (
                <option key={key} value={key}>{templates[key].template_name}</option>
              ))}
            </select>

            <div className="relative w-48">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari data..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs outline-none bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        {/* TABEL FULL EDIT ADMIN */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10">No</th>
                {orderedFieldLabels.map((header) => (
                  <th key={header} className="py-3 px-3 whitespace-nowrap">{header}</th>
                ))}
                <th className="py-3 px-3 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedActivities.length === 0 ? (
                <tr>
                  <td colSpan={orderedFieldLabels.length + 2} className="py-8 text-center text-slate-400">
                    Tidak ada data yang tersedia untuk diedit.
                  </td>
                </tr>
              ) : (
                paginatedActivities.map((act, idx) => {
                  const isEditing = editingActId === act.id;

                  return (
                    <tr key={act.id} className="hover:bg-indigo-50/20 transition">
                      <td className="py-3 px-3 font-semibold text-slate-400">
                        {(currentPage - 1) * rowsPerPage + idx + 1}
                      </td>

                      {orderedFieldLabels.map((header) => {
                        const cellVal = isEditing ? editFormData[header] : (act.data ? act.data[header] : "");

                        return (
                          <td key={header} className="py-2.5 px-3 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="text"
                                value={cellVal !== undefined ? cellVal : ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditFormData({
                                    ...editFormData,
                                    [header]: !isNaN(val) && val.trim() !== "" ? Number(val) : val
                                  });
                                }}
                                className="w-full rounded-lg border border-indigo-400 px-2 py-1 text-xs font-bold text-slate-900 bg-white outline-none"
                              />
                            ) : (
                              typeof cellVal === "number" ? cellVal.toLocaleString("id-ID") : (cellVal || "-")
                            )}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSaveEditActivity(act.id)}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                              title="Simpan Perubahan"
                            >
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingActId(null)}
                              className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                              title="Batal"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleStartEditActivity(act)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                              title="Edit Baris Data"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSingleActivity(act.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Hapus Baris Data"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            Menampilkan <span className="font-bold text-slate-700">{paginatedActivities.length}</span> dari{" "}
            <span className="font-bold text-slate-700">{filteredActivities.length}</span> data rekor
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-2">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION RIWAYAT SESI UNGGAHAN */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Manajemen Sesi Unggahan File Excel</h3>
            <p className="text-xs text-slate-400">Hapus sesi spesifik jika terdapat kesalahan unggah data.</p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
            {sessions.length} Sesi Terdaftar
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Tanggal Unggah</th>
                <th className="py-2.5 px-3">Nama File</th>
                <th className="py-2.5 px-3 text-center">Jumlah Rekor</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">Belum ada riwayat sesi unggahan.</td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-600">
                      {new Date(s.timestamp).toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{s.file_name || "File Excel"}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-indigo-700">{s.record_count || 0}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus Sesi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CONFIRMATION: FORMAT TOTAL DATABASE */}
      {showFormatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-5 shadow-2xl border border-red-100">
            <div className="flex items-center gap-3 text-red-600 border-b border-red-100 pb-3">
              <div className="p-2.5 rounded-2xl bg-red-50 border border-red-200">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Format Total Seluruh Database?</h3>
                <p className="text-xs text-red-600 font-bold">PERINGATAN BAHAYA MATI</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan <strong>MENGHAPUS BERSIH SELURUH DATA</strong> (Activities, Upload Sessions, & Templates) secara permanen di Firebase Realtime Database. Data tidak dapat dipulihkan kembali!
            </p>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-slate-400">
                Ketik <strong className="text-red-600 font-extrabold">FORMAT</strong> untuk mengonfirmasi:
              </label>
              <input
                type="text"
                value={formatConfirmText}
                onChange={(e) => setFormatConfirmText(e.target.value)}
                placeholder="FORMAT"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-red-500 uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowFormatModal(false); setFormatConfirmText(""); }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>

              <button
                onClick={handleExecuteFormatDatabase}
                disabled={formatConfirmText !== "FORMAT"}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold transition shadow-md shadow-red-100 cursor-pointer"
              >
                Format Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}