import JSZip from "jszip";

/* ---------- LOCAL STORAGE ---------- */

export function loadItems() {
  const saved = localStorage.getItem("gallery-items");
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    // Remove stale blob URLs so they can be regenerated from IndexedDB
    return parsed.map((item) => ({ ...item, imageURL: null }));
  } catch (e) {
    console.error("Failed to parse gallery items", e);
    return [];
  }
}

export function saveItems(items) {
  localStorage.setItem(
    "gallery-items",
    JSON.stringify(items.map(({ imageURL, ...rest }) => rest))
  );
}

const FOLDER_ALIASES = {
  All: "Folder Groups",
  Everything: "Folder Groups",
  Default: "Folder Groups",
};

export function loadFolders() {
  const saved = localStorage.getItem("gallery-folders");
  // Fix: Removed the 'S' typo from "Folder Groups"
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
    // Logic: If activeFolder is "Select Folder", show items with no folder/empty string
    // Otherwise, show items matching the specific folder name
    const folderMatch =
      activeFolder === "Select Folder"
        ? !item.folder || item.folder === ""
        : item.folder === activeFolder;

    const searchMatch = (item.notes || "").toLowerCase().includes(query);
    return folderMatch && searchMatch;
  });
}

/* ---------- ZIP EXPORT ---------- */

export async function exportGalleryZip(items, getImageBlob) {
  const zip = new JSZip();
  const meta = [];

  for (const item of items) {
    const blob = await getImageBlob(item.imageId);
    if (!blob) continue;

    // We store files in folders within the ZIP for organization
    const path = item.folder ? `${item.folder}/` : "";
    const filename = `${item.id}.jpg`;
    zip.file(`${path}${filename}`, blob);

    meta.push({
      id: item.id,
      notes: item.notes,
      tags: item.tags,
      folder: item.folder,
      flipped: item.flipped,
      filename: filename,
    });
  }

  zip.file("gallery.json", JSON.stringify(meta, null, 2));
  return await zip.generateAsync({ type: "blob" });
}

/* ---------- ZIP IMPORT (Fixed Version) ---------- */

export async function importGalleryZip(file, saveImage) {
  try {
    const zip = await JSZip.loadAsync(file);
    const metaFile = zip.file("gallery.json");
    if (!metaFile) return [];

    const meta = JSON.parse(await metaFile.async("string"));
    const imported = [];

    for (const m of meta) {
      // Correctly locate the file inside the zip folders
      const zipPath = m.folder ? `${m.folder}/${m.filename}` : m.filename;
      const imgFile = zip.file(zipPath);

      if (!imgFile) continue;

      const blob = await imgFile.async("blob");
      // Create a fresh ID for IndexedDB
      const imageId = crypto.randomUUID();
      await saveImage(imageId, blob);

      imported.push({
        ...m,
        id: crypto.randomUUID(), // New unique ID for this app instance
        imageId,
        imageURL: null, // Will be populated by the URL creator in App.jsx
      });
    }
    return imported;
  } catch (e) {
    console.error("Zip import failed", e);
    return [];
  }
}
