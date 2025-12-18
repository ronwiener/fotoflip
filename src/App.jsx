import { useEffect, useRef, useState } from "react";
import { useImageDB } from "./hooks/useImageDB";
import "./styles.css";

import {
  loadItems,
  saveItems,
  loadFolders,
  saveFolders,
  filterItems,
  exportGalleryZip,
  importGalleryZip,
} from "./helpers/galleryHelpers";

export default function App() {
  const imageInputRef = useRef(null);
  const zipInputRef = useRef(null);
  const { saveImage, getImageURL, getImageBlob } = useImageDB();

  /* ---------- STATE ---------- */

  const [items, setItems] = useState(loadItems);
  const [folders, setFolders] = useState(loadFolders);
  const [activeFolder, setActiveFolder] = useState("Select Folder");
  const [search, setSearch] = useState("");
  const [zoomImage, setZoomImage] = useState(null);
  const [noteZoomItem, setNoteZoomItem] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");

  /* ---------- PERSIST ---------- */

  const persistItems = (next) => {
    setItems(next);
    saveItems(next);
  };

  /* ---------- UPLOAD IMAGES ---------- */

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    const newItems = [];

    for (const file of files) {
      const imageId = crypto.randomUUID();
      await saveImage(imageId, file);

      const imageURL = URL.createObjectURL(file);

      newItems.push({
        id: crypto.randomUUID(),
        imageId,
        imageURL,
        notes: "",
        tags: [],
        folder: "",
        flipped: false,
      });
    }

    persistItems([...items, ...newItems]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const clearGallery = () => {
    if (!window.confirm("Clear entire gallery?")) return;
    localStorage.removeItem("gallery-items");
    setItems([]);
  };

  /* ---------- LOAD IMAGES FROM INDEXEDDB ---------- */

  useEffect(() => {
    let cancelled = false;

    const loadImages = async () => {
      const updated = await Promise.all(
        items.map(async (item) => {
          if (item.imageURL) return item;
          try {
            const url = await getImageURL(item.imageId);
            return url ? { ...item, imageURL: url } : item;
          } catch {
            return item;
          }
        })
      );

      if (!cancelled) setItems(updated);
    };

    loadImages();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- CARD ACTIONS ---------- */

  const toggleFlip = (id) => {
    persistItems(
      items.map((item) =>
        item.id === id ? { ...item, flipped: !item.flipped } : item
      )
    );
  };

  const updateNotes = (id, notes) => {
    persistItems(
      items.map((item) => (item.id === id ? { ...item, notes } : item))
    );
  };

  const openNoteZoom = (item) => {
    setNoteZoomItem(item);
    setNoteDraft(item.notes);
  };

  const saveNoteZoom = () => {
    if (!noteZoomItem) return;
    updateNotes(noteZoomItem.id, noteDraft);
    setNoteZoomItem(null);
  };

  /* ---------- FILTER ---------- */

  const visibleItems = filterItems(items, activeFolder, search);

  /* ---------- FOLDERS ---------- */

  const addFolder = () => {
    const name = prompt("New folder name:");
    if (!name) return;

    const trimmed = name.trim();
    if (!trimmed || folders.includes(trimmed)) return;

    const updated = [...folders, trimmed];
    setFolders(updated);
    saveFolders(updated);
  };

  /* ---------- ZIP EXPORT ---------- */

  const exportZip = async () => {
    const blob = await exportGalleryZip(items, getImageBlob);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gallery.zip";
    a.click();
  };

  /* ---------- ZIP IMPORT ---------- */

  const importZip = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imported = await importGalleryZip(file, saveImage);
    persistItems([...items, ...imported]);

    if (zipInputRef.current) zipInputRef.current.value = "";
  };

  return (
    <div className="app">
      <h1>Image Gallery</h1>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <h3>Folders</h3>

        {folders.map((f) => (
          <button
            key={f}
            className={f === activeFolder ? "active" : ""}
            onClick={() => setActiveFolder(f)}
          >
            {f}
          </button>
        ))}

        <button className="add-folder-btn" onClick={addFolder}>
          ➕ New Folder
        </button>
      </aside>

      {/* MAIN */}
      <main>
        <div className="controls">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
          />
          <button onClick={clearGallery}>Clear Gallery</button>
          <button onClick={() => zipInputRef.current.click()}>
            Import ZIP
          </button>
          <button onClick={exportZip}>Export ZIP</button>
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip"
            hidden
            onChange={importZip}
          />
          <input
            placeholder="Search notes or tags"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="gallery">
          {visibleItems.map((item) => (
            <div key={item.id} className="card-wrapper">
              <div className={`card ${item.flipped ? "flipped" : ""}`}>
                {/* FRONT */}
                <div
                  className="card-face card-front"
                  onClick={() => toggleFlip(item.id)}
                >
                  {item.imageURL ? (
                    <img src={item.imageURL} alt="" />
                  ) : (
                    <div className="image-placeholder" />
                  )}

                  <button
                    className="zoom-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomImage(item.imageURL);
                    }}
                  >
                    🔍
                  </button>

                  {item.folder && (
                    <div className="folder-badge">📁 {item.folder}</div>
                  )}
                </div>

                {/* BACK */}
                <div className="card-face card-back">
                  <div className="notes-content">
                    <textarea
                      value={item.notes}
                      onChange={(e) => updateNotes(item.id, e.target.value)}
                      placeholder="Write notes here..."
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div className="notes-actions">
                      <button
                        className="back-zoom-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openNoteZoom(item);
                        }}
                      >
                        🔍
                      </button>
                      <button
                        className="back-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFlip(item.id);
                        }}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* IMAGE ZOOM */}
      {zoomImage && (
        <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="Zoomed" />
        </div>
      )}

      {/* NOTES ZOOM */}
      {noteZoomItem && (
        <div className="notes-zoom-overlay">
          <div className="notes-zoom-panel">
            <h3>Notes</h3>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              autoFocus
            />
            <div className="notes-actions">
              <button onClick={saveNoteZoom}>Save</button>
              <button onClick={() => setNoteZoomItem(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
