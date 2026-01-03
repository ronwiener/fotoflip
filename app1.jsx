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
} from "@dnd-kit/core";
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

/* ---------- COMPONENTS ---------- */

function Auth() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Magic Link Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else alert("Check your email for the login link!");
    setLoading(false);
  };

  // Google Login
  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) alert(error.message);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Photo Flip</h1>
        <p>Sign in to access your private gallery</p>

        <button onClick={handleGoogleLogin} className="google-btn">
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
            className={email.length > 0 ? "btn-active" : "btn-disabled"}
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
      <span className="main-text"> Main Gallery</span>
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

  const style = {
    opacity: isDragging ? 0 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  const handleFrontClick = (e) => {
    if (isDragging) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
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
      {...attributes} // Accessibility attributes belong on the wrapper
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

          <div className="drag-handle" {...listeners}>
            <img src={item.imageURL} alt="" draggable="false" />
          </div>
        </div>

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 20 },
    })
  );

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
        .order("created_at", { ascending: false }); // <--- This now works!

      if (error) throw error;

      const formatted = data.map((item) => {
        const { data: urlData } = supabase.storage
          .from("gallery")
          .getPublicUrl(item.image_path);

        return { ...item, imageURL: urlData.publicUrl };
      });

      setItems(formatted);
    } catch (err) {
      console.error("Fetch failed:", err.message);
    }
  }, []);
  // Add a new state for the session at the top of your App component

  useEffect(() => {
    // Check session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchItems();
    });

    // Handle Auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (session?.user) {
        fetchItems();
      } else {
        setItems([]); // Clear on logout
      }
    });

    return () => subscription.unsubscribe();
    // Removed [fetchItems] to prevent unnecessary re-runs
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
      user_id: session.user.id, // Added user_id
      notes: item.notes,
      folder: item.folder,
      flipped: item.flipped,
      image_path: item.image_path,
    });
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !session?.user) return;

    setIsLoading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    // This creates a path like: "user_uuid/0.12345.jpg"
    const filePath = `${session.user.id}/${fileName}`;

    // 1. Upload the file to the "gallery" bucket
    const { error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(filePath, file);

    if (uploadError) {
      alert("Storage Error: " + uploadError.message);
      setIsLoading(false);
      return;
    }

    // 2. Insert the record into the "items" table
    // We use 'image_path' to match your database column name
    const { error: dbError } = await supabase.from("items").insert([
      {
        image_path: filePath, // Storing the path, not the full URL
        user_id: session.user.id,
        notes: "", // Good to provide defaults
        flipped: false,
        folder: activeFolder === "Select Folder" ? "" : activeFolder,
      },
    ]);

    if (dbError) {
      alert("Database Error: " + dbError.message);
    } else {
      // Refresh the gallery so the new image appears immediately
      fetchItems();
    }

    setIsLoading(false);
  };

  const handleDragOver = useCallback((event) => {
    if (event.over) {
      if (event.activatorEvent.cancelable) {
        event.activatorEvent.preventDefault();
      }
    }
  }, []);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);

    // 1. EXIT EARLY: If no drop target or no logged-in user
    if (!over || !session?.user) {
      setSelectedIds(new Set());
      return;
    }

    // 2. IDENTIFY ITEMS
    const draggedIds = selectedIds.has(active.id)
      ? Array.from(selectedIds)
      : [active.id];

    const targetFolder =
      over.id === "TRASH_BIN"
        ? "DELETE"
        : over.id === "Select Folder"
        ? ""
        : over.id;

    // 3. IMMEDIATE OPTIMISTIC UI UPDATE
    setItems((prev) => {
      if (targetFolder === "DELETE") {
        return prev.filter((item) => !draggedIds.includes(item.id));
      }
      return prev.map((item) =>
        draggedIds.includes(item.id) ? { ...item, folder: targetFolder } : item
      );
    });

    setSelectedIds(new Set());

    // 4. ASYNC DATABASE SYNC
    setTimeout(async () => {
      try {
        if (targetFolder === "DELETE") {
          setIsDropping(true);

          const itemsToDelete = items.filter((i) => draggedIds.includes(i.id));
          const pathsToRemove = itemsToDelete
            .map((i) => i.image_path)
            .filter(Boolean);

          // Note: Storage cleanup is usually best handled by RLS on the bucket
          if (pathsToRemove.length > 0) {
            await supabase.storage.from("gallery").remove(pathsToRemove);
          }

          // Batch delete: MUST include .eq("user_id", session.user.id)
          const { error } = await supabase
            .from("items")
            .delete()
            .in("id", draggedIds)
            .eq("user_id", session.user.id); // Security check

          if (error) throw error;
          setTimeout(() => setIsDropping(false), 500);
        } else {
          // Batch move: MUST include .eq("user_id", session.user.id)
          const { error } = await supabase
            .from("items")
            .update({ folder: targetFolder })
            .in("id", draggedIds)
            .eq("user_id", session.user.id); // Security check

          if (error) throw error;
        }
      } catch (err) {
        console.error("Delayed Sync Error:", err);
        fetchItems(); // Rollback UI if the server rejects the change
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
      {/* 1. AUTH CHECK: If no session, show Auth component */}
      {!session ? (
        <Auth />
      ) : (
        /* 2. GALLERY: If session exists, show your existing DndContext */
        <DndContext
          sensors={sensors}
          onDragStart={(e) =>
            setActiveDragItem(items.find((i) => i.id === e.active.id))
          }
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="app">
            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
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
                      onDelete={async (folderName) => {
                        const itemsInFolder = items.filter(
                          (i) => i.folder === folderName
                        );
                        if (itemsInFolder.length > 0) {
                          alert(
                            `${itemsInFolder.length} item(s) in "${folderName}" will be moved to the Main Gallery.`
                          );
                          for (const item of itemsInFolder) {
                            const updatedItem = { ...item, folder: "" };
                            await updateSupabaseItem(updatedItem);
                          }
                          fetchItems();
                        }
                        const nextFolders = folders.filter(
                          (fol) => fol !== folderName
                        );
                        setFolders(nextFolders);
                        saveFolders(nextFolders);
                        if (activeFolder === folderName) {
                          setActiveFolder("Select Folder");
                        }
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

                {/* LOGOUT BUTTON: Added here for visibility in the sidebar */}
                <button
                  className="nav-btn logout-btn"
                  onClick={() => supabase.auth.signOut()}
                  style={{
                    marginTop: "10px",
                    backgroundColor: "#ffeded",
                    color: "#ff4444",
                  }}
                >
                  🚪 Sign Out
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

              <div className="controls">
                <label className="upload-label">
                  ☁️ Upload
                  <input type="file" multiple onChange={handleUpload} hidden />
                </label>
                <div className="utility-actions">
                  <button
                    onClick={() => exportGalleryZip(items)}
                    className="util-btn"
                  >
                    📤 Export
                  </button>
                  <label className="util-btn">
                    📥 Import
                    <input
                      type="file"
                      onChange={(e) =>
                        importGalleryZip(e.target.files[0]).then(fetchItems)
                      }
                      hidden
                    />
                  </label>
                </div>
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
                      ✕
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
            </main>

            <DragOverlay
              modifiers={[snapCenterToCursor]}
              zIndex={2000}
              style={{ pointerEvents: "none" }}
            >
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
                </div>
              ) : null}
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

/*
final code before netlify deploy with supabase
*/
