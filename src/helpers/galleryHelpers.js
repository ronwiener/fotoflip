import React from "react";
import JSZip from "jszip";
import { supabase } from "../supabaseClient";
import { processPhotoMetadata } from "../metadataUtils";

/* ---------- FOLDER MANAGEMENT ---------- */

const FOLDER_ALIASES = {
  All: "Folder Groups",
  Everything: "Folder Groups",
  Default: "Folder Groups",
};

/* ---------- FOLDER MANAGEMENT (Supabase Sync) ---------- */

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

export const filterItems = (items, activeFolder, search) => {
  if (!Array.isArray(items)) return [];

  const query = search.trim().toLowerCase();

  return items.filter((item) => {
    // 1. Check Folder Match ("Select Folder" or empty string = main root gallery)
    const isRootFolder = !activeFolder || activeFolder === "Select Folder";
    const itemFolder = item.folder || "";

    const matchesFolder = isRootFolder
      ? itemFolder === ""
      : itemFolder.toLowerCase() === activeFolder.toLowerCase();

    // 2. Search Override: If user typed in search bar, search globally across notes & locations
    if (query) {
      const matchesNotes = item.notes?.toLowerCase().includes(query) || false;
      const matchesLocation =
        item.location_description?.toLowerCase().includes(query) || false;

      return matchesNotes || matchesLocation;
    }

    return matchesFolder;
  });
};

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
      // 'no-cache' ensures we don't get a corrupted cached version of the image
      const response = await fetch(item.imageURL, { cache: "no-cache" });
      if (!response.ok) throw new Error("Image download failed");
      const blob = await response.blob();

      // Ensure we have a clean filename from the image path
      const cleanFilename = item.image_path.split("/").pop();

      // Add image to the root of the zip
      zip.file(cleanFilename, blob);

      meta.push({
        notes: item.notes,
        folder: item.folder,
        filename: cleanFilename,
      });
    } catch (err) {
      console.error("Export error for item:", item.id, err);
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
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; padding: 20px; color: #1e293b; }
        h1 { text-align: center; color: #334155; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 30px; }
        .card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .img-container { width: 100%; aspect-ratio: 4/3; background: #0f172a; display: flex; align-items: center; justify-content: center; }
        img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .content { padding: 16px; }
        .folder-tag { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700; display: block; margin-bottom: 4px; }
        .notes { font-size: 14px; line-height: 1.5; color: #334155; white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>Photo Flip Gallery</h1>
    <div class="grid">
        ${meta
          .map(
            (m) => `
            <div class="card">
                <div class="img-container"><img src="${m.filename}"></div>
                <div class="content">
                    <span class="folder-tag">${
                      m.folder || "Main Gallery"
                    }</span>
                    <div class="notes">${m.notes || "No notes added."}</div>
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
  // STORE is used for speed; for the App Store, we want zero lag on the "Export" tap.
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const fileName = `PhotoFlip_Export_${new Date()
    .toISOString()
    .slice(0, 10)}.zip`;
  const zipFile = new File([blob], fileName, { type: "application/zip" });

  // 4. NATIVE SHARE (iOS Share Sheet)
  // This triggers AirDrop, Files app, Messages, etc.
  if (navigator.canShare && navigator.canShare({ files: [zipFile] })) {
    try {
      await navigator.share({
        files: [zipFile],
        title: "Photo Flip Export",
        text: `Exporting ${itemsToExport.length} flipped photos.`,
      });
      return; // If share successful, stop here.
    } catch (error) {
      // If user cancels, we don't want to show an error, just fall back to download
      if (error.name !== "AbortError") {
        console.error("Share failed, falling back to download:", error);
      }
    }
  }

  // 5. FALLBACK: Browser Download (For Desktop or if Share fails)
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 100);
}

export async function importGalleryZip(file, onProgress) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User must be logged in to import");

    const zip = await JSZip.loadAsync(file);
    const metaFile = zip.file(/gallery\.json$/i)[0];
    if (!metaFile)
      throw new Error("Invalid ZIP: gallery.json metadata missing.");

    const meta = JSON.parse(await metaFile.async("string"));
    const total = meta.length;
    const importedItems = [];

    const { data: existingItems } = await supabase
      .from("items")
      .select("image_path")
      .eq("user_id", user.id);

    const existingPaths = new Set(
      existingItems?.map((i) => i.image_path.split("/").pop()),
    );

    for (let i = 0; i < total; i++) {
      const m = meta[i];
      if (onProgress) onProgress(i + 1, total);

      const imgFile = zip.file(new RegExp(`${m.filename}$`, "i"))[0];
      if (!imgFile) continue;
      if (existingPaths.has(m.filename)) continue;

      const blob = await imgFile.async("blob");

      // --- METADATA PROCESSING START ---
      // We pass the blob to your utility function
      const metadata = await processPhotoMetadata(blob);

      // Merge metadata with existing notes from gallery.json
      // If m.notes exists, we keep it and add metadata, otherwise just metadata
      const finalNotes = m.notes ? `${metadata}\n\n${m.notes}` : metadata;
      // --- METADATA PROCESSING END ---

      const cleanName = m.filename.replace(/[^a-z0-9.]/gi, "_");
      const storagePath = `${user.id}/${Date.now()}-${cleanName}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(storagePath, blob, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) continue;

      const { data: dbData, error: dbError } = await supabase
        .from("items")
        .insert([
          {
            image_path: storagePath,
            user_id: user.id,
            notes: finalNotes, // Use the merged notes here
            folder: m.folder || "",
            flipped: m.flipped || false,
          },
        ])
        .select();

      if (!dbError && dbData) {
        importedItems.push(dbData[0]);
      }
    }

    return importedItems;
  } catch (e) {
    console.error("Zip import failed:", e);
    throw e;
  }
}
