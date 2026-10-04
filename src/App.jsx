import React, { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "./firebase"; // KOREKSI: ./firebase (satu titik)
import { syncToGoogleSheetsBackground } from "./utils/syncBackup"; // KOREKSI: ./utils/syncBackup

// Import Halaman Views
import DashboardView from "./views/DashboardView";
import UploadView from "./views/UploadView";
import AdminView from "./views/AdminView";

// Icons
import { LayoutDashboard, UploadCloud, ShieldCheck, RefreshCw, Database } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'upload' | 'admin'
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

  // Background Google Sheets Sync (Tidak Mengganggu UI / Tanpa Loading)
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col">
      {/* NAVBAR UTAMA */}
      <header className="no-print bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-wide text-white">
                SYC EXECUTIVE DASHBOARD
              </h1>
              <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Realtime Firebase + Auto Google Sheets Sync
              </p>
            </div>
          </div>

          {/* TAB NAVIGATION */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab("upload")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "upload"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span className="hidden sm:inline">Upload Excel</span>
            </button>

            <button
              onClick={() => setActiveTab("admin")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "admin"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Mode Admin</span>
            </button>
          </nav>
        </div>
      </header>

      {/* INDIKATOR BACKGROUND SYNC */}
      {lastSyncedTime && (
        <div className="no-print bg-indigo-950 text-indigo-200 text-[10px] font-semibold py-1 px-4 text-center border-b border-indigo-900/50 flex items-center justify-center gap-2">
          <RefreshCw className="h-3 w-3 text-emerald-400 animate-spin" />
          <span>
            Backup Google Spreadsheet Terhubung Senyap (Terakhir Sync: <strong>{lastSyncedTime} WITA</strong>)
          </span>
        </div>
      )}

      {/* TAMPILAN KONTEN HALAMAN */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === "dashboard" && (
          <DashboardView onNavigateUpload={() => setActiveTab("upload")} />
        )}
        {activeTab === "upload" && (
          <UploadView onNavigateDashboard={() => setActiveTab("dashboard")} />
        )}
        {activeTab === "admin" && <AdminView />}
      </main>
    </div>
  );
}