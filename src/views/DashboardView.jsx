import React, { useEffect, useState, useMemo } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import { 
  Sparkles, UploadCloud, MapPin, Search, ArrowUpRight, ArrowDownRight, Minus,
  ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Building2, Globe, Layers, TrendingUp,
  PieChart, Printer, FileText, CheckCircle2, AlertTriangle, Activity, Award, AlertCircle, Info,
  Table as TableIcon, FileCheck, UserCheck, BarChart2
} from "lucide-react";

// Helper parsing angka akurat
const parseNum = (val) => {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Skema Warna Soft / Pastel Pemisah Wilayah
const SOFT_COLORS = [
  { hex: "#6366f1", bg: "bg-indigo-500", lightBg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200" },
  { hex: "#c084fc", bg: "bg-purple-400", lightBg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
  { hex: "#34d399", bg: "bg-emerald-400", lightBg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  { hex: "#fbbf24", bg: "bg-amber-400", lightBg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  { hex: "#fb7185", bg: "bg-rose-400", lightBg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200" },
  { hex: "#22d3ee", bg: "bg-cyan-400", lightBg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-200" },
  { hex: "#2dd4bf", bg: "bg-teal-400", lightBg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200" },
  { hex: "#fb923c", bg: "bg-orange-400", lightBg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
];

export default function DashboardView({ onNavigateUpload }) {
  const [activities, setActivities] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [templates, setTemplates] = useState({});
  const [selectedTplId, setSelectedTplId] = useState("");
  const [search, setSearch] = useState("");

  // Regional Filter States
  const [filterProv, setFilterProv] = useState("");
  const [filterKab, setFilterKab] = useState("");
  const [filterKec, setFilterKec] = useState("");
  const [filterDesa, setFilterDesa] = useState("");

  // State Hover Donut Slice
  const [hoveredDonutInfo, setHoveredDonutInfo] = useState(null);

  // Table Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

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
  const templateCalcMode = activeTemplate ? (activeTemplate.calc_mode || "LATEST") : "LATEST";

  // Identifikasi Kolom Wilayah Otomatis
  const availableRegionFields = useMemo(() => {
    if (!activeTemplate || !activeTemplate.fields) return { prov: null, kab: null, kec: null, desa: null };
    
    let prov = null, kab = null, kec = null, desa = null;
    activeTemplate.fields.forEach((f) => {
      const lbl = f.label.toLowerCase().trim();
      if (lbl.includes("provinsi") || lbl.includes("prov")) prov = f.label;
      else if (lbl.includes("kabupaten") || lbl.includes("kab") || lbl.includes("kota")) kab = f.label;
      else if (lbl.includes("kecamatan") || lbl.includes("kec")) kec = f.label;
      else if (lbl.includes("desa") || lbl.includes("kelurahan") || lbl.includes("kel")) desa = f.label;
    });

    return { prov, kab, kec, desa };
  }, [activeTemplate]);

  const hasAnyRegionField = availableRegionFields.prov || availableRegionFields.kab || availableRegionFields.kec || availableRegionFields.desa;

  // Helper Cek Pencocokan Filter Wilayah
  const isMatchingFilter = (act) => {
    const d = act.data || {};
    if (filterProv && availableRegionFields.prov && String(d[availableRegionFields.prov]) !== filterProv) return false;
    if (filterKab && availableRegionFields.kab && String(d[availableRegionFields.kab]) !== filterKab) return false;
    if (filterKec && availableRegionFields.kec && String(d[availableRegionFields.kec]) !== filterKec) return false;
    if (filterDesa && availableRegionFields.desa && String(d[availableRegionFields.desa]) !== filterDesa) return false;
    return true;
  };

  // Sesi Unggahan Terkait Template
  const templateSessions = useMemo(() => {
    return sessions.filter((s) => s.template_id === selectedTplId);
  }, [sessions, selectedTplId]);

  // Target Activities (Presisi Sesi Mutakhir Per-Wilayah Gabungan Prov|Kab|Kec|Desa)
  const targetActivities = useMemo(() => {
    if (!selectedTplId) return [];

    const tplActivities = activities.filter((act) => act.template_id === selectedTplId);

    if (templateCalcMode === "ACCUMULATE") {
      return tplActivities;
    }

    // Map sesi ke timestamp untuk akurasi urutan update
    const sessionMap = {};
    templateSessions.forEach((s) => { sessionMap[s.id] = s; });

    const latestActPerRegion = {};

    tplActivities.forEach((act) => {
      const d = act.data || {};
      const provVal = availableRegionFields.prov ? String(d[availableRegionFields.prov] || "").trim() : "";
      const kabVal = availableRegionFields.kab ? String(d[availableRegionFields.kab] || "").trim() : "";
      const kecVal = availableRegionFields.kec ? String(d[availableRegionFields.kec] || "").trim() : "";
      const desaVal = availableRegionFields.desa ? String(d[availableRegionFields.desa] || "").trim() : "";

      // Kunci unik gabungan lengkap agar beda Kecamatan/Desa/Kabupaten terpisah sempurna
      const regKey = [provVal, kabVal, kecVal, desaVal].filter(Boolean).join("|").toLowerCase() || `act_${act.id}`;

      const actSess = sessionMap[act.session_id];
      const actTime = actSess ? actSess.timestamp : (act.created_at || 0);

      if (!latestActPerRegion[regKey]) {
        latestActPerRegion[regKey] = { act, time: actTime };
      } else {
        if (actTime > latestActPerRegion[regKey].time) {
          latestActPerRegion[regKey] = { act, time: actTime };
        }
      }
    });

    const result = Object.values(latestActPerRegion).map((item) => item.act);
    return result.length > 0 ? result : tplActivities;
  }, [activities, selectedTplId, templateCalcMode, availableRegionFields, templateSessions]);

  // Dropdown Options Filter Wilayah
  const locationOptions = useMemo(() => {
    const provs = new Set();
    const kabs = new Set();
    const kecs = new Set();
    const desas = new Set();

    targetActivities.forEach((act) => {
      const d = act.data || {};
      if (availableRegionFields.prov && d[availableRegionFields.prov]) provs.add(String(d[availableRegionFields.prov]));
      if (availableRegionFields.kab && d[availableRegionFields.kab]) kabs.add(String(d[availableRegionFields.kab]));
      if (availableRegionFields.kec && d[availableRegionFields.kec]) kecs.add(String(d[availableRegionFields.kec]));
      if (availableRegionFields.desa && d[availableRegionFields.desa]) desas.add(String(d[availableRegionFields.desa]));
    });

    return {
      provs: Array.from(provs).sort(),
      kabs: Array.from(kabs).sort(),
      kecs: Array.from(kecs).sort(),
      desas: Array.from(desas).sort()
    };
  }, [targetActivities, availableRegionFields]);

  // Data Terfilter Berdasarkan Wilayah & Search
  const filteredData = useMemo(() => {
    return targetActivities.filter((act) => {
      if (!isMatchingFilter(act)) return false;
      if (search) {
        return JSON.stringify(act.data || {}).toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [targetActivities, filterProv, filterKab, filterKec, filterDesa, search, availableRegionFields]);

  // Hitung Jumlah Cakupan Wilayah Unik
  const regionCounts = useMemo(() => {
    const kabs = new Set();
    const kecs = new Set();
    const desas = new Set();

    filteredData.forEach((act) => {
      const d = act.data || {};
      if (availableRegionFields.kab && d[availableRegionFields.kab]) kabs.add(String(d[availableRegionFields.kab]));
      if (availableRegionFields.kec && d[availableRegionFields.kec]) kecs.add(String(d[availableRegionFields.kec]));
      if (availableRegionFields.desa && d[availableRegionFields.desa]) desas.add(String(d[availableRegionFields.desa]));
    });

    return {
      totalKab: kabs.size,
      totalKec: kecs.size,
      totalDesa: desas.size
    };
  }, [filteredData, availableRegionFields]);

  // Field Grouping untuk Chart Donat
  const chartGroupKeyField = useMemo(() => {
    if (filterKec && availableRegionFields.desa) return availableRegionFields.desa;
    if (filterKab && availableRegionFields.kec) return availableRegionFields.kec;
    if (filterKab && availableRegionFields.desa) return availableRegionFields.desa;
    return availableRegionFields.kab || availableRegionFields.kec || availableRegionFields.desa;
  }, [filterKab, filterKec, availableRegionFields]);

  // PERHITUNGAN METRIK CARD & DELTA AWAL ➔ BARU
  const numericFieldsStats = useMemo(() => {
    if (!activeTemplate || !activeTemplate.fields) return [];

    const numFields = activeTemplate.fields.filter((f) => {
      if (f.type === "number" || f.type === "numeric") return true;
      const lbl = f.label.toLowerCase();
      return (
        lbl.includes("total") || lbl.includes("jumlah") || lbl.includes("kk") ||
        lbl.includes("bpnt") || lbl.includes("pkh") || lbl.includes("layak") || lbl.includes("pending")
      );
    });

    const regionSessHistoryFiltered = {};

    templateSessions.forEach((sess) => {
      const sessActsMatchingFilter = activities.filter(
        (a) => a.session_id === sess.id && isMatchingFilter(a)
      );

      if (sessActsMatchingFilter.length === 0) return;

      sessActsMatchingFilter.forEach((act) => {
        const d = act.data || {};
        const provVal = availableRegionFields.prov ? String(d[availableRegionFields.prov] || "").trim() : "";
        const kabVal = availableRegionFields.kab ? String(d[availableRegionFields.kab] || "").trim() : "";
        const kecVal = availableRegionFields.kec ? String(d[availableRegionFields.kec] || "").trim() : "";
        const desaVal = availableRegionFields.desa ? String(d[availableRegionFields.desa] || "").trim() : "";

        const regKey = [provVal, kabVal, kecVal, desaVal].filter(Boolean).join("|").toLowerCase() || "default";

        if (!regionSessHistoryFiltered[regKey]) regionSessHistoryFiltered[regKey] = [];
        if (!regionSessHistoryFiltered[regKey].find((s) => s.id === sess.id)) {
          regionSessHistoryFiltered[regKey].push(sess);
        }
      });
    });

    return numFields.map((field) => {
      const totalVal = filteredData.reduce((acc, row) => acc + parseNum(row.data ? row.data[field.label] : 0), 0);

      let initialVal = 0;
      let hasHistory = false;

      Object.keys(regionSessHistoryFiltered).forEach((regKey) => {
        const sortedHistory = [...regionSessHistoryFiltered[regKey]].sort((a, b) => a.timestamp - b.timestamp);
        
        if (sortedHistory.length > 0) {
          const oldestSess = sortedHistory[0];
          const oldestActs = activities.filter(
            (a) => a.session_id === oldestSess.id && isMatchingFilter(a)
          );
          
          const regOldestSum = oldestActs.reduce((acc, row) => acc + parseNum(row.data ? row.data[field.label] : 0), 0);
          initialVal += regOldestSum;

          if (sortedHistory.length >= 2) {
            hasHistory = true;
          }
        }
      });

      const totalDelta = totalVal - initialVal;

      return {
        label: field.label,
        val: totalVal,
        prevVal: initialVal > 0 ? initialVal : totalVal,
        delta: hasHistory ? totalDelta : 0,
        hasHistory
      };
    });
  }, [activeTemplate, filteredData, activities, templateSessions, availableRegionFields, filterProv, filterKab, filterKec, filterDesa]);

  // MULTI-BAGAN DONAT SOFT (Satu Donat Per-Header Metrik)
  const multiDonutCharts = useMemo(() => {
    if (!activeTemplate || !activeTemplate.fields || !chartGroupKeyField) return [];

    const numHeaders = activeTemplate.fields.filter((f) => {
      if (f.type === "number" || f.type === "numeric") return true;
      const lbl = f.label.toLowerCase();
      return (
        lbl.includes("total") || lbl.includes("jumlah") || lbl.includes("kk") ||
        lbl.includes("bpnt") || lbl.includes("pkh") || lbl.includes("layak") || lbl.includes("pending")
      );
    });

    return numHeaders.map((header) => {
      const groupMap = {};

      filteredData.forEach((act) => {
        const d = act.data || {};
        const regName = String(d[chartGroupKeyField] || "Lainnya").trim();
        const val = parseNum(d[header.label]);
        groupMap[regName] = (groupMap[regName] || 0) + val;
      });

      const rawItems = Object.keys(groupMap).map((k) => ({
        regionName: k,
        val: groupMap[k]
      })).sort((a, b) => b.val - a.val);

      const grandTotalVal = rawItems.reduce((acc, item) => acc + item.val, 0);

      const radius = 36;
      const circumference = 2 * Math.PI * radius; // ~226.19
      let accumulatedPct = 0;

      const slices = rawItems.map((item, idx) => {
        const color = SOFT_COLORS[idx % SOFT_COLORS.length];
        const pct = grandTotalVal > 0 ? (item.val / grandTotalVal) * 100 : 0;
        const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
        const strokeDashoffset = -((accumulatedPct / 100) * circumference);

        accumulatedPct += pct;

        return {
          regionName: item.regionName,
          val: item.val,
          pct: pct.toFixed(1),
          color,
          strokeDasharray,
          strokeDashoffset
        };
      });

      return {
        headerLabel: header.label,
        grandTotal: grandTotalVal,
        slices
      };
    });
  }, [activeTemplate, filteredData, chartGroupKeyField]);

  // TABEL MATRIKS SILANG (PIVOT TABLE WILAYAH VS SELURUH HEADER UNTUK LAPORAN EXPORT)
  const regionVsHeaderPivotTable = useMemo(() => {
    if (!activeTemplate || !activeTemplate.fields || !chartGroupKeyField) return { regions: [], headers: [], grandTotals: {} };

    const headers = activeTemplate.fields.filter((f) => {
      if (f.type === "number" || f.type === "numeric") return true;
      const lbl = f.label.toLowerCase();
      return (
        lbl.includes("total") || lbl.includes("jumlah") || lbl.includes("kk") ||
        lbl.includes("bpnt") || lbl.includes("pkh") || lbl.includes("layak") || lbl.includes("pending")
      );
    }).map((f) => f.label);

    const pivotMap = {};
    const grandTotals = {};
    headers.forEach((h) => { grandTotals[h] = 0; });

    filteredData.forEach((act) => {
      const d = act.data || {};
      const regName = String(d[chartGroupKeyField] || "Lainnya").trim();

      if (!pivotMap[regName]) {
        pivotMap[regName] = { regionName: regName, totals: {}, totalCount: 0 };
        headers.forEach((h) => { pivotMap[regName].totals[h] = 0; });
      }

      pivotMap[regName].totalCount += 1;
      headers.forEach((h) => {
        const val = parseNum(d[h]);
        pivotMap[regName].totals[h] += val;
        grandTotals[h] += val;
      });
    });

    const regionsList = Object.values(pivotMap).sort((a, b) => b.totalCount - a.totalCount);

    regionsList.forEach((r, idx) => {
      r.color = SOFT_COLORS[idx % SOFT_COLORS.length];
    });

    return {
      headers,
      regions: regionsList,
      grandTotals
    };
  }, [activeTemplate, filteredData, chartGroupKeyField]);

  // Data Agregasi Ringkasan Per-Wilayah
  const regionalBreakdown = useMemo(() => {
    if (!chartGroupKeyField) return [];

    const groupMap = {};
    const totalRecords = filteredData.length || 1;

    filteredData.forEach((act) => {
      const d = act.data || {};
      const regName = String(d[chartGroupKeyField] || "Lainnya").trim();

      if (!groupMap[regName]) {
        groupMap[regName] = {
          regionName: regName,
          count: 0,
          percentage: 0,
          totals: {}
        };
      }

      groupMap[regName].count += 1;

      numericFieldsStats.forEach((f) => {
        const currentVal = groupMap[regName].totals[f.label] || 0;
        groupMap[regName].totals[f.label] = currentVal + parseNum(d[f.label]);
      });
    });

    return Object.values(groupMap).map((item) => ({
      ...item,
      percentage: ((item.count / totalRecords) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);
  }, [filteredData, chartGroupKeyField, numericFieldsStats]);

  // MODUL EVALUASI & ANALISIS MONITORING
  const evaluationAnalysis = useMemo(() => {
    if (regionalBreakdown.length === 0) return null;

    const topRegion = regionalBreakdown[0];
    const lowestRegion = regionalBreakdown[regionalBreakdown.length - 1];

    let pendingTotal = 0;
    let layakTotal = 0;

    numericFieldsStats.forEach((s) => {
      const lbl = s.label.toLowerCase();
      if (lbl.includes("pending")) pendingTotal += s.val;
      else if (lbl.includes("layak") && !lbl.includes("tidak") && !lbl.includes("tdk")) layakTotal += s.val;
    });

    return {
      topRegionName: topRegion.regionName,
      topCount: topRegion.count,
      topPct: topRegion.percentage,
      lowestRegionName: lowestRegion.regionName,
      lowestCount: lowestRegion.count,
      pendingTotal,
      layakTotal
    };
  }, [regionalBreakdown, numericFieldsStats]);

  // Urutan Kolom STRICT
  const orderedFieldLabels = useMemo(() => {
    if (activeTemplate && activeTemplate.fields) {
      return activeTemplate.fields.map((f) => f.label);
    }
    return [];
  }, [activeTemplate]);

  // Judul Hirarki Wilayah
  const hierarchyTitle = useMemo(() => {
    if (filterKab) return `Rekapitulasi Wilayah Kabupaten ${filterKab}`;
    if (availableRegionFields.desa) return "Rekapitulasi Tingkat Kecamatan / Kabupaten";
    if (availableRegionFields.kec) return "Rekapitulasi Tingkat Kabupaten / Kota";
    if (availableRegionFields.kab) return "Rekapitulasi Seluruh Kabupaten / Kota (Se-Provinsi Kalsel)";
    return "Rekapitulasi Keseluruhan Data";
  }, [availableRegionFields, filterKab]);

  // Pagination Table Untuk Tampilan Layar
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    return filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [filteredData, currentPage]);

  const resetFilters = () => {
    setFilterProv("");
    setFilterKab("");
    setFilterKec("");
    setFilterDesa("");
    setSearch("");
    setCurrentPage(1);
  };

  // Trigger Cetak / Export PDF Laporan Resmi
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* CSS STYLES CETAK LANDSCAPE DAN ANTI-TERPOTONG / ANTI-KEBAWAH */}
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
          .page-break-before {
            page-break-before: always;
          }
          .break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          table {
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
          }
          th, td {
            white-space: nowrap !important;
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

      {/* ==================== TAMPILAN RESMI EXPORT PDF (LANDSCAPE A4 EXPORT RESMI) ==================== */}
      <div className="print-only space-y-5">
        {/* KOP LAPORAN RESMI */}
        <div className="border-b-2 border-slate-900 pb-3 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Building2 className="h-6 w-6 text-indigo-800" />
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
              LAPORAN MONITORING & EVALUASI PROGRAM
            </h1>
          </div>
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            {hierarchyTitle} — TEMPLATE: {activeTemplate ? activeTemplate.template_name : "-"}
          </h2>
          <div className="flex justify-between items-center text-[9px] text-slate-500 pt-1.5 font-semibold border-t border-slate-200 mt-1.5">
            <span>Tanggal Cetak: <strong>{new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></span>
            <span>Total Rekor Terdata: <strong>{filteredData.length} Baris</strong></span>
            <span>Status Sistem: <strong>Terverifikasi Akurat (Landscape Print Format)</strong></span>
          </div>
        </div>

        {/* BAB I: RINGKASAN EKSEKUTIF & KPI DATA */}
        <div className="space-y-2 break-inside-avoid">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-200 pb-1 flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4" /> I. RINGKASAN EKSEKUTIF & METRIK PROGRAM (KPI)
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead className="bg-slate-100 text-slate-900 font-bold uppercase text-[9px] border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 border-r border-slate-300">No</th>
                  <th className="py-1.5 px-2 border-r border-slate-300">Indikator Header Metrik</th>
                  <th className="py-1.5 px-2 border-r border-slate-300 text-right">Nilai Awal</th>
                  <th className="py-1.5 px-2 border-r border-slate-300 text-right">Nilai Terkini (Baru)</th>
                  <th className="py-1.5 px-2 border-r border-slate-300 text-right">Delta Penambahan</th>
                  <th className="py-1.5 px-2 text-center">Status Lintasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {numericFieldsStats.map((st, idx) => (
                  <tr key={st.label} className="even:bg-slate-50">
                    <td className="py-1.5 px-2 border-r border-slate-200 font-semibold text-slate-500">{idx + 1}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200 font-bold text-slate-900">{st.label.toUpperCase()}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-right font-medium">{st.prevVal.toLocaleString("id-ID")}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-right font-bold text-indigo-900">{st.val.toLocaleString("id-ID")}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-right font-bold">
                      {st.delta > 0 ? `+${st.delta.toLocaleString("id-ID")}` : st.delta}
                    </td>
                    <td className="py-1.5 px-2 text-center font-bold">
                      {st.delta > 0 ? "Meningkat (+)" : st.delta < 0 ? "Penurunan (-)" : "Stabil"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* BAB II: ANALISIS DATA KESELURUHAN & EVALUASI LAPANGAN */}
        {evaluationAnalysis && (
          <div className="space-y-2 break-inside-avoid">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-200 pb-1 flex items-center gap-1.5">
              <Award className="h-4 w-4" /> II. ANALISIS EVALUASI LAPANGAN & REKOMENDASI STRATEGIS
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 border border-emerald-300 bg-emerald-50/50 rounded-xl space-y-1">
                <span className="font-bold text-emerald-900 uppercase text-[9px] block border-b border-emerald-200 pb-0.5">
                  ✓ Capaian Kinerja Wilayah Dominan
                </span>
                <p className="text-slate-800 leading-relaxed text-[11px]">
                  Wilayah <strong>{evaluationAnalysis.topRegionName}</strong> mencatatkan kontribusi tertinggi sebanyak <strong>{evaluationAnalysis.topCount} Record</strong> ({evaluationAnalysis.topPct}% dari total data). Pemutakhiran data berjalan optimal secara konsisten.
                </p>
              </div>

              <div className="p-3 border border-amber-300 bg-amber-50/50 rounded-xl space-y-1">
                <span className="font-bold text-amber-900 uppercase text-[9px] block border-b border-amber-200 pb-0.5">
                  ⚠ Catatan Evaluasi & Area Percepatan
                </span>
                <p className="text-slate-800 leading-relaxed text-[11px]">
                  Wilayah <strong>{evaluationAnalysis.lowestRegionName}</strong> memerlukan perhatian khusus (terdata {evaluationAnalysis.lowestCount} Record).
                  Terdapat akumulasi usulan pending sebesar <strong>{evaluationAnalysis.pendingTotal.toLocaleString("id-ID")}</strong> yang memerlukan percepatan verifikasi.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* BAB III: TABEL MATRIKS SILANG KOMPARASI ANTAR-WILAYAH (NO WRAP LANDSCAPE) */}
        <div className="space-y-2 break-inside-avoid">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-200 pb-1 flex items-center gap-1.5">
            <TableIcon className="h-4 w-4" /> III. MATRIKS KOMPARASI RINCIAN WILAYAH VS HEADER METRIK
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead className="bg-slate-100 text-slate-900 font-bold uppercase text-[9px] border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 border-r border-slate-300">Nama Wilayah</th>
                  <th className="py-1.5 px-2 border-r border-slate-300 text-center">Total Baris</th>
                  {regionVsHeaderPivotTable.headers.map((h) => (
                    <th key={h} className="py-1.5 px-2 border-r border-slate-300 text-right whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {regionVsHeaderPivotTable.regions.map((reg) => (
                  <tr key={reg.regionName} className="even:bg-slate-50">
                    <td className="py-1.5 px-2 border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">{reg.regionName}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-center font-semibold text-slate-600">{reg.totalCount}</td>
                    {regionVsHeaderPivotTable.headers.map((h) => (
                      <td key={h} className="py-1.5 px-2 border-r border-slate-200 text-right font-medium whitespace-nowrap">
                        {reg.totals[h].toLocaleString("id-ID")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-200 font-bold text-slate-900 text-xs border-t-2 border-slate-400">
                <tr>
                  <td className="py-1.5 px-2 border-r border-slate-300 whitespace-nowrap">TOTAL AKHIR</td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center">{filteredData.length}</td>
                  {regionVsHeaderPivotTable.headers.map((h) => (
                    <td key={h} className="py-1.5 px-2 border-r border-slate-300 text-right whitespace-nowrap">
                      {regionVsHeaderPivotTable.grandTotals[h]?.toLocaleString("id-ID")}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* BAB IV: TABEL RINCIAN DATA KESELURUHAN (100% UTUH LANDSCAPE) */}
        <div className="space-y-2 page-break-before">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-200 pb-1 flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> IV. TABEL RINCIAN DATA KESELURUHAN (FULL RECORD DETAILED LIST)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead className="bg-slate-200 text-slate-900 font-bold uppercase text-[9px] border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 border-r border-slate-300 w-8">No</th>
                  {orderedFieldLabels.map((header) => (
                    <th key={header} className="py-1.5 px-2 border-r border-slate-300 whitespace-nowrap">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.map((act, idx) => (
                  <tr key={act.id || idx} className="even:bg-slate-50 break-inside-avoid">
                    <td className="py-1.5 px-2 border-r border-slate-200 font-semibold text-slate-500">{idx + 1}</td>
                    {orderedFieldLabels.map((header) => {
                      const cellVal = act.data ? act.data[header] : "";
                      const isUrl = typeof cellVal === "string" && cellVal.startsWith("http");

                      return (
                        <td key={header} className="py-1.5 px-2 border-r border-slate-200 whitespace-nowrap font-medium text-slate-800">
                          {isUrl ? "Tersedia (Link Drive)" : (typeof cellVal === "number" ? cellVal.toLocaleString("id-ID") : (cellVal !== undefined && cellVal !== null && String(cellVal) !== "" ? String(cellVal) : "-"))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* BAB V: LEMBAR PENGESAHAN & TANDA TANGAN LAPORAN RESMI */}
        <div className="pt-8 break-inside-avoid">
          <div className="flex justify-between items-end text-xs">
            <div className="text-center space-y-12">
              <p className="font-semibold text-slate-600">Diverifikasi Oleh,<br /><strong>Supervisor / Penanggung Jawab Program</strong></p>
              <p className="font-bold underline text-slate-900">( .................................................... )</p>
            </div>

            <div className="text-center space-y-12">
              <p className="font-semibold text-slate-600">Disusun Oleh,<br /><strong>Tim Analyst Data </strong></p>
              <p className="font-bold underline text-slate-900">( ................................................................. )</p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== TAMPILAN INTERAKTIF MONITORING (ON-SCREEN VIEW) ==================== */}
      <div className="no-print space-y-8">
        {/* Banner Hero Executive */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 p-6 sm:p-8 text-white shadow-xl shadow-indigo-200">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md border border-white/20">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Executive Activity & Regional Hub
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {hierarchyTitle}
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100 max-w-xl">
                Memantau akumulasi data per-kabupaten, kecamatan, dan desa lengkap dengan multi-bagan donat per-header & laporan PDF.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 rounded-2xl bg-amber-400 hover:bg-amber-300 px-5 py-3 text-xs sm:text-sm font-extrabold text-amber-950 shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Printer className="h-5 w-5" /> Export Laporan PDF
              </button>

              <button
                onClick={onNavigateUpload}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs sm:text-sm font-bold text-indigo-700 shadow-lg hover:bg-indigo-50 transition active:scale-95 cursor-pointer"
              >
                <UploadCloud className="h-5 w-5 text-indigo-600" /> Upload Data Baru
              </button>
            </div>
          </div>
        </div>

        {/* Selector Template Utama */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Pilih Template Aktivitas</label>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                templateCalcMode === "ACCUMULATE" 
                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}>
                Mode: {templateCalcMode === "ACCUMULATE" ? "Akumulasi Total" : "Update Terbaru Per-Wilayah"}
              </span>
            </div>
          </div>

          <select
            value={selectedTplId}
            onChange={(e) => {
              setSelectedTplId(e.target.value);
              resetFilters();
            }}
            className="w-full sm:w-80 rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-2.5 text-xs font-bold text-indigo-900 outline-none focus:border-indigo-500"
          >
            {Object.keys(templates).map((key) => (
              <option key={key} value={key}>{templates[key].template_name}</option>
            ))}
          </select>
        </div>

        {/* SMART FILTER WILAYAH */}
        {hasAnyRegionField && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <MapPin className="h-4 w-4 text-indigo-600" /> Filter Wilayah
              </div>
              {(filterProv || filterKab || filterKec || filterDesa) && (
                <button onClick={resetFilters} className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer">
                  <RefreshCw className="h-3 w-3" /> Reset Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {availableRegionFields.prov && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{availableRegionFields.prov}</label>
                  <select
                    value={filterProv}
                    onChange={(e) => { setFilterProv(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Semua Provinsi</option>
                    {locationOptions.provs.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}

              {availableRegionFields.kab && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{availableRegionFields.kab}</label>
                  <select
                    value={filterKab}
                    onChange={(e) => { setFilterKab(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Semua Kabupaten/Kota</option>
                    {locationOptions.kabs.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              )}

              {availableRegionFields.kec && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{availableRegionFields.kec}</label>
                  <select
                    value={filterKec}
                    onChange={(e) => { setFilterKec(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Semua Kecamatan</option>
                    {locationOptions.kecs.map((kc) => <option key={kc} value={kc}>{kc}</option>)}
                  </select>
                </div>
              )}

              {availableRegionFields.desa && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{availableRegionFields.desa}</label>
                  <select
                    value={filterDesa}
                    onChange={(e) => { setFilterDesa(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="">Semua Desa/Kelurahan</option>
                    {locationOptions.desas.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION MODUL MULTI-BAGAN DONAT SOFT (Satu Donat Per-Header Metrik) */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <PieChart className="h-5 w-5 text-indigo-600" /> Modul Donat Proporsi Data Riil Per-Header Template
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Setiap header metrik ditampilkan dalam 1 bagan donat tersendiri dengan angka total riil di pusat lingkaran.
              </p>
            </div>

            <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-100">
              {multiDonutCharts.length} Header Donat Terdaftar
            </span>
          </div>

          {/* GRID OF DONUT CHARTS (SATU DONAT UNTUK SETIAP HEADER) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {multiDonutCharts.length === 0 ? (
              <p className="text-xs text-slate-400 col-span-full py-8 text-center">Tidak ada header metrik numerik pada template ini.</p>
            ) : (
              multiDonutCharts.map((chart) => {
                const activeHoverKey = `${chart.headerLabel}`;

                return (
                  <div key={chart.headerLabel} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4 hover:border-indigo-300 transition">
                    <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate max-w-[180px]">
                        {chart.headerLabel}
                      </span>
                      <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-lg">
                        {chart.grandTotal.toLocaleString("id-ID")} Total
                      </span>
                    </div>

                    {/* LINGKARAN DONAT SVG DENGAN TEKS TOTAL AKUMULASI RIIL DI TENGAH */}
                    <div className="flex items-center justify-around gap-2">
                      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
                          <circle cx="50" cy="50" r="36" className="stroke-slate-200/80" strokeWidth="12" fill="transparent" />
                          
                          {chart.slices.map((slice, idx) => {
                            const isHovered = hoveredDonutInfo && hoveredDonutInfo.key === activeHoverKey && hoveredDonutInfo.regionName === slice.regionName;

                            return (
                              <circle
                                key={idx}
                                cx="50"
                                cy="50"
                                r="36"
                                stroke={slice.color.hex}
                                strokeWidth={isHovered ? "15" : "12"}
                                fill="transparent"
                                strokeDasharray={slice.strokeDasharray}
                                strokeDashoffset={slice.strokeDashoffset}
                                strokeLinecap="round"
                                className="transition-all duration-300 ease-out cursor-pointer"
                                onMouseEnter={() => setHoveredDonutInfo({ key: activeHoverKey, ...slice })}
                                onMouseLeave={() => setHoveredDonutInfo(null)}
                              />
                            );
                          })}
                        </svg>

                        {/* ANGKA TOTAL RIIL TEPAT DI TENGAH DONAT */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
                          <span className="text-[10px] font-black text-slate-900 leading-tight">
                            {hoveredDonutInfo && hoveredDonutInfo.key === activeHoverKey
                              ? hoveredDonutInfo.val.toLocaleString("id-ID")
                              : chart.grandTotal.toLocaleString("id-ID")}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[90px]">
                            {hoveredDonutInfo && hoveredDonutInfo.key === activeHoverKey
                              ? hoveredDonutInfo.regionName
                              : "TOTAL RIIL"}
                          </span>
                        </div>
                      </div>

                      {/* LEGEND BADGES WILAYAH */}
                      <div className="space-y-1.5 w-full">
                        {chart.slices.map((slice, idx) => {
                          const isHovered = hoveredDonutInfo && hoveredDonutInfo.key === activeHoverKey && hoveredDonutInfo.regionName === slice.regionName;

                          return (
                            <div
                              key={idx}
                              onMouseEnter={() => setHoveredDonutInfo({ key: activeHoverKey, ...slice })}
                              onMouseLeave={() => setHoveredDonutInfo(null)}
                              className={`flex items-center justify-between p-1.5 rounded-xl border text-[11px] transition cursor-pointer ${
                                isHovered 
                                  ? `${slice.color.lightBg}${slice.color.border} font-extrabold ring-1 ring-indigo-300`
                                  : "bg-white border-slate-100 font-semibold"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate max-w-[90px]">
                                <span className={`h-2.5 w-2.5 rounded-full ${slice.color.bg} shrink-0`}></span>
                                <span className="truncate text-slate-700">{slice.regionName}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-extrabold text-slate-900 block leading-tight">{slice.val.toLocaleString("id-ID")}</span>
                                <span className={`text-[9px] ${slice.color.text}`}>{slice.pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MODUL EVALUASI & ANALISIS MONITORING (KELEBIHAN & AREA PERBAIKAN) */}
        {evaluationAnalysis && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Award className="h-5 w-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-base">Modul Evaluasi Monitoring & Catatan Lapangan</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* KELEBIHAN / CAPAIAN TERTINGGI */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Kelebihan & Capaian Tertinggi
                </div>
                <p className="text-xs text-emerald-900 font-medium">
                  Wilayah <strong>{evaluationAnalysis.topRegionName}</strong> mencatatkan kontribusi tertinggi dengan{" "}
                  <strong>{evaluationAnalysis.topCount} Record</strong> ({evaluationAnalysis.topPct}% dari total keseluruhan data terdaftar).
                </p>
              </div>

              {/* AREA PERBAIKAN / CATATAN EVALUASI */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase">
                  <AlertCircle className="h-4 w-4 text-amber-600" /> Area Evaluasi & Perhatian Lapangan
                </div>
                <p className="text-xs text-amber-900 font-medium">
                  Wilayah <strong>{evaluationAnalysis.lowestRegionName}</strong> memerlukan percepatan pemutakhiran data (tercatat {evaluationAnalysis.lowestCount} Record).
                  Tercatat total akumulasi usulan pending sebesar <strong>{evaluationAnalysis.pendingTotal.toLocaleString("id-ID")}</strong> perlu tindak lanjut verifikasi.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CARDS REKAPITULASI DYNAMIC UTAMA */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-indigo-600" /> Card Rekapitulasi Data & Indikator Peningkatan Update
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-bold uppercase">Total Baris Wilayah</span>
                <Building2 className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-800">{filteredData.length.toLocaleString("id-ID")}</p>
              <p className="mt-2 text-[11px] text-slate-400 font-medium">Lokasi Terdaftar</p>
            </div>

            {availableRegionFields.kab && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-xs font-bold uppercase">Total Kabupaten / Kota</span>
                  <Globe className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-3xl font-extrabold text-emerald-600">{regionCounts.totalKab}</p>
                <p className="mt-2 text-[11px] text-slate-400 font-medium">Kabupaten/Kota Terjangkau</p>
              </div>
            )}

            {/* CARD NUMERIK DENGAN INDIKATOR PERTUMBUHAN AWAL ➔ BARU */}
            {numericFieldsStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 transition space-y-2">
                <span className="text-xs font-bold uppercase text-slate-400">{stat.label}</span>
                <p className="text-3xl font-extrabold text-indigo-600">{stat.val.toLocaleString("id-ID")}</p>
                
                <div className="pt-1 border-t border-slate-100 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {stat.delta > 0 ? (
                      <span className="inline-flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                        <ArrowUpRight className="h-4 w-4" /> +{stat.delta.toLocaleString("id-ID")}
                      </span>
                    ) : stat.delta < 0 ? (
                      <span className="inline-flex items-center text-red-600 bg-red-50 px-2 py-0.5 rounded-md font-bold">
                        <ArrowDownRight className="h-4 w-4" /> {stat.delta.toLocaleString("id-ID")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                        <Minus className="h-4 w-4" /> Tetap
                      </span>
                    )}
                    <span className="text-slate-400 font-semibold text-[10px]">penambahan akumulasi</span>
                  </div>

                  <p className="text-[11px] font-semibold text-slate-500">
                    {stat.hasHistory ? (
                      <span>Awal: <strong className="text-slate-700">{stat.prevVal.toLocaleString("id-ID")}</strong> ➔ Baru: <strong className="text-indigo-700">{stat.val.toLocaleString("id-ID")}</strong></span>
                    ) : (
                      <span>Awal: <strong className="text-slate-700">{stat.val.toLocaleString("id-ID")}</strong> ➔ Baru: <strong className="text-indigo-700">{stat.val.toLocaleString("id-ID")}</strong></span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RINGKASAN REKAPITULASI DETAIL PER-WILAYAH (KARTU GRID) */}
        {regionalBreakdown.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" /> Ringkasan Per-
                {chartGroupKeyField ? chartGroupKeyField.toUpperCase() : "WILAYAH"}
              </h3>
              <span className="text-xs text-slate-400 font-medium">{regionalBreakdown.length} Wilayah Terdata</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {regionalBreakdown.map((item) => (
                <div key={item.regionName} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">{item.regionName}</span>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">
                      {item.count} Record ({item.percentage}%)
                    </span>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-200/60">
                    {Object.keys(item.totals).map((totKey) => (
                      <div key={totKey} className="flex justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">{totKey}:</span>
                        <span className="font-bold text-indigo-700">{item.totals[totKey].toLocaleString("id-ID")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABEL DATA REKAPITULASI ACTIVITY */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Tabel Data Rekapitulasi Activity (Semua Wilayah Terdata)</h3>
              <p className="text-xs text-slate-400">
                Menampilkan seluruh baris Kabupaten/Kecamatan/Desa dengan urutan kolom 100% presisi sesuai template.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kata kunci..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Structure Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12">No</th>
                  {orderedFieldLabels.map((header) => (
                    <th key={header} className="py-3 px-4 whitespace-nowrap">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={orderedFieldLabels.length + 1} className="py-8 text-center text-slate-400">
                      Tidak ada data yang tersedia untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((act, idx) => (
                    <tr key={act.id || idx} className="hover:bg-indigo-50/30 transition">
                      <td className="py-3 px-4 font-semibold text-slate-400">
                        {(currentPage - 1) * rowsPerPage + idx + 1}
                      </td>
                      {orderedFieldLabels.map((header) => {
                        const cellVal = act.data ? act.data[header] : "";
                        const isUrl = typeof cellVal === "string" && cellVal.startsWith("http");

                        return (
                          <td key={header} className="py-3 px-4 whitespace-nowrap max-w-xs truncate font-medium text-slate-800">
                            {isUrl ? (
                              <a href={cellVal} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 underline font-semibold">
                                <ExternalLink className="h-3 w-3" /> Berkas Drive
                              </a>
                            ) : (
                              typeof cellVal === "number" ? cellVal.toLocaleString("id-ID") : (cellVal !== undefined && cellVal !== null && String(cellVal) !== "" ? String(cellVal) : "-")
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">
              Menampilkan <span className="font-bold text-slate-700">{paginatedData.length}</span> dari{" "}
              <span className="font-bold text-slate-700">{filteredData.length}</span> data
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
      </div>
    </div>
  );
}