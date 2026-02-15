import React from "react";
import JSZip from "jszip";
import { supabase } from "../supabaseClient";
import * as pdfjsLib from "pdfjs-dist";

// This tells PDF.js where to find its "engine" (the worker)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const convertPdfToImage = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 }); // Scale 2 provides better quality for the editor

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
  });
};

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
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); max-width: 1000px; margin: 0 auto; gap: 30px; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        img { width: 100%; height: auto;  object-fit: contain; display: block;  background: #000: border-bottom: 1px solid #eee; }
        .content { padding: 15px; background: white;}
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
        `,
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

    // 1. Find the metadata file anywhere in the zip
    const metaFile = zip.file(/gallery\.json$/i)[0];
    if (!metaFile) {
      alert("Invalid ZIP: gallery.json not found.");
      return [];
    }

    const meta = JSON.parse(await metaFile.async("string"));
    const total = meta.length;
    const importedItems = [];

    const { data: existingItems } = await supabase
      .from("items")
      .select("image_path, notes")
      .eq("user_id", user.id);

    for (let i = 0; i < total; i++) {
      const m = meta[i];
      if (onProgress) onProgress(i + 1, total);

      // 2. FORGIVING SEARCH: Look for the image file by name, ignoring folders
      const imgFile = zip.file(new RegExp(`${m.filename}$`, "i"))[0];
      if (!imgFile) continue;

      const blob = await imgFile.async("blob");

      // Duplicate Check
      const isDuplicate = existingItems?.some(
        (item) =>
          item.image_path.includes(m.filename) && item.notes === m.notes,
      );
      if (isDuplicate) continue;

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
