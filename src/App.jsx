import React, { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "./firebase";
import { syncToGoogleSheetsBackground } from "./utils/syncBackup";

// Import Seluruh Halaman Views (Lengkap Tanpa Ada yang Dikurangi)
import DashboardView from "./views/DashboardView";
import UploadView from "./views/UploadView";
import TambahDataView from "./views/TambahDataView";
import RiwayatView from "./views/RiwayatView";
import LaporanView from "./views/LaporanView";
import AdminView from "./views/AdminView";

// Icons Complete
import { 
  LayoutDashboard, UploadCloud, FilePlus, History, 
  FileText, ShieldCheck, RefreshCw, Database, Activity 
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'upload' | 'tambah' | 'riwayat' | 'laporan' | 'admin'
  const [templates, setTemplates] = useState({});
  const [activities, setActivities] = useState([]);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);

  // Synchronize Firebase Realtime Data
  useEffect(() => {
    const tplRef = ref(db, "templates");
    const actRef = ref(db, "activities");

    onValue(tplRef, (snapshot) => {
      setTemplates(snapshot.val() || {});
    });

    onValue(actRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
        setActivities(list);
      } else {
        setActivities([]);
      }
    });
  }, []);

  // Background Google Sheets Sync (Senyap tanpa mengganggu UI)
  useEffect(() => {
    if (activities.length === 0 || Object.keys(templates).length === 0) return;

    const firstTplKey = Object.keys(templates)[0];
    const activeTpl = templates[firstTplKey];

    if (!activeTpl || !activeTpl.fields) return;

    const headers = activeTpl.fields.map((f) => f.label);
    const rows = activities
      .filter((act) => act.template_id === firstTplKey)
      .map((act) => act.data || {});

    if (headers.length > 0 && rows.length > 0) {
      syncToGoogleSheetsBackground(
        activeTpl.template_name || "SYC_DATABASE_MASTER",
        headers,
        rows
      );
      setLastSyncedTime(new Date().toLocaleTimeString("id-ID"));
    }
  }, [activities, templates]);

  // Daftar Seluruh Menu Navigasi (Lengkap 6 Menu)
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "upload", label: "Upload Excel", icon: UploadCloud },
    { id: "tambah", label: "Tambah Data", icon: FilePlus },
    { id: "riwayat", label: "Riwayat", icon: History },
    { id: "laporan", label: "Laporan", icon: FileText },
    { id: "admin", label: "Mode Admin", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col antialiased">
      {/* NAVBAR UTAMA */}
      <header className="no-print bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* LOGO & BRANDING */}
          <div 
            onClick={() => setActiveTab("dashboard")}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30 group-hover:scale-105 transition">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-wide text-white flex items-center gap-2">
                SYC EXECUTIVE DASHBOARD
                <span className="hidden lg:inline-block text-[10px] font-bold bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/30">
                  PKH KALSEL
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Realtime Firebase + Auto Google Sheets Sync
              </p>
            </div>
          </div>

          {/* NAVIGASI DESKTOP (LENGKAP 6 MENU) */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

        </div>

        {/* NAVIGASI MOBILE (SCROLLABLE BAR) */}
        <div className="md:hidden border-t border-slate-800 bg-slate-900/95 overflow-x-auto px-4 py-2 flex items-center gap-2 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* INDIKATOR BACKGROUND GOOGLE SHEETS SYNC */}
      {lastSyncedTime && (
        <div className="no-print bg-indigo-950 text-indigo-200 text-[10px] font-semibold py-1 px-4 text-center border-b border-indigo-900/50 flex items-center justify-center gap-2">
          <RefreshCw className="h-3 w-3 text-emerald-400 animate-spin" />
          <span>
            Backup Google Spreadsheet Terhubung Senyap (Terakhir Sync: <strong>{lastSyncedTime} WITA</strong>)
          </span>
        </div>
      )}

      {/* TAMPILAN KONTEN UTAMA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === "dashboard" && (
          <DashboardView onNavigateUpload={() => setActiveTab("upload")} />
        )}
        {activeTab === "upload" && (
          <UploadView onNavigateDashboard={() => setActiveTab("dashboard")} />
        )}
        {activeTab === "tambah" && (
          <TambahDataView onNavigateDashboard={() => setActiveTab("dashboard")} />
        )}
        {activeTab === "riwayat" && (
          <RiwayatView onNavigateDashboard={() => setActiveTab("dashboard")} />
        )}
        {activeTab === "laporan" && <LaporanView />}
        {activeTab === "admin" && <AdminView />}
      </main>
    </div>
  );
}