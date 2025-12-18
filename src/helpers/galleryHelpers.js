import JSZip from "jszip";

/* ---------- LOCAL STORAGE ---------- */

export function loadItems() {
  const saved = localStorage.getItem("gallery-items");
  if (!saved) return [];
  const parsed = JSON.parse(saved);

  // Remove stale blob URLs
  return parsed.map((item) => ({ ...item, imageURL: null }));
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
  if (!saved) return ["SFolder Groups"];

  const folders = JSON.parse(saved);

  return folders.map((f) => FOLDER_ALIASES[f] ?? f);
}

export function saveFolders(folders) {
  localStorage.setItem("gallery-folders", JSON.stringify(folders));
}

/* ---------- FILTERING ---------- */

export function filterItems(items, activeFolder, search) {
  const query = search.toLowerCase();

  return items.filter((item) => {
    const folderMatch =
      activeFolder === "Select Folder" || item.folder === activeFolder;

    const searchMatch =
      item.notes.toLowerCase().includes(query) ||
      item.tags.some((t) => t.toLowerCase().includes(query));

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

    const path = item.folder ? `${item.folder}/` : "";
    zip.folder(path).file(`${item.id}.jpg`, blob);

    meta.push({
      id: item.id,
      notes: item.notes,
      tags: item.tags,
      folder: item.folder,
      flipped: item.flipped,
      filename: `${item.id}.jpg`,
    });
  }

  zip.file("gallery.json", JSON.stringify(meta, null, 2));

  const out = await zip.generateAsync({ type: "blob" });
  return out;
}

/* ---------- ZIP IMPORT ---------- */

export async function importGalleryZip(file, saveImage) {
  const zip = await JSZip.loadAsync(file);
  const meta = JSON.parse(await zip.file("gallery.json").async("string"));

  const imported = [];

  for (const m of meta) {
    const imgFile = zip.file(
      m.folder ? `${m.folder}/${m.filename}` : m.filename
    );
    if (!imgFile) continue;

    const blob = await imgFile.async("blob");
    const imageId = crypto.randomUUID();
    await saveImage(imageId, blob);

    imported.push({
      ...m,
      imageId,
      imageURL: null,
    });
  }

  return imported;
}
