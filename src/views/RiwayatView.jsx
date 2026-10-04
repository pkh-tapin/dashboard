import React, { useState, useEffect, useMemo } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db } from "../firebase";
import { 
  History, Search, Calendar, FileSpreadsheet, Trash2, Eye, 
  RefreshCw, Layers, Clock, Filter, ArrowLeft, Building2,
  CheckCircle2, AlertCircle, ExternalLink, ChevronLeft, ChevronRight
} from "lucide-react";

export default function RiwayatView({ onNavigateDashboard }) {
  const [sessions, setSessions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [templates, setTemplates] = useState({});
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTemplate, setFilterTemplate] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    const sessRef = ref(db, "upload_sessions");
    const actRef = ref(db, "activities");
    const tplRef = ref(db, "templates");

    onValue(tplRef, (snap) => {
      setTemplates(snap.val() || {});
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

  // Filter Sesi berdasarkan pencarian dan template
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterTemplate && s.template_id !== filterTemplate) return false;
      if (search) {
        const term = search.toLowerCase();
        const fileName = (s.file_name || "").toLowerCase();
        const tplName = (templates[s.template_id]?.template_name || "").toLowerCase();
        return fileName.includes(term) || tplName.includes(term);
      }
      return true;
    });
  }, [sessions, search, filterTemplate, templates]);

  // Data aktivitas per sesi yang dipilih
  const sessionActivities = useMemo(() => {
    if (!selectedSessionId) return [];
    return activities.filter((a) => a.session_id === selectedSessionId);
  }, [activities, selectedSessionId]);

  const activeSessionInfo = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  const activeSessionTemplate = useMemo(() => {
    if (!activeSessionInfo) return null;
    return templates[activeSessionInfo.template_id] || null;
  }, [activeSessionInfo, templates]);

  // Hapus Sesi Unggahan
  const handleDeleteSession = (sessId, fileName) => {
    if (window.confirm(`Hapus sesi unggahan "${fileName || 'File'}" beserta seluruh data kinerjanya?`)) {
      remove(ref(db, `upload_sessions/${sessId}`));
      activities.forEach((act) => {
        if (act.session_id === sessId) {
          remove(ref(db, `activities/${act.id}`));
        }
      });
      if (selectedSessionId === sessId) {
        setSelectedSessionId(null);
      }
    }
  };

  // Pagination untuk Detail Sesi
  const totalPages = Math.ceil(sessionActivities.length / rowsPerPage) || 1;
  const paginatedActivities = useMemo(() => {
    return sessionActivities.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [sessionActivities, currentPage]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HERO BANNER RIWAYAT */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur-md border border-white/20">
              <History className="h-3.5 w-3.5 text-amber-300" /> Log Sesi & Audit Trail
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Riwayat Unggahan & Aktivitas System
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Memantau riwayat berkas Excel yang diunggah, waktu eksekusi, serta rincian rekor aktivitas terdaftar.
            </p>
          </div>

          <button
            onClick={onNavigateDashboard}
            className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs sm:text-sm font-bold text-slate-900 shadow-lg hover:bg-slate-100 transition active:scale-95 cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
          </button>
        </div>
      </div>

      {/* FILTER & PENCARIAN SESI */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama file Excel atau nama template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs font-semibold outline-none focus:border-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterTemplate}
            onChange={(e) => setFilterTemplate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="">Semua Template</option>
            {Object.keys(templates).map((k) => (
              <option key={k} value={k}>{templates[k].template_name}</option>
            ))}
          </select>

          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100 whitespace-nowrap">
            {filteredSessions.length} Sesi Terdata
          </span>
        </div>
      </div>

      {/* MODAL / VIEW DETAIL SESI UNGGAHAN */}
      {selectedSessionId && activeSessionInfo && (
        <div className="bg-white rounded-3xl border border-indigo-200 shadow-lg p-6 space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-md">
                Detail Sesi Unggahan Selected
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-indigo-600" /> {activeSessionInfo.file_name || "File Excel"}
              </h3>
              <p className="text-xs text-slate-400">
                Waktu Unggah: <strong>{new Date(activeSessionInfo.timestamp).toLocaleString("id-ID", { dateStyle: 'full', timeStyle: 'medium' })}</strong> | Template: <strong>{activeSessionTemplate?.template_name || "-"}</strong>
              </p>
            </div>

            <button
              onClick={() => setSelectedSessionId(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
            >
              Tutup Detail Sesi
            </button>
          </div>

          {/* TABEL RINCIAN DATA SESI */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10">No</th>
                  {(activeSessionTemplate?.fields || []).map((f) => (
                    <th key={f.label} className="py-2.5 px-3 whitespace-nowrap">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedActivities.length === 0 ? (
                  <tr>
                    <td colSpan={(activeSessionTemplate?.fields?.length || 0) + 1} className="py-6 text-center text-slate-400">
                      Tidak ada baris data untuk sesi ini.
                    </td>
                  </tr>
                ) : (
                  paginatedActivities.map((act, idx) => (
                    <tr key={act.id || idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-400">
                        {(currentPage - 1) * rowsPerPage + idx + 1}
                      </td>
                      {(activeSessionTemplate?.fields || []).map((f) => {
                        const val = act.data ? act.data[f.label] : "";
                        return (
                          <td key={f.label} className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                            {typeof val === "number" ? val.toLocaleString("id-ID") : (val || "-")}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION DETAIL SESI */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">
              Menampilkan <span className="font-bold text-slate-700">{paginatedActivities.length}</span> dari{" "}
              <span className="font-bold text-slate-700">{sessionActivities.length}</span> rekor
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 px-2">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAFTAR KARTU SESI UNGGAHAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSessions.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <History className="h-12 w-12 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700">Belum Ada Riwayat Sesi Unggahan</h4>
            <p className="text-xs text-slate-400">Seluruh sesi unggah file Excel akan tercatat di halaman ini.</p>
          </div>
        ) : (
          filteredSessions.map((sess) => {
            const tplName = templates[sess.template_id]?.template_name || "Template Standar";

            return (
              <div 
                key={sess.id} 
                className={`p-5 rounded-3xl border bg-white space-y-4 shadow-xs hover:border-indigo-300 transition ${
                  selectedSessionId === sess.id ? "border-indigo-600 ring-2 ring-indigo-100" : "border-slate-200"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm truncate max-w-[160px]">
                        {sess.file_name || "File Excel"}
                      </h4>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        {tplName}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
                    {sess.record_count || 0} Baris
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(sess.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedSessionId(sess.id);
                        setCurrentPage(1);
                      }}
                      className="p-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" /> Lihat
                    </button>

                    <button
                      onClick={() => handleDeleteSession(sess.id, sess.file_name)}
                      className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition cursor-pointer"
                      title="Hapus Sesi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}