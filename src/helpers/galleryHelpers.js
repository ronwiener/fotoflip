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
      // Use cache: 'no-cache' to ensure we get fresh data on mobile
      const response = await fetch(item.imageURL, { cache: "no-cache" });
      if (!response.ok) throw new Error("Image download failed");
      const blob = await response.blob();

      const cleanFilename = item.image_path.split("/").pop();

      // FIX: Place images in root or a simple folder.
      // Mobile Safari handles root files better.
      zip.file(cleanFilename, blob);

      meta.push({
        notes: item.notes,
        folder: item.folder,
        filename: cleanFilename,
      });
    } catch (err) {
      console.error("Export error:", item.id, err);
    }
  }

  // 2. Generate the HTML Viewer Template (Updated paths for flat ZIP)
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Photo Flip Export</title>
    <style>
        body { font-family: -apple-system, sans-serif; background: #f8fafc; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        img { width: 100%; aspect-ratio: 4/3; object-fit: contain; background: #000; }
        .content { padding: 15px; }
        .notes { font-size: 14px; white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>Photo Flip Gallery</h1>
    <div class="grid">
        ${meta
          .map(
            (m) => `
            <div class="card">
                <img src="${m.filename}">
                <div class="content">
                    <strong>${m.folder || "Main Gallery"}</strong>
                    <div class="notes">${m.notes || ""}</div>
                </div>
            </div>`,
          )
          .join("")}
    </div>
</body>
</html>`;

  zip.file("gallery.json", JSON.stringify(meta, null, 2));
  zip.file("index.html", htmlContent);

  // 3. Generate ZIP as Blob
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "STORE", // No compression makes it faster and more stable for mobile CPUs
  });

  const fileName = `PhotoFlip_Export.zip`;

  // 4. SMART SHARE LOGIC (Optimized for iOS)
  if (navigator.share) {
    const zipFile = new File([blob], fileName, { type: "application/zip" });
    if (navigator.canShare && navigator.canShare({ files: [zipFile] })) {
      try {
        await navigator.share({
          files: [zipFile],
          title: "Photo Flip Export",
        });
        return; // Success
      } catch (error) {
        if (error.name !== "AbortError") console.error("Share failed", error);
      }
    }
  }

  // 5. FALLBACK: Direct Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
