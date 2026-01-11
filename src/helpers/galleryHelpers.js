import JSZip from "jszip";
import { supabase } from "../supabaseClient";

/* ---------- FOLDER MANAGEMENT ---------- */
// These stay in LocalStorage because they are UI preferences
// (unless you want to create a 'folders' table in Supabase later)

const FOLDER_ALIASES = {
  All: "Folder Groups",
  Everything: "Folder Groups",
  Default: "Folder Groups",
};

export function loadFolders() {
  const saved = localStorage.getItem("gallery-folders");
  if (!saved) return ["Folder Groups"];
  try {
    const folders = JSON.parse(saved);
    return folders.map((f) => FOLDER_ALIASES[f] ?? f);
  } catch (e) {
    return ["Folder Groups"];
  }
}

export function saveFolders(folders) {
  localStorage.setItem("gallery-folders", JSON.stringify(folders));
}

/* ---------- FILTERING ---------- */

export function filterItems(items, activeFolder, search) {
  if (!items) return [];
  const query = search.toLowerCase();

  return items.filter((item) => {
    // Check if the item matches the active folder
    const folderMatch =
      activeFolder === "Select Folder"
        ? !item.folder || item.folder === ""
        : item.folder === activeFolder;

    // Check if the notes match the search query
    const searchMatch = (item.notes || "").toLowerCase().includes(query);

    return folderMatch && searchMatch;
  });
}

/* ---------- ZIP EXPORT (Supabase Version) ---------- */

/* ---------- ZIP EXPORT (Selected Items Version) ---------- */
export async function exportGalleryZip(items, selectedIds) {
  const zip = new JSZip();
  const meta = [];

  const itemsToExport =
    selectedIds && selectedIds.size > 0
      ? items.filter((item) => selectedIds.has(item.id))
      : items;

  if (itemsToExport.length === 0) {
    alert("No items selected to export!");
    return;
  }

  // 1. Build the ZIP and Meta Data
  for (const item of itemsToExport) {
    try {
      const response = await fetch(item.imageURL);
      if (!response.ok) throw new Error("Image download failed");
      const blob = await response.blob();

      const cleanFilename = item.image_path.split("/").pop();
      // We put images in a subfolder for the HTML viewer
      const zipPath = `images/${cleanFilename}`;

      zip.file(zipPath, blob);

      meta.push({
        notes: item.notes,
        folder: item.folder,
        filename: cleanFilename,
      });
    } catch (err) {
      console.error("Export error:", item.id, err);
    }
  }

  // 2. Generate a "Non-User" HTML Viewer
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Photo Flip Gallery</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; color: #333; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 30px; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        img { width: 100%; height: 250px; object-fit: cover; border-bottom: 1px solid #eee; }
        .content { padding: 15px; }
        .folder { font-size: 0.7rem; text-transform: uppercase; color: #0077ff; font-weight: bold; margin-bottom: 5px; }
        .notes { font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>Photo Flip Export</h1>
    <div class="grid">
        ${meta
          .map(
            (m) => `
            <div class="card">
                <img src="images/${m.filename}" />
                <div class="content">
                    <div class="folder">${m.folder || "Main Gallery"}</div>
                    <div class="notes">${
                      m.notes || "<i>No notes added.</i>"
                    }</div>
                </div>
            </div>
        `
          )
          .join("")}
    </div>
</body>
</html>`;

  // 3. Add both the App-specific JSON and the Human-readable HTML
  zip.file("gallery.json", JSON.stringify(meta, null, 2));
  zip.file("index.html", htmlContent);

  const blob = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `gallery_export_${
    new Date().toISOString().split("T")[0]
  }.zip`;
  link.click();
}

/* ---------- ZIP IMPORT (With Merge/Duplicate Check) ---------- */
/* ---------- ZIP IMPORT (With Progress Reporting) ---------- */
export async function importGalleryZip(file, onProgress) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User must be logged in to import");

    const zip = await JSZip.loadAsync(file);
    const metaFile = zip.file("gallery.json");
    if (!metaFile) return [];

    const meta = JSON.parse(await metaFile.async("string"));
    const total = meta.length;
    const importedItems = [];

    // Fetch existing items for the merge/duplicate check
    const { data: existingItems } = await supabase
      .from("items")
      .select("image_path, notes")
      .eq("user_id", user.id);

    for (let i = 0; i < total; i++) {
      const m = meta[i];

      // Update the UI: Send current count and total back to App.jsx
      if (onProgress) onProgress(i + 1, total);

      const zipPath = `images/${m.filename}`;
      const imgFile = zip.file(zipPath);
      if (!imgFile) continue;

      const blob = await imgFile.async("blob");

      // Duplicate Check
      const isDuplicate = existingItems?.some(
        (item) => item.image_path.includes(m.filename) && item.notes === m.notes
      );

      if (isDuplicate) continue;

      // Standard Supabase Upload Logic
      const fileExt = m.filename.split(".").pop();
      const storagePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(storagePath, blob);

      if (uploadError) continue;

      const { data: dbData, error: dbError } = await supabase
        .from("items")
        .insert([
          {
            image_path: storagePath,
            user_id: user.id,
            notes: m.notes || "",
            folder: m.folder || "",
            flipped: m.flipped || false,
          },
        ])
        .select();

      if (!dbError && dbData) {
        const { data: urlData } = supabase.storage
          .from("gallery")
          .getPublicUrl(storagePath);
        importedItems.push({ ...dbData[0], imageURL: urlData.publicUrl });
      }
    }

    return importedItems;
  } catch (e) {
    console.error("Zip import failed:", e);
    throw e;
  }
}
