import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { useImageDB } from "./hooks/useImageDB";
import "./styles.css";

export default function App() {
  const imageInputRef = useRef(null);
  const zipInputRef = useRef(null);
  const { saveImage, getImageURL, getImageBlob } = useImageDB();

  /* ---------- STATE ---------- */
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem("gallery-items");
    if (!saved) return [];
    const parsed = JSON.parse(saved);

    // Remove old blob URLs from previous sessions
    return parsed.map((item) => ({ ...item, imageURL: null }));
  });

  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem("gallery-folders");
    return saved ? JSON.parse(saved) : ["All"];
  });
  const [activeFolder, setActiveFolder] = useState("All");
  const [search, setSearch] = useState("");
  const [zoomImage, setZoomImage] = useState(null);
  const [noteZoomItem, setNoteZoomItem] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");

  /* ---------- PERSIST ---------- */
  const persistItems = (next) => {
    setItems(next);
    // Save without imageURL
    localStorage.setItem(
      "gallery-items",
      JSON.stringify(next.map(({ imageURL, ...rest }) => rest))
    );
  };

  /* ---------- UPLOAD IMAGES ---------- */
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    const newItems = [];

    for (const file of files) {
      const imageId = crypto.randomUUID();
      await saveImage(imageId, file);

      // Create object URL immediately for front display
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
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          if (item.imageURL) return item;

          try {
            const url = await getImageURL(item.imageId);
            return url ? { ...item, imageURL: url } : item;
          } catch (err) {
            console.error("Failed to load image from IndexedDB:", err);
            return item;
          }
        })
      );

      if (!cancelled) setItems(updatedItems);
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
  const visibleItems = items.filter((item) => {
    const folderMatch = activeFolder === "All" || item.folder === activeFolder;
    const searchMatch =
      item.notes.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return folderMatch && searchMatch;
  });

  /*-----------Folder <create---------->*/
  const addFolder = () => {
    const name = prompt("New folder name:");
    if (!name) return;

    const trimmed = name.trim();
    if (!trimmed || folders.includes(trimmed)) return;

    const updated = [...folders, trimmed];
    setFolders(updated);
    localStorage.setItem("gallery-folders", JSON.stringify(updated));
  };

  /* ---------- ZIP EXPORT ---------- */
  const exportZip = async () => {
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
    const a = document.createElement("a");
    a.href = URL.createObjectURL(out);
    a.download = "gallery.zip";
    a.click();
  };

  /* ---------- ZIP IMPORT ---------- */
  const importZip = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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

      {/* FRONT IMAGE ZOOM MODAL */}
      {zoomImage && (
        <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="Zoomed" />
        </div>
      )}

      {/* NOTES ZOOM MODAL */}
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
