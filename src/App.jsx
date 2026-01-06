import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
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

/* ---------- AUTH COMPONENT ---------- */
function Auth() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Change signInWithPasswordless to signInWithOtp
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // PKCE flow requires a redirect URL to exchange the code for a session
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Check your email for the login link!");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) alert(error.message);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Photo Flip</h1>
        <p>Sign in to manage your gallery</p>
        <button onClick={handleGoogleLogin} className="google-btn">
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt=""
            width="18"
          />
          Continue with Google
        </button>
        <div className="divider">
          <span>OR</span>
        </div>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className={email ? "btn-active" : ""}
          >
            {loading ? (
              <span className="spinner-small"></span>
            ) : (
              "Send Magic Link"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- UI SUB-COMPONENTS ---------- */
function MainGalleryDropZone({ activeFolder, setActiveFolder }) {
  const { isOver, setNodeRef } = useDroppable({ id: "Select Folder" });
  return (
    <div
      ref={setNodeRef}
      className={`nav-btn ${activeFolder === "Select Folder" ? "active" : ""} ${
        isOver ? "folder-hover-active" : ""
      }`}
      onClick={() => setActiveFolder("Select Folder")}
    >
      <span className="main-text">Main Gallery</span>
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
      >
        &times;
      </button>
    </div>
  );
}

function TrashDropZone({ selectedCount, isDropping }) {
  const { isOver, setNodeRef } = useDroppable({ id: "TRASH_BIN" });
  return (
    <div
      ref={setNodeRef}
      className={`trash-zone ${isOver ? "trash-over" : ""} ${
        isDropping ? "trash-dropped" : ""
      }`}
    >
      <span>{selectedCount > 0 ? `🗑 (${selectedCount})` : "🗑 Trash"}</span>
    </div>
  );
}

/* ---------- DRAGGABLE CARD ---------- */
function DraggableCard({
  item,
  isSelected,
  selectedIds,
  onToggleSelect,
  onFlip,
  onZoom,
  updateNotes,
}) {
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
    opacity: isDragging ? 0.3 : 1,
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
      data-dragging={isDragging}
      className={`card-wrapper ${isSelected ? "selected" : ""}`}
    >
      <div className={`card ${item.flipped ? "flipped" : ""}`}>
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
          <div className="drag-handle" {...attributes} {...listeners}>
            <img
              src={item.imageURL}
              alt=""
              draggable="false"
              style={{ pointerEvents: "none" }}
            />
          </div>
        </div>
        <div className="card-face card-back">
          <div className="notes-content">
            <textarea
              value={item.notes}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateNotes(item.id, e.target.value)}
              placeholder="Zoom to write..."
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

/* ---------- MAIN APP ---------- */
export default function App() {
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
      activationConstraint: { delay: 250, tolerance: 15 },
    })
  );

  const fetchItems = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return console.error(error);
    const formatted = data.map((item) => {
      const { data: urlData } = supabase.storage
        .from("gallery")
        .getPublicUrl(item.image_path);
      return { ...item, imageURL: urlData.publicUrl };
    });
    setItems(formatted);
  }, []);

  useEffect(() => {
    // 1. Fallback timer for Safari / slow loads
    const timer = setTimeout(() => {
      if (!session) setIsLoading(false);
    }, 10000);

    // 2. Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.user) fetchItems();
      setIsLoading(false);
      clearTimeout(timer);
    });

    // 3. Listen for auth changes (Login/Logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchItems();
      } else {
        setItems([]);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [fetchItems, session]); // <--- Add 'session' here

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

  const updateNotes = async (id, notes) => {
    setItems((prev) => {
      const updated = prev.map((i) => (i.id === id ? { ...i, notes } : i));
      const itemToSync = updated.find((i) => i.id === id);
      if (itemToSync) updateSupabaseItem(itemToSync);
      return updated;
    });
  };

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files || !session?.user) return;
    setIsLoading(true);
    setUploadProgress({ current: 0, total: files.length });
    let completedCount = 0;
    for (const file of files) {
      const fileName = `${Date.now()}-${Math.random()}.${file.name
        .split(".")
        .pop()}`;
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
      setUploadProgress({ current: completedCount, total: files.length });
    }
    await fetchItems();
    setIsLoading(false);
    setTimeout(() => setUploadProgress({ current: 0, total: 0 }), 2000);
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsLoading(true);
    try {
      await importGalleryZip(file, (curr, tot) =>
        setImportProgress(`Importing ${curr} of ${tot}...`)
      );
      fetchItems();
    } catch (e) {
      alert("Import failed: " + e.message);
    } finally {
      setIsLoading(false);
      setImportProgress("");
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over || !session?.user) return;

    const draggedIds = selectedIds.has(active.id)
      ? Array.from(selectedIds)
      : [active.id];
    const targetFolder =
      over.id === "TRASH_BIN"
        ? "DELETE"
        : over.id === "Select Folder"
        ? ""
        : over.id;

    setItems((prev) => {
      if (targetFolder === "DELETE")
        return prev.filter((i) => !draggedIds.includes(i.id));
      return prev.map((i) =>
        draggedIds.includes(i.id) ? { ...i, folder: targetFolder } : i
      );
    });
    setSelectedIds(new Set());

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
  };

  const visibleItems = useMemo(() => {
    if (search.trim())
      return items.filter((i) =>
        i.notes.toLowerCase().includes(search.toLowerCase())
      );
    return filterItems(items, activeFolder, "");
  }, [items, activeFolder, search]);

  if (!session) return <Auth />;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) =>
        setActiveDragItem(items.find((i) => i.id === e.active.id))
      }
      onDragEnd={handleDragEnd}
    >
      <div className="app">
        {isLoading && importProgress && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p className="pulse-text">{importProgress}</p>
          </div>
        )}
        <aside className="sidebar">
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
                    const next = folders.filter((folr) => folr !== fol);
                    setFolders(next);
                    saveFolders(next);
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
              onClick={async () => {
                await supabase.auth.signOut();
                setSession(null); // Force clear session
                setItems([]); // Clear local items for security
              }}
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
          {isLoading && uploadProgress.total > 0 && !importProgress && (
            <div className="gallery-upload-status">
              <p className="pulse-text">
                Uploading {uploadProgress.current} / {uploadProgress.total}
              </p>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${
                      (uploadProgress.current / uploadProgress.total) * 100
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          )}
          <div className="controls">
            <label className="upload-label">
              ☁️ Upload
              <input type="file" multiple onChange={handleUpload} hidden />
            </label>
            <button
              className="util-btn"
              onClick={() => exportGalleryZip(items)}
            >
              📤 Export
            </button>
            <label className="util-btn">
              📥 Import
              <input type="file" accept=".zip" onChange={handleImport} hidden />
            </label>
            <input
              type="text"
              className="search-input"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

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
                  onToggleSelect={(id) =>
                    setSelectedIds((prev) => {
                      const n = new Set(prev);
                      n.has(id) ? n.delete(id) : n.add(id);
                      return n;
                    })
                  }
                  onFlip={(id) =>
                    setItems((prev) => {
                      const updated = prev.map((i) =>
                        i.id === id ? { ...i, flipped: !i.flipped } : i
                      );
                      const itemToSync = updated.find((i) => i.id === id);
                      // Explicitly pass the updated item to avoid stale closure
                      updateSupabaseItem(itemToSync);
                      return updated;
                    })
                  }
                  onZoom={setZoomData}
                  updateNotes={updateNotes}
                />
              ))}
            </div>
          </SortableContext>
        </main>

        <DragOverlay
          modifiers={[snapCenterToCursor]}
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: { active: { opacity: "0.5" } },
            }),
          }}
        >
          {activeDragItem && (
            <div className="card-drag-preview">
              <img src={activeDragItem.imageURL} alt="" />
            </div>
          )}
        </DragOverlay>

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
                  value={items.find((i) => i.id === zoomData.id)?.notes || ""}
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
  );
}
