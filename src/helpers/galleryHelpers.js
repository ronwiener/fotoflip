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

export async function exportGalleryZip(items) {
  const zip = new JSZip();
  const meta = [];

  for (const item of items) {
    try {
      const response = await fetch(item.imageURL);
      if (!response.ok) throw new Error("Image download failed");
      const blob = await response.blob();

      // Standardize the filename inside the ZIP
      const cleanFilename = item.image_path.split("/").pop();
      const zipPath = item.folder
        ? `${item.folder}/${cleanFilename}`
        : cleanFilename;

      zip.file(zipPath, blob);

      meta.push({
        notes: item.notes,
        folder: item.folder,
        flipped: item.flipped,
        filename: cleanFilename,
      });
    } catch (err) {
      console.error("Export error for item:", item.id, err);
    }
  }

  zip.file("gallery.json", JSON.stringify(meta, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `gallery_backup_${
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

      const zipPath = m.folder ? `${m.folder}/${m.filename}` : m.filename;
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
