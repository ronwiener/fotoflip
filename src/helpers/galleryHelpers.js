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

const FOLDER_ALIASES = {
  All: "Folder Groups",
  Everything: "Folder Groups",
  Default: "Folder Groups",
};

/* ---------- FOLDER MANAGEMENT (Supabase Sync) ---------- */

export async function loadFolders(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("folders")
    .select("name")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading folders:", error);
    return [];
  }
  // This extracts just the names into an array: ["Folder 1", "Folder 2"]
  return data.map((f) => f.name);
}

export async function saveFolders(userId, folderName, isDelete = false) {
  if (!userId) return;

  if (isDelete) {
    const { error } = await supabase
      .from("folders")
      .delete()
      .eq("user_id", userId)
      .eq("name", folderName);
    if (error) console.error("Delete folder error:", error);
  } else {
    const { error } = await supabase
      .from("folders")
      .insert([{ user_id: userId, name: folderName }]);
    if (error) console.error("Save folder error:", error);
  }
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

  // 2. Generate the HTML Viewer Template
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Photo Flip Export</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px 20px; line-height: 1.5; }
        .header { max-width: 1000px; margin: 0 auto 30px; display: flex; justify-content: space-between; align-items: center; }
        h1 { margin: 0; color: #0f172a; font-size: 24px; }
        .print-btn { padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); max-width: 1000px; margin: 0 auto; gap: 24px; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; display: flex; flex-direction: column; }
        .img-container { width: 100%; aspect-ratio: 4/3; background: #f1f5f9; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        img { width: 100%; height: 100%; object-fit: contain; }
        .content { padding: 16px; flex-grow: 1; display: flex; flex-direction: column; }
        .folder-badge { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6366f1; background: #eef2ff; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; align-self: flex-start; }
        .notes { font-size: 14px; color: #475569; white-space: pre-wrap; word-break: break-word; }
        @media print { .print-btn { display: none; } body { background: white; padding: 0; } .card { box-shadow: none; border: 1px solid #eee; page-break-inside: avoid; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Photo Flip Gallery</h1>
        <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
    </div>
    <div class="grid">
        ${meta
          .map(
            (m) => `
            <div class="card">
                <div class="img-container">
                    <img src="images/${m.filename}" alt="Gallery Image">
                </div>
                <div class="content">
                    <div class="folder-badge">${m.folder || "Main Gallery"}</div>
                    <div class="notes">${m.notes || "<i>No notes added.</i>"}</div>
                </div>
            </div>
        `,
          )
          .join("")}
    </div>
</body>
</html>`;

  // 3. Finalize the ZIP
  zip.file("gallery.json", JSON.stringify(meta, null, 2));
  zip.file("index.html", htmlContent);

  const blob = await zip.generateAsync({ type: "blob" });
  const fileName = `PhotoFlip_Export_${new Date().toISOString().split("T")[0]}.zip`;
  const zipFile = new File([blob], fileName, { type: "application/zip" });

  // 4. SMART SHARE LOGIC
  if (navigator.canShare && navigator.canShare({ files: [zipFile] })) {
    try {
      await navigator.share({
        files: [zipFile],
        title: "Photo Flip Export",
        text: "Attached is an organized gallery with notes.",
      });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Share failed:", error);
    }
  }

  // 5. FALLBACK: Standard Download
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 100);
}

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
