import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
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
      className={`nav-btn main-gallery-btn ${
        activeFolder === "Select Folder" ? "active" : ""
      } ${isOver ? "folder-hover-active" : ""}`}
      onClick={() => setActiveFolder("Select Folder")}
    >
      Main
    </div>
  );
}

function FolderButton({ f, activeFolder, setActiveFolder, onDelete }) {
  const { isOver, setNodeRef } = useDroppable({ id: f });
  if (f === "Folder Groups") return null;

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
      className={`trash-zone ${isOver ? "trash-over" : ""} ${
        isDropping ? "trash-dropped" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        if (selectedCount > 0) onBulkDelete();
      }}
    >
      <span>{selectedCount > 0 ? `🗑 (${selectedCount})` : "🗑 Trash"}</span>
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
  });

  const handleCardClick = (e) => {
    if (isDragging) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      e.preventDefault();
      onToggleSelect(item.id);
    } else if (!isSelected) {
      onFlip(item.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`card-wrapper ${isSelected ? "selected" : ""} ${
        isDragging ? "is-dragging" : ""
      }`}
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
          <div
            className="drag-handle"
            {...listeners}
            {...attributes}
            style={{ height: "100%", width: "100%" }}
          >
            {item.imageURL ? (
              <img src={item.imageURL} alt="" />
            ) : (
              <div className="image-loading-placeholder" />
            )}
          </div>
        </div>
        <div className="card-face card-back">
          <div className="notes-content">
            <textarea
              value={item.notes}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateNotes(item.id, e.target.value)}
              placeholder="Write notes..."
            />
            <div className="notes-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onZoom({ type: "notes", content: item.notes, id: item.id });
                }}
              >
                🔍 Zoom
              </button>
              <button
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

export default function App() {
  const { saveImage, getImageURL, deleteImage } = useImageDB();
  const [items, setItems] = useState(() => loadItems() || []);
  const [folders, setFolders] = useState(() => loadFolders() || []);
  const [activeFolder, setActiveFolder] = useState("Select Folder");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [zoomData, setZoomData] = useState(null);
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [isDropping, setIsDropping] = useState(false);
  const fileInputRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  useEffect(() => {
    let isMounted = true;
    const syncUrls = async () => {
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          if (item.imageId) {
            const url = await getImageURL(item.imageId);
            return { ...item, imageURL: url };
          }
          return item;
        })
      );
      if (isMounted) setItems(updatedItems);
    };
    if (items.length > 0) syncUrls();
    return () => {
      isMounted = false;
    };
  }, []);

  const persistItems = (newItems) => {
    setItems(newItems);
    saveItems(newItems);
  };

  const updateNotes = (id, notes) =>
    persistItems(items.map((i) => (i.id === id ? { ...i, notes } : i)));

  const triggerTrashAnimation = () => {
    setIsDropping(true);
    setTimeout(() => setIsDropping(false), 300);
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Delete ${selectedIds.size} items?`)) {
      triggerTrashAnimation();
      for (let id of selectedIds) {
        const item = items.find((i) => i.id === id);
        if (item) await deleteImage(item.imageId);
      }
      persistItems(items.filter((i) => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
    }
  };

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
    } else {
      const targetFolder = over.id === "Select Folder" ? "" : over.id;
      persistItems(
        items.map((i) =>
          draggedIds.includes(i.id) ? { ...i, folder: targetFolder } : i
        )
      );
      setSelectedIds(new Set());
    }
  };

  const visibleItems = useMemo(() => {
    if (search.trim()) {
      return items.filter((item) =>
        item.notes.toLowerCase().includes(search.toLowerCase())
      );
    }
    return filterItems(items, activeFolder, "");
  }, [items, activeFolder, search]);

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
          <div className="sidebar-scroll-container">
            <MainGalleryDropZone
              activeFolder={activeFolder}
              setActiveFolder={setActiveFolder}
            />
            {folders.map((f) => (
              <FolderButton
                key={f}
                f={f}
                activeFolder={activeFolder}
                setActiveFolder={setActiveFolder}
                onDelete={(name) => {
                  if (window.confirm(`Delete "${name}"?`)) {
                    const next = folders.filter((fol) => fol !== name);
                    setFolders(next);
                    saveFolders(next);
                    persistItems(
                      items.map((it) =>
                        it.folder === name ? { ...it, folder: "" } : it
                      )
                    );
                  }
                }}
              />
            ))}
          </div>

          <div className="sidebar-static-actions">
            <button
              className="nav-btn add-folder-btn"
              onClick={() => {
                const n = prompt("New Folder Name:");
                if (n?.trim()) {
                  const next = [...folders, n.trim()];
                  setFolders(next);
                  saveFolders(next);
                }
              }}
            >
              ➕ Folder
            </button>
            <TrashDropZone
              isDropping={isDropping}
              selectedCount={selectedIds.size}
              onBulkDelete={handleBulkDelete}
            />
          </div>
        </aside>

        <main className="main">
          <div className="heading">
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
                    folder:
                      activeFolder === "Select Folder" ? "" : activeFolder,
                    flipped: false,
                  });
                }
                persistItems([...items, ...newItems]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="clear-search-btn"
                  onClick={() => setSearch("")}
                >
                  Return
                </button>
              )}
            </div>
          </div>
          <div className="gallery">
            {visibleItems.map((item) => (
              <DraggableCard
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={(id) => {
                  const n = new Set(selectedIds);
                  n.has(id) ? n.delete(id) : n.add(id);
                  setSelectedIds(n);
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
          {activeDragItem && (
            <div className="card-drag-preview">
              <img src={activeDragItem.imageURL} alt="" />
              {selectedIds.size > 1 && (
                <div className="drag-count-badge">{selectedIds.size}</div>
              )}
            </div>
          )}
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
              <img src={zoomData.url} alt="" className="zoomed-image" />
            )}
          </div>
        )}
      </div>
    </DndContext>
  );
}
