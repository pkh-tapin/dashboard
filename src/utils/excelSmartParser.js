import * as XLSX from "xlsx";

// Helper pembersih angka presisi & cepat
export const cleanNumber = (val) => {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Parser Excel Super Cepat (ArrayBuffer & Dense Memory Mode)
export const parseExcelFileFast = async (file, templateFields = []) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        
        // Mode Dense & Omit Unnecessary Cell HTML/Formulas untuk Kecepatan Maksimal
        const workbook = XLSX.read(data, {
          type: "array",
          dense: true,
          cellFormula: false,
          cellHTML: false,
          cellText: false,
        });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Konversi Cepat ke Array of Arrays
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (!rawRows || rawRows.length === 0) {
          return resolve({ headers: [], rows: [], detectedHeaderRow: 1 });
        }

        // Smart Header Detection (Hanya Memindai 25 Baris Teratas)
        let detectedHeaderRow = 1;
        let maxMatch = -1;
        let bestHeaderList = [];

        const tplLabels = (templateFields || []).map((f) => f.label.toLowerCase().trim());
        const scanLimit = Math.min(rawRows.length, 25);

        for (let i = 0; i < scanLimit; i++) {
          const row = rawRows[i];
          if (!Array.isArray(row)) continue;

          const cleanRowStr = row.map((c) => String(c || "").toLowerCase().trim());
          let matchCount = 0;

          if (tplLabels.length > 0) {
            tplLabels.forEach((lbl) => {
              if (cleanRowStr.some((c) => c.includes(lbl) || lbl.includes(c))) {
                matchCount++;
              }
            });
          } else {
            matchCount = cleanRowStr.filter((c) => c.length > 0).length;
          }

          if (matchCount > maxMatch && cleanRowStr.some((c) => c.length > 0)) {
            maxMatch = matchCount;
            detectedHeaderRow = i + 1;
            bestHeaderList = row.map((c) => String(c || "").trim());
          }
        }

        if (bestHeaderList.length === 0 && rawRows.length > 0) {
          bestHeaderList = rawRows[0].map((c) => String(c || "").trim());
          detectedHeaderRow = 1;
        }

        // Ambil Data Baris Setelah Header
        const dataRowsRaw = rawRows.slice(detectedHeaderRow);
        const parsedDataRows = [];

        // Pre-indexing pencarian posisi header untuk performa O(1)
        for (let r = 0; r < dataRowsRaw.length; r++) {
          const rowArr = dataRowsRaw[r];
          if (!rowArr || rowArr.length === 0) continue;

          const rowObj = {};
          let hasAnyData = false;

          if (templateFields && templateFields.length > 0) {
            templateFields.forEach((f) => {
              const label = f.label;
              const labelLower = label.toLowerCase().trim();

              let matchedColIdx = -1;
              for (let hIdx = 0; hIdx < bestHeaderList.length; hIdx++) {
                const hText = bestHeaderList[hIdx].toLowerCase().trim();
                if (hText === labelLower || hText.includes(labelLower) || labelLower.includes(hText)) {
                  matchedColIdx = hIdx;
                  break;
                }
              }

              let rawVal = matchedColIdx !== -1 ? rowArr[matchedColIdx] : "";
              if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== "") {
                hasAnyData = true;
              }

              if (f.type === "number") {
                rowObj[label] = cleanNumber(rawVal);
              } else {
                rowObj[label] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : "";
              }
            });
          } else {
            bestHeaderList.forEach((h, colIdx) => {
              if (!h) return;
              const val = rowArr[colIdx];
              if (val !== undefined && val !== null && String(val).trim() !== "") {
                hasAnyData = true;
              }
              rowObj[h] = val !== undefined && val !== null ? String(val).trim() : "";
            });
          }

          if (hasAnyData) {
            parsedDataRows.push(rowObj);
          }
        }

        resolve({
          headers: bestHeaderList,
          rows: parsedDataRows,
          detectedHeaderRow
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};