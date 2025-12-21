import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
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

/* ---------- DND WRAPPER: FOLDER ---------- */
function FolderButton({ f, activeFolder, setActiveFolder, onDelete }) {
  const { isOver, setNodeRef } = useDroppable({ id: f });
  const style = {
    backgroundColor: isOver ? "#a5d6a7" : undefined,
    border: isOver ? "2px dashed #4caf50" : undefined,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`folder-item ${f === activeFolder ? "active" : ""}`}
    >
      <button
        onClick={() => setActiveFolder(f)}
        style={{
          flex: 1,
          border: "none",
          background: "none",
          color: "inherit",
        }}
      >
        {f}
      </button>
      <span
        className="delete-folder-btn"
        style={{ cursor: "pointer", padding: "0 5px", fontWeight: "bold" }}
        title="Delete Folder"
        onClick={(e) => {
          e.stopPropagation(); // Prevents clicking the folder when hitting delete
          onDelete(f);
        }}
      >
        &times;
      </span>
    </div>
  );
}

/* ---------- DND WRAPPER: GALLERY DROP ZONE ---------- */
function GalleryDropZone({ activeFolder, setActiveFolder }) {
  const { isOver, setNodeRef } = useDroppable({ id: "Select Folder" });
  const style = {
    backgroundColor: isOver ? "aliceblue" : "aliceblue",
    border: isOver ? "4px solid black" : "4px solid black",
    padding: "10px",
    marginBottom: "20px",
    borderRadius: "8px",
    textAlign: "center",
    cursor: "pointer",
    fontWeight: activeFolder === "Select Folder" ? "bold" : "normal",
    color: activeFolder === "Select Folder" ? "#173251FF" : "#173251FF",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setActiveFolder("Select Folder")}
    >
      Main Gallery
    </div>
  );
}

/* ---------- DND WRAPPER: TRASH DROP ZONE ---------- */
function TrashDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: "TRASH_BIN" });

  return (
    <div
      ref={setNodeRef}
      className={`trash-zone ${isOver ? "trash-over" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
      }}
    >
      <svg
        className="trash-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
        width="24"
        height="24"
      >
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
      </svg>
      <span>{isOver ? "Delete" : "Delete"}</span>
    </div>
  );
}

/* ---------- DND WRAPPER: CARD ---------- */
function DraggableCard({ item, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: item.id });
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0 : 1,
    cursor: "grab",
    zIndex: isDragging ? 1000 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="card-wrapper"
    >
      {children}
    </div>
  );
}

/* ---------- MAIN APP ---------- */
export default function App() {
  const imageInputRef = useRef(null);
  const zipInputRef = useRef(null);
  const { saveImage, getImageURL, getImageBlob, deleteImage } = useImageDB();

  const [items, setItems] = useState(loadItems);
  const [folders, setFolders] = useState(loadFolders);
  const [activeFolder, setActiveFolder] = useState("Select Folder");
  const [search, setSearch] = useState("");
  const [zoomImage, setZoomImage] = useState(null);
  const [noteZoomItem, setNoteZoomItem] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [activeDragItem, setActiveDragItem] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const persistItems = (next) => {
    setItems(next);
    saveItems(next);
  };

  /* ---------- ZIP FUNCTIONS ---------- */
  async function exportZip() {
    const blob = await exportGalleryZip(items, getImageBlob);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gallery.zip";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importZip(e) {
    const file = e.target.files[0];
    if (!file) return;
    const imported = await importGalleryZip(file, saveImage);
    persistItems([...items, ...imported]);
    if (zipInputRef.current) zipInputRef.current.value = "";
  }

  /* ---------- DND HANDLERS ---------- */
  const handleDragStart = (event) => {
    const item = items.find((i) => i.id === event.active.id);
    setActiveDragItem(item);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;

    if (over.id === "TRASH_BIN") {
      if (window.confirm("Delete this image forever?")) {
        const itemToDelete = items.find((i) => i.id === active.id);
        persistItems(items.filter((item) => item.id !== active.id));
        if (itemToDelete) await deleteImage(itemToDelete.imageId);
      }
      return;
    }

    const nextItems = items.map((item) => {
      if (item.id === active.id) {
        const newFolder = over.id === "Select Folder" ? "" : over.id;
        return { ...item, folder: newFolder };
      }
      return item;
    });
    persistItems(nextItems);
  };

  /* -------------Delete Folders -----*/
  const deleteFolder = (folderName) => {
    if (
      window.confirm(
        `Delete folder "${folderName}"? Images will move to Main Gallery.`
      )
    ) {
      // 1. Remove folder from folders list
      const updatedFolders = folders.filter((f) => f !== folderName);
      setFolders(updatedFolders);
      saveFolders(updatedFolders);

      // 2. Move images in that folder to the main gallery (empty string)
      const updatedItems = items.map((item) =>
        item.folder === folderName ? { ...item, folder: "" } : item
      );
      persistItems(updatedItems);

      // 3. Reset active folder if it was the one deleted
      if (activeFolder === folderName) {
        setActiveFolder("Select Folder");
      }
    }
  };
  /* ---------- UPLOAD & CORE LOGIC ---------- */
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    const newItems = [];
    for (const file of files) {
      const imageId = crypto.randomUUID();
      await saveImage(imageId, file);
      newItems.push({
        id: crypto.randomUUID(),
        imageId,
        imageURL: URL.createObjectURL(file),
        notes: "",
        tags: [],
        folder: "",
        flipped: false,
      });
    }
    persistItems([...items, ...newItems]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  useEffect(() => {
    let cancelled = false;
    const loadImages = async () => {
      const needsLoading = items.filter((item) => !item.imageURL);
      if (needsLoading.length === 0) return;
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
  }, [items.length]);

  const toggleFlip = (id) =>
    persistItems(
      items.map((i) => (i.id === id ? { ...i, flipped: !i.flipped } : i))
    );
  const updateNotes = (id, notes) =>
    persistItems(items.map((i) => (i.id === id ? { ...i, notes } : i)));
  const openNoteZoom = (item) => {
    setNoteZoomItem(item);
    setNoteDraft(item.notes);
  };
  const saveNoteZoom = () => {
    updateNotes(noteZoomItem.id, noteDraft);
    setNoteZoomItem(null);
  };

  const visibleItems = filterItems(items, activeFolder, search);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="app">
        <aside className="sidebar">
          {" "}
          <GalleryDropZone
            activeFolder={activeFolder}
            setActiveFolder={setActiveFolder}
          />
          <div className="folder-list" style={{ flex: 1, overflowY: "auto" }}>
            {folders.map((f) =>
              f === "Folder Groups" ? (
                <h3 key={f} className="sidebar-heading">
                  {f}
                </h3>
              ) : (
                <FolderButton
                  key={f}
                  f={f}
                  activeFolder={activeFolder}
                  setActiveFolder={setActiveFolder}
                  onDelete={deleteFolder} // Pass the function here
                />
              )
            )}
            <button
              className="add-folder-btn"
              onClick={() => {
                const name = prompt("New folder name:");
                if (name && !folders.includes(name.trim())) {
                  const updated = [...folders, name.trim()];
                  setFolders(updated);
                  saveFolders(updated);
                }
              }}
            >
              ➕ New Folder
            </button>
          </div>
          <TrashDropZone />
        </aside>

        <main>
          <h1 className="gallery-heading">Photo</h1>
          <div className="controls">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
            />
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
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="gallery">
            {visibleItems.map((item) => (
              <DraggableCard key={item.id} item={item}>
                <div className={`card ${item.flipped ? "flipped" : ""}`}>
                  <div
                    className="card-face card-front"
                    onClick={() => toggleFlip(item.id)}
                  >
                    <img src={item.imageURL} alt="" />
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
                  <div className="card-face card-back">
                    <div className="notes-content">
                      {/* Textarea for notes */}
                      <textarea
                        value={item.notes}
                        placeholder="Click zoom to write notes..."
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateNotes(item.id, e.target.value)}
                      />

                      {/* Guidance text: Only shows if notes are empty */}
                      {!item.notes && (
                        <div
                          className="notes-guidance"
                          style={{
                            fontSize: "0.75rem",
                            color: "#999",
                            textAlign: "center",
                            marginBottom: "5px",
                            pointerEvents: "none",
                          }}
                        >
                          {/*   💡 Click zoom to write notes */}
                        </div>
                      )}

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
              </DraggableCard>
            ))}
          </div>
        </main>

        <DragOverlay modifiers={[snapCenterToCursor]}>
          {activeDragItem && (
            <div className="card-overlay">
              <div className="card">
                <div className="card-face card-front">
                  <img src={activeDragItem.imageURL} alt="Dragging" />
                </div>
              </div>
            </div>
          )}
        </DragOverlay>

        {zoomImage && (
          <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
            <img src={zoomImage} alt="" />
          </div>
        )}
        {noteZoomItem && (
          <div className="notes-zoom-overlay">
            <div className="notes-zoom-panel">
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
    </DndContext>
  );
}

/*
Better Alternative: Change it to a Global Search that filters both Folder names and Notes. This makes it a powerful navigation tool rather than just a text filter.

*/
