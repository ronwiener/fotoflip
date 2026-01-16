import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
window.React = React;
import FilerobotImageEditor, {
  TABS,
  TOOLS,
} from "react-filerobot-image-editor";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
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
import LandingPage from "./LandingPage";

/* ---------- AUTH COMPONENT ---------- */
function Auth() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) alert(error.message);
    else alert("Check your email for the login link!");
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
  const className = [
    "nav-btn",
    activeFolder === "Select Folder" ? "active" : "",
    isOver ? "folder-hover-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={setNodeRef}
      className={className}
      onClick={() => setActiveFolder("Select Folder")}
    >
      <span className="main-text">Main Gallery</span>
    </div>
  );
}

function FolderButton({ f, activeFolder, setActiveFolder, onDelete }) {
  const { isOver, setNodeRef } = useDroppable({ id: f });
  const className = [
    "folder-item",
    f === activeFolder ? "active" : "",
    isOver ? "folder-hover-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={setNodeRef} className={className}>
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
  const className = [
    "trash-zone",
    isOver ? "trash-over" : "",
    isDropping ? "trash-dropped" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={setNodeRef} className={className}>
      <span>{selectedCount > 0 ? `🗑 (${selectedCount})` : "🗑 Trash"}</span>
    </div>
  );
}

function ZoomOverlay({ data, items, updateNotes, onClose }) {
  const [isSuccessClosing, setIsSuccessClosing] = useState(false);

  if (!data) return null;
  const item = items.find((i) => i.id === data.id);

  const handleCloseClick = (e) => {
    if (e) e.stopPropagation();

    // 1. Trigger the "Saved" visual state
    setIsSuccessClosing(true);

    // 2. Wait 1000ms (1 second) before calling the actual onClose from props
    setTimeout(() => {
      setIsSuccessClosing(false); // Reset for next time
      onClose();
    }, 1000);
  };
  return (
    <div className="zoom-overlay" onPointerDown={handleCloseClick}>
      {data.type === "img" ? (
        <div
          className="zoomed-image-container"
          onClick={(e) => e.stopPropagation()}
        >
          <img src={data.url} alt="" className="zoomed-image" />
        </div>
      ) : (
        <div className="zoomed-notes-box" onClick={(e) => e.stopPropagation()}>
          <div className="zoomed-notes-header">
            <h3>Notes</h3>
            {isSuccessClosing && <div className="save-indicator">✓ Saved</div>}
          </div>
          <textarea
            value={item?.notes || ""}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => updateNotes(data.id, e.target.value)}
            autoFocus
          />
          <button
            className="notes-close-footer"
            onClick={handleCloseClick}
            style={{
              backgroundColor: isSuccessClosing ? "#28a745" : "#64748b",
              transition: "background-color 0.3s ease",
            }}
          >
            {isSuccessClosing ? "Saved!" : "Close Notes"}
          </button>
        </div>
      )}
    </div>
  );
}

function DraggableCard({
  item,
  isSelected,
  selectedIds,
  isClosingZoomRef,
  onToggleSelect,
  onFlip,
  onZoom,
  onEdit,
  updateNotes,
  isSaved,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id || "temp",
    disabled: !item || item.flipped,
  });

  if (!item) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
    touchAction: "none",
  };

  // Improved click handler to distinguish from drag
  const handleFrontClick = (e) => {
    e.stopPropagation();
    // If we just finished a drag, don't flip
    if (isDragging || isClosingZoomRef.current) return;

    if (isSelected || selectedIds.size > 0) {
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
      {...attributes}
    >
      <div className={`card ${item.flipped ? "flipped" : ""}`}>
        <div className="card-face card-front">
          <div
            className={`select-indicator ${isSelected ? "active" : ""}`}
            onPointerDown={(e) => {
              e.stopPropagation(); // Stops dnd-kit drag
              onToggleSelect(item.id);
            }}
          >
            {isSelected ? "✓" : ""}
          </div>

          {/* ZOOM BUTTON */}
          <button
            className="zoom-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onZoom({ type: "img", url: item.imageURL });
            }}
          >
            🔍
          </button>

          {/* EDIT BUTTON */}
          <button
            className="edit-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
          >
            🎨
          </button>

          <img
            src={item.imageURL}
            alt=""
            {...listeners}
            onClick={handleFrontClick}
            style={{ cursor: "grab", touchAction: "none" }}
          />
        </div>

        {/* BACK SIDE */}
        <div className="card-face card-back">
          <div className="notes-content">
            {isSaved && <div className="save-indicator-card">✓ Saved</div>}
            <textarea
              value={item.notes}
              onPointerDown={(e) => e.stopPropagation()} // Allow typing without dragging
              onChange={(e) => updateNotes(item.id, e.target.value)}
              placeholder="Zoom to write..."
            />
            <div className="notes-actions">
              <button
                className="btn-zoom"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onZoom({ type: "notes", id: item.id });
                }}
              >
                Zoom
              </button>
              <button
                className="btn-flip"
                onPointerDown={(e) => e.stopPropagation()}
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
export default function App1() {
  // --- States ---
  const [session, setSession] = useState(null);
  const [view, setView] = useState("landing"); // New View State
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
  const [isSavedItemId, setIsSavedItemId] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const galleryRef = useRef(null);
  const timerRef = useRef(null);
  const isClosingZoomRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  // --- Logic Functions ---
  const fetchItems = useCallback(async (userId) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return console.error(error.message);

    const formatted = data.map((item) => {
      const { data: urlData } = supabase.storage
        .from("gallery")
        .getPublicUrl(item.image_path);
      return {
        ...item,
        imageURL: `${urlData.publicUrl}?t=${new Date().getTime()}`,
      };
    });
    setItems(formatted);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (isMounted && initialSession) {
        setSession(initialSession);
        setView("gallery");
        fetchItems(initialSession.user.id);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;

      if (currentSession) {
        // 1. Update State
        setSession(currentSession);
        setView("gallery");
        fetchItems(currentSession.user.id);

        // 2. Clean URL (Remove #access_token so it doesn't re-trigger)
        if (window.location.hash) {
          window.history.replaceState(null, null, window.location.pathname);
        }
      } else {
        // 3. Handle Logout
        setSession(null);
        setItems([]);
        setView("landing");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchItems]);

  useEffect(() => {
    const galleryEl = galleryRef.current;
    if (!galleryEl) return;
    const handleScroll = () => setShowScrollTop(galleryEl.scrollTop > 300);
    galleryEl.addEventListener("scroll", handleScroll);
    return () => galleryEl.removeEventListener("scroll", handleScroll);
  }, [items]);

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files || !session?.user) return;
    setIsLoading(true);
    setUploadProgress({ current: 0, total: files.length });
    let completedCount = 0;

    for (const file of files) {
      const filePath = `${session.user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(filePath, file);
      if (!uploadError) {
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
    }
    await fetchItems(session.user.id);
    setIsLoading(false);
    event.target.value = null;
    setTimeout(() => setUploadProgress({ current: 0, total: 0 }), 2000);
  };

  const updateNotes = useCallback((id, notes) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, notes } : i)));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("items")
        .update({ notes })
        .eq("id", id);
      if (!error) {
        setIsSavedItemId(id);
        setTimeout(() => setIsSavedItemId(null), 3000);
      }
    }, 1000);
  }, []);

  const handleFlip = useCallback(async (id) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const updated = { ...i, flipped: !i.flipped };
          supabase
            .from("items")
            .update({ flipped: updated.flipped })
            .eq("id", id);
          return updated;
        }
        return i;
      })
    );
  }, []);

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over || active.id === over.id) {
      setSelectedIds(new Set());
      return;
    }

    const draggedIds = selectedIds.has(active.id)
      ? Array.from(selectedIds)
      : [active.id];
    const isTrash = over.id === "TRASH_BIN";
    const targetFolder = isTrash
      ? "DELETE"
      : over.id === "Select Folder"
      ? ""
      : over.id;

    setItems((prev) =>
      isTrash
        ? prev.filter((i) => !draggedIds.includes(i.id))
        : prev.map((i) =>
            draggedIds.includes(i.id) ? { ...i, folder: targetFolder } : i
          )
    );
    setSelectedIds(new Set());

    if (isTrash) {
      setIsDropping(true);
      const pathsToDelete = items
        .filter((i) => draggedIds.includes(i.id))
        .map((i) => i.image_path);
      await supabase.from("items").delete().in("id", draggedIds);
      if (pathsToDelete.length > 0)
        await supabase.storage.from("gallery").remove(pathsToDelete);
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

  /* ---------- VIEW CONTROLLER ---------- */

  // GATE 1: THE MASTER GATEKEEPER
  // If there is a session, show the Gallery immediately, regardless of "view" state.
  if (session) {
    return (
      <DndContext
        sensors={sensors}
        onDragStart={(e) =>
          setActiveDragItem(items.find((i) => i.id === e.active.id))
        }
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
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
                      const next = folders.filter((r) => r !== fol);
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
                  setSession(null);
                  setItems([]);
                  setView("landing");
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
                ☁️ Upload{" "}
                <input type="file" multiple onChange={handleUpload} hidden />
              </label>

              {selectedIds.size > 0 && (
                <div className="selection-status-inline">
                  <span className="count-badge">{selectedIds.size}</span>
                  <span className="status-text">
                    Selected — Drag to folder or Trash
                  </span>
                  <button
                    className="clear-selection-btn"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    ✕
                  </button>
                </div>
              )}
              <button
                className="util-btn"
                onClick={() => exportGalleryZip(items, selectedIds)}
              >
                📤 Export {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </button>

              <label className="util-btn">
                📥 Import{" "}
                <input
                  type="file"
                  accept=".zip"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    setIsLoading(true);
                    try {
                      await importGalleryZip(file, (c, t) =>
                        setImportProgress(`Importing ${c} of ${t}...`)
                      );
                      // Ensure this uses the correct session ID
                      await fetchItems(session.user.id);
                    } catch (err) {
                      alert("Import failed: " + err.message);
                    } finally {
                      setIsLoading(false);
                      setImportProgress("");
                      e.target.value = ""; // RESET: Allows re-importing the same file
                    }
                  }}
                  hidden
                />
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
              <div
                className="gallery"
                ref={galleryRef}
                onPointerUp={(e) =>
                  e.target === galleryRef.current && setSelectedIds(new Set())
                }
              >
                {visibleItems.map((item) => (
                  <DraggableCard
                    key={item.id}
                    item={item}
                    isClosingZoomRef={isClosingZoomRef}
                    selectedIds={selectedIds}
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={handleToggleSelect}
                    onFlip={handleFlip}
                    onZoom={setZoomData}
                    onEdit={setEditingItem}
                    updateNotes={updateNotes}
                    isSaved={isSavedItemId === item.id}
                  />
                ))}
              </div>
            </SortableContext>
            {showScrollTop && (
              <button
                className="scroll-to-top visible"
                onClick={() =>
                  galleryRef.current.scrollTo({ top: 0, behavior: "smooth" })
                }
              >
                ↑
              </button>
            )}
          </main>

          <DragOverlay modifiers={[snapCenterToCursor]}>
            {activeDragItem && (
              <div className="card-drag-preview">
                <img src={activeDragItem.imageURL} alt="" />
              </div>
            )}
          </DragOverlay>

          <ZoomOverlay
            data={zoomData}
            items={items}
            updateNotes={updateNotes}
            isSaved={isSavedItemId}
            onClose={() => {
              isClosingZoomRef.current = true;
              setZoomData(null);
              setTimeout(() => {
                isClosingZoomRef.current = false;
              }, 300);
            }}
          />

          {editingItem && (
            <div className="editor-overlay">
              <div className="editor-wrapper-container">
                <button
                  className="custom-editor-close-btn"
                  onClick={() => setEditingItem(null)}
                >
                  ✕
                </button>
                <FilerobotImageEditor
                  key={editingItem.id}
                  source={editingItem.imageURL}
                  onSave={async (obj) => {
                    const blob = await (await fetch(obj.imageBase64)).blob();
                    await supabase.storage
                      .from("gallery")
                      .upload(editingItem.image_path, blob, { upsert: true });
                    fetchItems(session.user.id);
                    setEditingItem(null);
                  }}
                  onClose={() => setEditingItem(null)}
                  tabsIds={[TABS.ADJUST, TABS.FILTERS, TABS.ANNOTATE]}
                  defaultTabId={TABS.ADJUST}
                  defaultToolId={TOOLS.CROP}
                  config={{
                    useCloudimageResponsive: true,
                    observePluginContainerSize: true, // Let the lib handle the heavy lifting
                    loadNativeImage: true,
                    noScaleUp: false, // Allows the image to scale UP to fit the 90vw/85vh box
                    reduceBeforeEdit: {
                      mode: "auto",
                      widthLimit: 2000,
                      heightLimit: 1500,
                    },
                    // Adding internal padding the NATIVE way
                    imageGrid: {
                      padding: 30,
                    },
                    adjust: {
                      allowNegativeCrop: true,
                      // CROP PRESETS: Helps the auto-sizer find a valid boundary
                      cropPresets: [
                        { title: "Default", ratio: "custom" },
                        { title: "Square", ratio: 1 },
                        { title: "Vertical Post", ratio: 4 / 3 },
                        { title: "Wide Banner", ratio: 16 / 9 },
                      ],
                    },
                    showNavigationControls: false,
                  }}
                  // Using device pixel ratio prevents the "stretching" caused by over-rendering
                  savingPixelRatio={window.devicePixelRatio || 2} // Use device ratio instead of hardcoding 4
                  previewPixelRatio={window.devicePixelRatio || 2}
                />
              </div>
            </div>
          )}
        </div>
      </DndContext>
    );
  }

  // IF NOT LOGGED IN and view is landing -> Show Landing
  if (view === "landing") {
    return <LandingPage onEnter={() => setView("auth")} />;
  }

  // GATE 3: THE AUTH SCREEN
  return (
    <div className="relative">
      <button
        onClick={() => setView("landing")}
        className="back-to-landing-btn"
      >
        ← Back to Info
      </button>
      <Auth />
    </div>
  );
}
