import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
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
  } = useSortable({ id: item.id, disabled: item.flipped });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // Add a slight scale-down effect when holding to drag
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-dragging={isDragging}
      data-flipped={item.flipped}
      className={`card-wrapper ${isSelected ? "selected" : ""}`}
      onPointerDown={(e) => {
        if (item.flipped) return;
        if (selectedIds.size > 0) {
          onToggleSelect(item.id);
        }
      }}
      onPointerUp={(e) => {
        // Only flip if we didn't just finish a drag
        if (isDragging || selectedIds.size > 0 || item.flipped) return;
        onFlip(item.id);
      }}
    >
      <div className="card">
        <div className="card-face card-front" style={{ pointerEvents: "none" }}>
          <button
            className="zoom-btn"
            style={{ pointerEvents: "auto" }}
            // Use onPointerUp + stopPropagation to prevent card flip
            onPointerUp={(e) => {
              e.stopPropagation();
              onZoom({ type: "img", url: item.imageURL });
            }}
          >
            🔍
          </button>
          <img src={item.imageURL} alt="" />
        </div>

        <div className="card-face card-back" data-no-dnd="true">
          <div className="notes-content">
            <textarea
              value={item.notes}
              data-no-dnd="true"
              onChange={(e) => updateNotes(item.id, e.target.value)}
              placeholder="Zoom to write..."
            />
            <div className="notes-actions">
              <button
                className="btn-zoom"
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onZoom({ type: "notes", content: item.notes, id: item.id });
                }}
              >
                🔍 Zoom
              </button>
              <button
                className="btn-flip"
                onPointerUp={(e) => {
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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
      // ADD THIS: Prevents the sensor from starting a drag on the textarea
      onActivation: (event) => {
        if (event.nativeEvent.target.closest('[data-no-dnd="true"]')) {
          return false;
        }
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );
  const galleryRef = useRef(null);
  const timerRef = useRef(null);

  const fetchItems = useCallback(async (userId) => {
    // Use the passed userId only; do not reference 'session' state here
    if (!userId) return;

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching items:", error.message);
      return;
    }

    const formatted = data.map((item) => {
      const { data: urlData } = supabase.storage
        .from("gallery")
        .getPublicUrl(item.image_path);

      return {
        ...item,
        imageURL: urlData.publicUrl,
      };
    });

    setItems(formatted);
  }, []); // Empty array: this function is now stable and won't trigger loops

  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 10000);

    const initializeAuth = async () => {
      // 1. Check if we just arrived from a Magic Link (Mobile fix)
      const queryParams = new URLSearchParams(window.location.search);
      const tokenHash = queryParams.get("token_hash");
      const type = queryParams.get("type");

      if (tokenHash && type === "magiclink") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });

        if (error) {
          console.error("Error verifying magic link:", error.message);
        } else {
          // Clean the URL so the token doesn't stay in the address bar
          window.history.replaceState(
            {},
            document.title,
            window.location.origin
          );
        }
      }

      // 2. Proceed with normal session check
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (isMounted) {
        setSession(initialSession);
        if (initialSession?.user) {
          fetchItems(initialSession.user.id);
        }
        setIsLoading(false);
        clearTimeout(timer);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;

      setSession(currentSession);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (currentSession?.user) {
          fetchItems(currentSession.user.id);
        }
      } else if (event === "SIGNED_OUT") {
        setItems([]);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [fetchItems]);

  useEffect(() => {
    const galleryEl = galleryRef.current; // Use the ref instead of querySelector
    if (!galleryEl) return;

    const handleScroll = () => {
      // console.log("Scroll Position:", galleryEl.scrollTop); // Uncomment to debug
      if (galleryEl.scrollTop > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    galleryEl.addEventListener("scroll", handleScroll);
    return () => galleryEl.removeEventListener("scroll", handleScroll);
  }, [items]);

  const scrollToTop = () => {
    if (galleryRef.current) {
      galleryRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files || !session?.user) return;

    setIsLoading(true);
    setUploadProgress({ current: 0, total: files.length });
    let completedCount = 0;

    for (const file of files) {
      try {
        const fileName = `${Date.now()}-${Math.random()}.${file.name
          .split(".")
          .pop()}`;
        const filePath = `${session.user.id}/${fileName}`;

        // 1. Upload the file to Storage
        const { error: uploadError } = await supabase.storage
          .from("gallery")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Storage Error:", uploadError.message);
          continue;
        }

        // 2. Insert the record into the 'items' table
        const { error: dbError } = await supabase.from("items").insert([
          {
            image_path: filePath,
            user_id: session.user.id,
            notes: "",
            flipped: false,
            folder: activeFolder === "Select Folder" ? "" : activeFolder,
          },
        ]);

        if (dbError) {
          console.error("Database Error:", dbError.message);
        } else {
          completedCount++;
          setUploadProgress({ current: completedCount, total: files.length });
        }
      } catch (err) {
        console.error("Unexpected error during file loop:", err);
      }
    }

    // 3. CRITICAL: Re-fetch items using the current user ID
    // This updates the 'items' state and makes images appear without a refresh
    await fetchItems(session.user.id);

    setIsLoading(false);

    event.target.value = null;

    // Reset progress bar after a short delay
    setTimeout(() => setUploadProgress({ current: 0, total: 0 }), 2000);
  };

  const updateNotes = useCallback((id, notes) => {
    // 1. Immediate UI update
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, notes } : i)));

    // 2. Debounced Database Sync
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("items")
        .update({ notes: notes }) // Syncing the specific note change
        .eq("id", id);

      if (!error) {
        setIsSaved(true);

        // Increased to 4000ms (4 seconds) so users actually see it
        setTimeout(() => setIsSaved(false), 4000);
      } else {
        console.error("Sync error:", error.message);
      }
    }, 1000);
  }, []);

  const handleFlip = useCallback(async (id) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const updated = { ...i, flipped: !i.flipped };
          // Sync to DB immediately using the 'updated' constant
          supabase
            .from("items")
            .update({ flipped: updated.flipped })
            .eq("id", id)
            .then(({ error }) => {
              if (error) console.error("Flip sync failed:", error.message);
            });
          return updated;
        }
        return i;
      })
    );
  }, []);

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file || !session?.user) return; // Add check
    setIsLoading(true);
    try {
      await importGalleryZip(file, (curr, tot) =>
        setImportProgress(`Importing ${curr} of ${tot}...`)
      );
      await fetchItems(session.user.id); // Pass the ID here
    } catch (e) {
      alert("Import failed: " + e.message);
    } finally {
      setIsLoading(false);
      setImportProgress("");
    }
  };

  const handleDragStart = (e) => {
    const { active } = e;
    const draggedItem = items.find((i) => i.id === active.id);
    if (draggedItem?.flipped) return;

    if (window.navigator.vibrate) window.navigator.vibrate(15);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(active.id);
      return next;
    });
    setActiveDragItem(draggedItem);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);

    // 1. EXIT EARLY: If dropped outside a zone or dropped back on itself
    if (!over || active.id === over.id) {
      setSelectedIds(new Set()); // Reset selection if dropped nowhere
      return;
    }

    const draggedIds = selectedIds.has(active.id)
      ? Array.from(selectedIds)
      : [active.id];

    // 2. IDENTIFY DESTINATION: Trash, Main Gallery, or a specific Folder
    const isTrash = over.id === "TRASH_BIN";
    const targetFolder = isTrash
      ? "DELETE"
      : over.id === "Select Folder"
      ? ""
      : over.id;

    // 3. OPTIMISTIC UI UPDATE: Update local state immediately for a snappy feel
    setItems((prev) => {
      if (isTrash) {
        return prev.filter((i) => !draggedIds.includes(i.id));
      }
      return prev.map((i) =>
        draggedIds.includes(i.id) ? { ...i, folder: targetFolder } : i
      );
    });

    // Clear selection after the action starts
    setSelectedIds(new Set());

    // 4. DATABASE SYNC
    if (isTrash) {
      setIsDropping(true);
      const itemsToDelete = items.filter((i) => draggedIds.includes(i.id));
      const pathsToDelete = itemsToDelete.map((i) => i.image_path);

      const { error } = await supabase
        .from("items")
        .delete()
        .in("id", draggedIds);
      if (!error && pathsToDelete.length > 0) {
        await supabase.storage.from("gallery").remove(pathsToDelete);
      }
      setTimeout(() => setIsDropping(false), 500);
    } else {
      await supabase
        .from("items")
        .update({ folder: targetFolder })
        .in("id", draggedIds);
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
      onDragStart={handleDragStart}
      // This clears the highlight when the drag is finished or aborted
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        // This fixes the "Sticky Highlight" if you drop the image in a weird spot

        setActiveDragItem(null);
        setSelectedIds(new Set());
      }}
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
            {/* Change this block */}
            {selectedIds.size > 0 && (
              <div className="selection-status-bar">
                <p className="selection-text">
                  <strong>{selectedIds.size}</strong>{" "}
                  {selectedIds.size === 1 ? "item" : "items"} moved to trash or
                  folders
                </p>
              </div>
            )}

            {isSaved && (
              <div className="save-indicator">
                Checkmark icon or "✓ Saved to Cloud"
              </div>
            )}
          </div>

          <SortableContext
            items={visibleItems.map((i) => i.id)}
            strategy={rectSortingStrategy}
          >
            <div
              className="gallery"
              ref={galleryRef}
              onPointerUp={(e) => {
                // If clicking the empty space in the gallery, clear selection
                if (e.target === galleryRef.current) {
                  setSelectedIds(new Set());
                }
              }}
            >
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
                  onFlip={handleFlip}
                  onZoom={setZoomData}
                  updateNotes={updateNotes}
                />
              ))}
            </div>
          </SortableContext>
          {showScrollTop && (
            <button
              className={`scroll-to-top ${showScrollTop ? "visible" : ""}`}
              onClick={scrollToTop}
            >
              ↑
            </button>
          )}
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
