import React, { useEffect, useState, useMemo } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db } from "../firebase";
import { 
  History, Clock, Trash2, ArrowUpRight, ArrowDownRight, Minus, Search, Layers, FileSpreadsheet
} from "lucide-react";

export default function HistoryView() {
  const [sessions, setSessions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [templates, setTemplates] = useState({});
  const [selectedTplId, setSelectedTplId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const sessRef = ref(db, "upload_sessions");
    const actRef = ref(db, "activities");
    const tplRef = ref(db, "templates");

    onValue(tplRef, (snapshot) => {
      const data = snapshot.val() || {};
      setTemplates(data);
      if (Object.keys(data).length > 0 && !selectedTplId) {
        setSelectedTplId(Object.keys(data)[0]);
      }
    });

    onValue(sessRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
        setSessions(list.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setSessions([]);
      }
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

  // ANALISA LENGKAP KRONOLOGIS SEMUA SESI UPDATE PER-KABUPATEN
  const detailedSessionLogs = useMemo(() => {
    if (!selectedTplId) return [];

    const tplSessions = sessions.filter((s) => s.template_id === selectedTplId);
    const tplActivities = activities.filter((a) => a.template_id === selectedTplId);

    // Grouping per Wilayah untuk Menghitung Selisih Penambahan dari Update ke Update
    const regionChronologicalMap = {};

    tplSessions.forEach((sess) => {
      const sessActs = tplActivities.filter((a) => a.session_id === sess.id);
      
      let detectedKab = "Kab. Tapin / Se-Kalsel";
      sessActs.forEach((act) => {
        const d = act.data || {};
        Object.keys(d).forEach((k) => {
          if (k.toLowerCase().includes("kabupaten") || k.toLowerCase().includes("kota") || k.toLowerCase().includes("kab")) {
            detectedKab = String(d[k]).trim();
          }
        });
      });

      if (!regionChronologicalMap[detectedKab]) {
        regionChronologicalMap[detectedKab] = [];
      }

      regionChronologicalMap[detectedKab].push({
        id: sess.id,
        sessionTitle: sess.session_title,
        timestamp: sess.timestamp,
        totalRows: sessActs.length > 0 ? sessActs.length : (sess.total_items || 0),
        detectedKab
      });
    });

    const finalLogs = [];

    // Hitung Selisih Urut Kronologis (ASC -> DESC)
    Object.keys(regionChronologicalMap).forEach((kab) => {
      const ascHistory = [...regionChronologicalMap[kab]].sort((a, b) => a.timestamp - b.timestamp);

      ascHistory.forEach((item, idx) => {
        const prevItem = idx > 0 ? ascHistory[idx - 1] : null;
        const delta = prevItem ? (item.totalRows - prevItem.totalRows) : 0;

        finalLogs.push({
          ...item,
          prevRows: prevItem ? prevItem.totalRows : item.totalRows,
          deltaRows: delta,
          isInitial: idx === 0
        });
      });
    });

    return finalLogs.sort((a, b) => b.timestamp - a.timestamp);
  }, [sessions, activities, selectedTplId]);

  const handleDeleteSession = async (sessId) => {
    if (!confirm("Hapus riwayat sesi unggahan ini beserta seluruh baris datanya?")) return;

    try {
      await remove(ref(db, `upload_sessions/${sessId}`));
      const relatedActs = activities.filter((a) => a.session_id === sessId);
      for (const act of relatedActs) {
        await remove(ref(db, `activities/${act.id}`));
      }
      alert("Sesi unggahan berhasil dihapus!");
    } catch (err) {
      alert("Gagal menghapus sesi: " + err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600" /> Riwayat Update & Analisa Perkembangan Data
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Merekam seluruh jejak waktu update (Data Awal hingga Update Mutakhir per-wilayah).
          </p>
        </div>

        <select
          value={selectedTplId}
          onChange={(e) => setSelectedTplId(e.target.value)}
          className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-2.5 text-xs font-bold text-indigo-900 outline-none"
        >
          {Object.keys(templates).map((id) => (
            <option key={id} value={id}>{templates[id].template_name}</option>
          ))}
        </select>
      </div>

      {/* TABEL ANALISA DETAIL SESI UPDATE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" /> Log Kronologis Update Data Per-Tanggal & Jam
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Wilayah / Nama File..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 bg-slate-50/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Wilayah</th>
                <th className="py-3 px-4">File Unggahan</th>
                <th className="py-3 px-4">Waktu Upload</th>
                <th className="py-3 px-4 text-center">Data Sebelumnya</th>
                <th className="py-3 px-4 text-center">Data Hasil Update</th>
                <th className="py-3 px-4 text-center">Pertumbuhan ($\Delta$)</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detailedSessionLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Belum ada riwayat unggahan data.
                  </td>
                </tr>
              ) : (
                detailedSessionLogs
                  .filter((item) =>
                    item.detectedKab.toLowerCase().includes(search.toLowerCase()) ||
                    item.sessionTitle.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-indigo-50/30 transition">
                      <td className="py-3 px-4 font-bold text-indigo-900">{item.detectedKab}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-1.5">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> {item.sessionTitle}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-medium whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" /> {new Date(item.timestamp).toLocaleString("id-ID")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-500">
                        {item.isInitial ? "-" : item.prevRows.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-indigo-700">
                        {item.totalRows.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.deltaRows > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                            <ArrowUpRight className="h-3.5 w-3.5" /> +{item.deltaRows} Baris
                          </span>
                        ) : item.deltaRows < 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-red-600 bg-red-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                            <ArrowDownRight className="h-3.5 w-3.5" /> {item.deltaRows} Baris
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold text-[11px]">
                            <Minus className="h-3.5 w-3.5" /> Data Awal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteSession(item.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Hapus Sesi Ini"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}