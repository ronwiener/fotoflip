import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
// 1. Import Sortable Context and Strategy
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { supabase } from "./supabaseClient";
import "./styles.css";

import {
  loadFolders,
  saveFolders,
  filterItems,
  exportGalleryZip,
  importGalleryZip,
} from "./helpers/galleryHelpers";

/* ---------- REFACTORED DRAGGABLE CARD ---------- */

function DraggableCard({
  item,
  isSelected,
  selectedIds,
  onToggleSelect,
  onFlip,
  onZoom,
  updateNotes,
}) {
  // 2. Switch to useSortable for better mobile touch handling
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1, // Dims the original card while dragging
  };

  const handleFrontClick = (e) => {
    if (isDragging) return;
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      (selectedIds && selectedIds.size > 0)
    ) {
      onToggleSelect(item.id);
    } else {
      onFlip(item.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-wrapper ${isSelected ? "selected" : ""}`}
    >
      <div className={`card ${item.flipped ? "flipped" : ""}`}>
        {/* Front Face */}
        <div className="card-face card-front" onClick={handleFrontClick}>
          <button
            className="zoom-btn"
            onClick={(e) => {
              e.stopPropagation();
              onZoom({ type: "img", url: item.imageURL });
            }}
          >
            🔍
          </button>

          {/* 3. The Drag Handle needs the listeners and attributes */}
          <div className="drag-handle" {...attributes} {...listeners}>
            <img src={item.imageURL} alt="" draggable="false" />
          </div>
        </div>

        {/* Back Face */}
        <div className="card-face card-back">
          <div className="notes-content">
            <textarea
              value={item.notes}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateNotes(item.id, e.target.value)}
              placeholder="Zoom to write notes..."
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

/* ---------- APP COMPONENT ---------- */

export default function App() {
  // ... (keep all your existing state: session, items, folders, etc.)
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState(() => loadFolders() || []);
  const [activeFolder, setActiveFolder] = useState("Select Folder");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [zoomData, setZoomData] = useState(null);
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [isDropping, setIsDropping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 10 },
    })
  );

  // ... (keep fetchItems, useEffect, updateNotes, updateSupabaseItem, handleUpload, handleDragOver)

  const fetchItems = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const formatted = data.map((item) => {
        const { data: urlData } = supabase.storage
          .from("gallery")
          .getPublicUrl(item.image_path);
        return { ...item, imageURL: urlData.publicUrl };
      });
      setItems(formatted);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchItems();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchItems();
      else setItems([]);
    });
    return () => subscription.unsubscribe();
  }, [fetchItems]);

  const updateNotes = async (id, notes) => {
    setItems((prev) => {
      const updated = prev.map((i) => (i.id === id ? { ...i, notes } : i));
      const itemToSync = updated.find((i) => i.id === id);
      if (itemToSync) updateSupabaseItem(itemToSync);
      return updated;
    });
  };

  const updateSupabaseItem = async (item) => {
    if (!session?.user) return;
    await supabase.from("items").upsert({
      id: item.id,
      user_id: session.user.id,
      notes: item.notes,
      folder: item.folder,
      flipped: item.flipped,
      image_path: item.image_path,
    });
  };

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files || !session?.user) return;
    setIsLoading(true);
    setUploadProgress({ current: 0, total: files.length });
    let completedCount = 0;
    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;
      await supabase.storage.from("gallery").upload(filePath, file);
      await supabase.from("items").insert([
        {
          image_path: filePath,
          user_id: session.user.id,
          notes: "",
          flipped: false,
          folder: activeFolder === "Select Folder" ? "" : activeFolder,
        },
      ]);
      completedCount++;
      setUploadProgress((p) => ({ ...p, current: completedCount }));
    }
    await fetchItems();
    setIsLoading(false);
    setTimeout(() => setUploadProgress({ current: 0, total: 0 }), 2000);
  };

  const handleDragOver = useCallback((event) => {
    // Optional: add logic here if you want items to swap places in the grid
  }, []);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over || !session?.user) {
      setSelectedIds(new Set());
      return;
    }

    const draggedIds = selectedIds.has(active.id)
      ? Array.from(selectedIds)
      : [active.id];
    const targetFolder =
      over.id === "TRASH_BIN"
        ? "DELETE"
        : over.id === "Select Folder"
        ? ""
        : over.id;

    // UI Update
    setItems((prev) => {
      if (targetFolder === "DELETE")
        return prev.filter((item) => !draggedIds.includes(item.id));
      return prev.map((item) =>
        draggedIds.includes(item.id) ? { ...item, folder: targetFolder } : item
      );
    });
    setSelectedIds(new Set());

    // Sync
    setTimeout(async () => {
      if (targetFolder === "DELETE") {
        setIsDropping(true);
        const itemsToDelete = items.filter((i) => draggedIds.includes(i.id));
        await supabase.storage
          .from("gallery")
          .remove(itemsToDelete.map((i) => i.image_path));
        await supabase
          .from("items")
          .delete()
          .in("id", draggedIds)
          .eq("user_id", session.user.id);
        setTimeout(() => setIsDropping(false), 500);
      } else {
        await supabase
          .from("items")
          .update({ folder: targetFolder })
          .in("id", draggedIds)
          .eq("user_id", session.user.id);
      }
    }, 50);
  };

  const visibleItems = useMemo(() => {
    if (search.trim())
      return items.filter((i) =>
        i.notes.toLowerCase().includes(search.toLowerCase())
      );
    return filterItems(items, activeFolder, "");
  }, [items, activeFolder, search]);

  return (
    <div className="app-container">
      {!session ? (
        <Auth />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => {
            const draggedItem = items.find((i) => i.id === e.active.id);
            if (draggedItem) {
              setActiveDragItem(draggedItem);
              if (window.navigator?.vibrate) window.navigator.vibrate(50);
            }
          }}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="app">
            <aside className="sidebar">
              {/* ... (Sidebar logic remains same) */}
              <div className="sidebar-top">
                <MainGalleryDropZone
                  activeFolder={activeFolder}
                  setActiveFolder={setActiveFolder}
                />
                <div className="folders-list">
                  {folders.map((f) => (
                    <FolderButton
                      key={f}
                      f={f}
                      activeFolder={activeFolder}
                      setActiveFolder={setActiveFolder}
                      onDelete={(fol) => {
                        const itemsIn = items.filter((i) => i.folder === fol);
                        itemsIn.forEach((i) =>
                          updateSupabaseItem({ ...i, folder: "" })
                        );
                        const next = folders.filter((folr) => folr !== fol);
                        setFolders(next);
                        saveFolders(next);
                        if (activeFolder === fol)
                          setActiveFolder("Select Folder");
                        fetchItems();
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="sidebar-bottom">
                <button
                  className="nav-btn"
                  onClick={() => {
                    const n = prompt("New Folder:");
                    if (n) {
                      setFolders([...folders, n]);
                      saveFolders([...folders, n]);
                    }
                  }}
                >
                  ➕ Folder
                </button>
                <button
                  className="nav-btn logout-btn"
                  onClick={() => supabase.auth.signOut()}
                  style={{ backgroundColor: "#ffeded", color: "#ff4444" }}
                >
                  Sign Out
                </button>
                <TrashDropZone
                  selectedCount={selectedIds.size}
                  isDropping={isDropping}
                />
              </div>
            </aside>

            <main className="main">
              <div className="heading">
                <h1>
                  Photo <span className="flip-animation">Flip</span>
                </h1>
              </div>

              {/* 4. Wrap the gallery in SortableContext */}
              <SortableContext
                items={visibleItems.map((i) => i.id)}
                strategy={rectSortingStrategy}
              >
                <div className="gallery">
                  {visibleItems.map((item) => (
                    <DraggableCard
                      key={item.id}
                      item={item}
                      selectedIds={selectedIds}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelect={(id) => {
                        setSelectedIds((prev) => {
                          const newSet = new Set(prev);
                          newSet.has(id) ? newSet.delete(id) : newSet.add(id);
                          return newSet;
                        });
                      }}
                      onFlip={(id) => {
                        const updated = items.map((i) =>
                          i.id === id ? { ...i, flipped: !i.flipped } : i
                        );
                        setItems(updated);
                        updateSupabaseItem(updated.find((i) => i.id === id));
                      }}
                      onZoom={setZoomData}
                      updateNotes={updateNotes}
                    />
                  ))}
                </div>
              </SortableContext>
            </main>

            {/* 5. Refined DragOverlay for better mobile appearance */}
            <DragOverlay
              modifiers={[snapCenterToCursor]}
              dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                  styles: { active: { opacity: "0.5" } },
                }),
              }}
            >
              {activeDragItem ? (
                <div className="card-drag-preview">
                  <img src={activeDragItem.imageURL} alt="" />
                </div>
              ) : null}
            </DragOverlay>

            {/* ... (Zoom logic remains same) */}
            {zoomData && (
              <div className="zoom-overlay" onClick={() => setZoomData(null)}>
                {zoomData.type === "img" ? (
                  <img src={zoomData.url} alt="" className="zoomed-image" />
                ) : (
                  <div
                    className="zoomed-notes-box"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3>Notes</h3>
                    <textarea
                      value={
                        items.find((i) => i.id === zoomData.id)?.notes || ""
                      }
                      onChange={(e) => updateNotes(zoomData.id, e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => setZoomData(null)}>Close</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DndContext>
      )}
    </div>
  );
}
