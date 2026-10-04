import React, { useEffect, useState, useMemo } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import { 
  FileText, Printer, Building2, BarChart2, Table as TableIcon, Sparkles
} from "lucide-react";

const parseNum = (val) => {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export default function LaporanView() {
  const [activities, setActivities] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [templates, setTemplates] = useState({});
  const [selectedTplId, setSelectedTplId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const actRef = ref(db, "activities");
    const sessRef = ref(db, "upload_sessions");
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

  const activeTemplate = templates[selectedTplId] || null;

  const filteredData = useMemo(() => {
    if (!selectedTplId) return [];
    return activities.filter((act) => {
      if (act.template_id !== selectedTplId) return false;
      if (search) {
        return JSON.stringify(act.data || {}).toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [activities, selectedTplId, search]);

  const numericFieldsStats = useMemo(() => {
    if (!activeTemplate || !activeTemplate.fields) return [];
    const numFields = activeTemplate.fields.filter((f) => f.type === "number" || f.type === "numeric");

    return numFields.map((field) => {
      const totalVal = filteredData.reduce((acc, row) => acc + parseNum(row.data ? row.data[field.label] : 0), 0);
      return {
        label: field.label,
        val: totalVal
      };
    });
  }, [activeTemplate, filteredData]);

  const orderedFieldLabels = useMemo(() => {
    if (activeTemplate && activeTemplate.fields) {
      return activeTemplate.fields.map((f) => f.label);
    }
    return [];
  }, [activeTemplate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* CSS CETAK PRINT A4 LANDSCAPE */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0.8cm;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            font-family: Arial, Helvetica, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
            width: 100% !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            padding: 4px 6px !important;
            font-size: 8pt !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* HASIL CETAK EXPORT RESMI PDF */}
      <div className="print-only space-y-5">
        <div className="border-b-2 border-slate-900 pb-3 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Building2 className="h-6 w-6 text-indigo-800" />
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
              LAPORAN BULANAN EKSEKUTIF ACTIVITY & REGIONAL HUB
            </h1>
          </div>
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            TEMPLATE: {activeTemplate ? activeTemplate.template_name : "-"}
          </h2>
          <div className="flex justify-between items-center text-[9px] text-slate-500 pt-1.5 font-semibold border-t border-slate-200 mt-1.5">
            <span>Tanggal Cetak: <strong>{new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></span>
            <span>Total Record: <strong>{filteredData.length} Baris</strong></span>
            <span>Status: <strong>Laporan Resmi Verifikasi Data</strong></span>
          </div>
        </div>

        {/* BAB I */}
        <div className="space-y-2 break-inside-avoid">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-200 pb-1 flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4" /> I. RINGKASAN METRIK & CAPAIAN INDIKATOR
          </h3>
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead className="bg-slate-100 text-slate-900 font-bold uppercase text-[9px]">
              <tr>
                <th className="py-1.5 px-2 border border-slate-300">No</th>
                <th className="py-1.5 px-2 border border-slate-300">Indikator Metrik</th>
                <th className="py-1.5 px-2 border border-slate-300 text-right">Nilai Total Akumulasi</th>
              </tr>
            </thead>
            <tbody>
              {numericFieldsStats.map((st, idx) => (
                <tr key={st.label} className="even:bg-slate-50">
                  <td className="py-1.5 px-2 border border-slate-200 font-semibold">{idx + 1}</td>
                  <td className="py-1.5 px-2 border border-slate-200 font-bold text-slate-900">{st.label.toUpperCase()}</td>
                  <td className="py-1.5 px-2 border border-slate-200 text-right font-bold text-indigo-900">{st.val.toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BAB II DATA TABULAR */}
        <div className="space-y-2 break-inside-avoid">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-200 pb-1 flex items-center gap-1.5">
            <TableIcon className="h-4 w-4" /> II. RINCIAN DATA LAPORAN AKTIVITAS
          </h3>
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead className="bg-slate-200 text-slate-900 font-bold uppercase text-[9px]">
              <tr>
                <th className="py-1.5 px-2 border border-slate-300 w-8">No</th>
                {orderedFieldLabels.map((header) => (
                  <th key={header} className="py-1.5 px-2 border border-slate-300 whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((act, idx) => (
                <tr key={act.id || idx} className="even:bg-slate-50 break-inside-avoid">
                  <td className="py-1.5 px-2 border border-slate-200 font-semibold text-slate-500">{idx + 1}</td>
                  {orderedFieldLabels.map((header) => {
                    const cellVal = act.data ? act.data[header] : "";
                    return (
                      <td key={header} className="py-1.5 px-2 border border-slate-200 whitespace-nowrap font-medium text-slate-800">
                        {typeof cellVal === "number" ? cellVal.toLocaleString("id-ID") : (cellVal || "-")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* LEMBAR PENGESAHAN */}
        <div className="pt-8 break-inside-avoid">
          <div className="flex justify-between items-end text-xs">
            <div className="text-center space-y-12">
              <p className="font-semibold text-slate-600">Mengetahui,<br /><strong>Supervisor Program</strong></p>
              <p className="font-bold underline text-slate-900">( .................................................... )</p>
            </div>

            <div className="text-center space-y-12">
              <p className="font-semibold text-slate-600">Disusun Oleh,<br /><strong>Data Analyst Executive</strong></p>
              <p className="font-bold underline text-slate-900">( M. Zaen Syachrullah )</p>
            </div>
          </div>
        </div>
      </div>

      {/* TAMPILAN INTERAKTIF LAYAR MONITORING */}
      <div className="no-print space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-900 p-6 sm:p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur-md border border-white/20">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Modul Laporan Resmi Eksekutif
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Cetak & Export Laporan Bulanan
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100 max-w-xl">
                Pilih template laporan dan cetak dokumen A4 Landscape resmi lengkap dengan format pengesahan.
              </p>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-2xl bg-amber-400 hover:bg-amber-300 px-5 py-3 text-xs sm:text-sm font-extrabold text-amber-950 shadow-lg transition active:scale-95 cursor-pointer shrink-0"
            >
              <Printer className="h-5 w-5" /> Cetak / Export PDF
            </button>
          </div>
        </div>

        {/* FILTER SELECTOR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Pilih Template Laporan</label>
            <select
              value={selectedTplId}
              onChange={(e) => setSelectedTplId(e.target.value)}
              className="mt-1 w-full sm:w-80 rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-2.5 text-xs font-bold text-indigo-900 outline-none focus:border-indigo-500"
            >
              {Object.keys(templates).map((key) => (
                <option key={key} value={key}>{templates[key].template_name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold bg-slate-100 px-4 py-2.5 rounded-xl text-slate-700">
            <FileText className="h-4 w-4 text-indigo-600" />
            <span>Total Data Tercover: {filteredData.length} Baris</span>
          </div>
        </div>

        {/* PREVIEW KARTU KPI METRIK */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {numericFieldsStats.map((st) => (
            <div key={st.label} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{st.label}</span>
              <p className="text-2xl font-black text-indigo-600">{st.val.toLocaleString("id-ID")}</p>
            </div>
          ))}
        </div>

        {/* PREVIEW TABEL */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <TableIcon className="h-4 w-4 text-indigo-600" /> Pratinjau Tabel Laporan
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10">No</th>
                  {orderedFieldLabels.map((h) => (
                    <th key={h} className="py-2.5 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.slice(0, 10).map((act, idx) => (
                  <tr key={act.id || idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-semibold text-slate-400">{idx + 1}</td>
                    {orderedFieldLabels.map((h) => (
                      <td key={h} className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">
                        {typeof act.data?.[h] === "number" ? act.data[h].toLocaleString("id-ID") : (act.data?.[h] || "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredData.length > 10 && (
            <p className="text-[11px] text-slate-400 text-center italic">
              Menampilkan 10 dari {filteredData.length} baris pada pratinjau. Seluruh {filteredData.length} baris akan dicetak penuh pada format PDF.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}