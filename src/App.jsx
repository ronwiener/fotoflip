import React, { useEffect, useState, useMemo, useRef } from "react";
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
} from "./helpers/galleryHelpers";

/* ---------- COMPONENTS ---------- */

function MainGalleryDropZone({ activeFolder, setActiveFolder }) {
  const { isOver, setNodeRef } = useDroppable({ id: "Select Folder" });

  return (
    <div
      ref={setNodeRef}
      className={`main-gallery-btn ${
        activeFolder === "Select Folder" ? "active" : ""
      } ${isOver ? "folder-hover-active" : ""}`}
      onClick={() => setActiveFolder("Select Folder")}
    >
      Main Gallery
    </div>
  );
}

function FolderButton({ f, activeFolder, setActiveFolder, onDelete }) {
  const { isOver, setNodeRef } = useDroppable({ id: f });

  return (
    <div
      ref={setNodeRef}
      className={`folder-item ${f === activeFolder ? "active" : ""} ${
        isOver ? "folder-hover-active" : ""
      }`}
    >
      <button onClick={() => setActiveFolder(f)} className="folder-name-btn">
        {f}
      </button>
      <button
        className="delete-folder-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(f);
        }}
        title="Delete Folder"
      >
        &times;
      </button>
    </div>
  );
}

function TrashDropZone({ selectedCount, onBulkDelete, isDropping }) {
  const { isOver, setNodeRef } = useDroppable({ id: "TRASH_BIN" });
  return (
    <div
      ref={setNodeRef}
      className={`trash-zone 
        ${isOver ? "trash-over" : ""} 
        ${selectedCount > 0 ? "has-selection" : ""} 
        ${isDropping ? "trash-dropped" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (selectedCount > 0) onBulkDelete();
      }}
    >
      <span>
        {selectedCount > 0
          ? `🗑 Delete Selection (${selectedCount})`
          : "🗑 Trash"}
      </span>
    </div>
  );
}

function DraggableCard({
  item,
  isSelected,
  onToggleSelect,
  onFlip,
  onZoom,
  updateNotes,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
    });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 999 : 1,
  };

  const handleCardClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(item.id);
    } else if (!isSelected && !isDragging) {
      onFlip(item.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-wrapper ${isSelected ? "selected" : ""}`}
      onClick={handleCardClick}
    >
      <div className={`card ${item.flipped ? "flipped" : ""}`}>
        <div className="card-face card-front">
          <button
            className="zoom-btn"
            onClick={(e) => {
              e.stopPropagation();
              onZoom({ type: "img", url: item.imageURL });
            }}
          >
            🔍
          </button>
          <div className="drag-handle" {...listeners} {...attributes}>
            <img src={item.imageURL} alt="" />
          </div>
        </div>

        <div className="card-face card-back">
          <div className="notes-content">
            <textarea
              value={item.notes}
              placeholder="Zoom in to write notes here..."
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateNotes(item.id, e.target.value)}
            />
            <div className="notes-actions">
              <button
                className="back-zoom-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onZoom({ type: "notes", content: item.notes, id: item.id });
                }}
              >
                🔍 Zoom
              </button>
              <button
                className="back-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFlip(item.id);
                }}
              >
                Flip
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- MAIN APP ---------- */

export default function App() {
  const { saveImage, getImageURL, deleteImage } = useImageDB();

  const [items, setItems] = useState(() => loadItems() || []);
  const [folders, setFolders] = useState(
    () => loadFolders() || ["Folder Groups"]
  );
  const [activeFolder, setActiveFolder] = useState("Select Folder");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [zoomData, setZoomData] = useState(null);
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [isDropping, setIsDropping] = useState(false);

  const fileInputRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  const triggerTrashAnimation = () => {
    setIsDropping(true);
    setTimeout(() => setIsDropping(false), 300);
  };

  const persistItems = (newItems) => {
    setItems(newItems);
    saveItems(newItems);
  };

  const updateNotes = (id, notes) => {
    persistItems(items.map((i) => (i.id === id ? { ...i, notes } : i)));
  };

  const handleFolderDelete = (folderName) => {
    if (
      window.confirm(
        `Delete "${folderName}"? Images will move to Main Gallery.`
      )
    ) {
      persistItems(
        items.map((item) =>
          item.folder === folderName ? { ...item, folder: "" } : item
        )
      );
      const nextFolders = folders.filter((f) => f !== folderName);
      setFolders(nextFolders);
      saveFolders(nextFolders);
      if (activeFolder === folderName) setActiveFolder("Select Folder");
    }
  };

  useEffect(() => {
    let isMounted = true;
    const syncUrls = async () => {
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          if (!item.imageURL && item.imageId) {
            const url = await getImageURL(item.imageId);
            return { ...item, imageURL: url };
          }
          return item;
        })
      );
      if (isMounted) setItems(updatedItems);
    };
    syncUrls();
    return () => {
      isMounted = false;
    };
  }, [items.length]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;

    const draggedIds = selectedIds.has(active.id)
      ? Array.from(selectedIds)
      : [active.id];

    if (over.id === "TRASH_BIN") {
      if (window.confirm(`Delete ${draggedIds.length} item(s)?`)) {
        triggerTrashAnimation();
        for (let id of draggedIds) {
          const item = items.find((i) => i.id === id);
          if (item) await deleteImage(item.imageId);
        }
        persistItems(items.filter((i) => !draggedIds.includes(i.id)));
        setSelectedIds(new Set());
      }
      return;
    }

    const targetFolder = over.id === "Select Folder" ? "" : over.id;
    persistItems(
      items.map((i) =>
        draggedIds.includes(i.id) ? { ...i, folder: targetFolder } : i
      )
    );
    setSelectedIds(new Set());
  };

  const visibleItems = useMemo(
    () => filterItems(items, activeFolder, search) || [],
    [items, activeFolder, search]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) =>
        setActiveDragItem(items.find((i) => i.id === e.active.id))
      }
      onDragEnd={handleDragEnd}
    >
      <div className="app">
        <aside className="sidebar">
          <MainGalleryDropZone
            activeFolder={activeFolder}
            setActiveFolder={setActiveFolder}
          />
          <div className="folder-list">
            {folders.map((f) =>
              f === "Folder Groups" ? (
                <h3 key={f}>{f}</h3>
              ) : (
                <FolderButton
                  key={f}
                  f={f}
                  activeFolder={activeFolder}
                  setActiveFolder={setActiveFolder}
                  onDelete={handleFolderDelete}
                />
              )
            )}
          </div>
          <button
            className="add-folder-btn"
            onClick={() => {
              const n = prompt("Folder Name:");
              if (n?.trim()) {
                const next = [...folders, n.trim()];
                setFolders(next);
                saveFolders(next);
              }
            }}
          >
            ➕ New Folder
          </button>

          <TrashDropZone
            isDropping={isDropping}
            selectedCount={selectedIds.size}
            onBulkDelete={async () => {
              if (window.confirm(`Delete ${selectedIds.size} items?`)) {
                triggerTrashAnimation();
                for (let id of selectedIds) {
                  const item = items.find((i) => i.id === id);
                  if (item) await deleteImage(item.imageId);
                }
                persistItems(items.filter((i) => !selectedIds.has(i.id)));
                setSelectedIds(new Set());
              }
            }}
          />
        </aside>

        <main>
          <div>
            <h1>
              Photo <span className="flip-text">Flip</span>
            </h1>
          </div>
          <div className="controls">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={async (e) => {
                const files = Array.from(e.target.files);
                const newItems = [];
                for (const file of files) {
                  const id = crypto.randomUUID();
                  await saveImage(id, file);
                  newItems.push({
                    id: crypto.randomUUID(),
                    imageId: id,
                    imageURL: URL.createObjectURL(file),
                    notes: "",
                    folder: "",
                    flipped: false,
                  });
                }
                persistItems([...items, ...newItems]);

                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            />
            <input
              type="text"
              placeholder="Search notes..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="gallery">
            {visibleItems.map((item) => (
              <DraggableCard
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={(id) => {
                  const next = new Set(selectedIds);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  setSelectedIds(next);
                }}
                onFlip={(id) =>
                  setItems(
                    items.map((i) =>
                      i.id === id ? { ...i, flipped: !i.flipped } : i
                    )
                  )
                }
                onZoom={setZoomData}
                updateNotes={updateNotes}
              />
            ))}
          </div>
        </main>

        <DragOverlay modifiers={[snapCenterToCursor]}>
          {activeDragItem ? (
            <div className="card-drag-preview">
              <img
                src={activeDragItem.imageURL}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "8px",
                }}
              />
              {selectedIds.size > 1 && selectedIds.has(activeDragItem.id) && (
                <div className="drag-count-badge">{selectedIds.size}</div>
              )}
            </div>
          ) : null}
        </DragOverlay>

        {zoomData && (
          <div className="zoom-overlay" onClick={() => setZoomData(null)}>
            {zoomData.type === "notes" ? (
              <div
                className="zoomed-notes-box"
                onClick={(e) => e.stopPropagation()}
              >
                <textarea
                  value={items.find((i) => i.id === zoomData.id)?.notes || ""}
                  onChange={(e) => updateNotes(zoomData.id, e.target.value)}
                />
                <button
                  className="close-zoom-btn"
                  onClick={() => setZoomData(null)}
                >
                  Close
                </button>
              </div>
            ) : (
              <img src={zoomData.url} alt="" />
            )}
          </div>
        )}
      </div>
    </DndContext>
  );
}
