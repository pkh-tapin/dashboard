const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwUMzYno8A6-9I1we4mwMLx8f4f1fY4uJsnxQg4ywX2gPozCrpuVt4xxOhY4sVKmV7g/exec";

export const uploadFileToDrive = async (file) => {
  if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("PASTE_URL")) {
    console.warn("GAS URL belum diisi. Mengembalikan local object URL untuk pengujian.");
    return URL.createObjectURL(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = reader.result.split(",")[1];
      try {
        const res = await fetch(GAS_WEB_APP_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "uploadFile",
            fileName: file.name,
            mimeType: file.type,
            fileData: base64Data
          })
        });
        const json = await res.json();
        if (json.status === "success") resolve(json.fileUrl);
        else reject(json.message);
      } catch (err) {
        reject(err);
      }
    };
  });
};

export const syncToGoogleSheet = async (templateName, headers, activityId, rowValues) => {
  if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("PASTE_URL")) return;
  try {
    await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "syncSheet",
        templateName,
        headers,
        activityId,
        rowValues
      })
    });
  } catch (err) {
    console.error("Gagal sinkronisasi ke Google Sheets:", err);
  }
};