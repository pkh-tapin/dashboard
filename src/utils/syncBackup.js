/**
 * Helper Sinkronisasi Latar Belakang (Silent Non-Blocking Background Thread)
 * Mengirim backup ke Google Sheets tanpa membuat UI loading/jeda sama sekali.
 */
export const syncToGoogleSheetsBackground = (templateName, headers, rowsData) => {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwUMzYno8A6-9I1we4mwMLx8f4f1fY4uJsnxQg4ywX2gPozCrpuVt4xxOhY4sVKmV7g/exec";

  if (!headers || headers.length === 0 || !rowsData || rowsData.length === 0) return;

  const payload = JSON.stringify({
    template_name: templateName || "DATABASE_MASTER",
    headers: headers,
    rows: rowsData,
    timestamp: new Date().toISOString()
  });

  // TANPA 'AWAIT' / NON-BLOCKING FIRE-AND-FORGET
  fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors", // Menembus CORS secara senyap tanpa menghentikan thread utama
    headers: { "Content-Type": "text/plain" },
    body: payload
  })
    .then(() => console.log("✓ Backup otomatis Google Sheets terkirim di latar belakang."))
    .catch((err) => console.warn("⚠ Notifikasi backup latar belakang:", err));
};