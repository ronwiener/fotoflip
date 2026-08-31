import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  memo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { SplashScreen } from "@capacitor/splash-screen";
import { ImageManipulator } from "@capacitor-community/image-manipulator";
window.React = React;
import FilerobotImageEditor, {
  TABS,
  TOOLS,
} from "react-filerobot-image-editor";
import {
  DndContext,
  closestCenter,
  TouchSensor,
  MouseSensor,
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
import { supabase } from "./supabaseClient";
import "./styles1.css";
import { Capacitor } from "@capacitor/core";
import { processPhotoMetadata } from "./metadataUtils";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import {
  saveFolders,
  filterItems,
  exportGalleryZip,
  importGalleryZip,
} from "./helpers/galleryHelpers";
import LandingPage1 from "./LandingPage1";
import TipsModal from "./TipsModal";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import debouncePkg from "lodash.debounce";
import QuickPinchZoom from "react-quick-pinch-zoom";
/* ---------- AUTH COMPONENT ---------- */

// Add this helper function outside your Auth component to generate a safe nonce string
const generateNonce = (length = 32) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const debounce = debouncePkg.default || debouncePkg;

const makeTransform = ({ x, y, scale }) =>
  `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

function getSafeImageSrc(src) {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}t=${Date.now()}`;
}

function Auth({ setSession, setView, supabase }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);

  // Initialize GoogleAuth plugin when component mounts (Native iOS/Android only)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      GoogleAuth.initialize({
        clientId:
          "222744775554-l8g08tgm33esioc0hlaoa861dao9allt.apps.googleusercontent.com",
        scopes: ["profile", "email"],
        grantOfflineAccess: true,
      });
    }
  }, []);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isTokenReady = token.length === 6;

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!isEmailValid) return;
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      alert(error.message);
    } else {
      setShowOtpInput(true);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      alert("Invalid code. Please try again.");
    } else if (data.session) {
      setSession(data.session);
    }
    setLoading(false);
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    try {
      const result = await SignInWithApple.authorize({
        clientId: "com.ronwiener.fotoflip",
        redirectURI:
          "https://cdmlagrsfgevfliyqkrf.supabase.co/auth/v1/callback",
        scopes: "email name",
      });

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: result.response.identityToken,
      });

      if (error) throw error;
      if (data.session) setSession(data.session);
    } catch (error) {
      if (error.message !== "user cancelled") {
        console.error("Apple Auth Error:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // WEB DEVELOPMENT (localhost / web browser)
      if (!Capacitor.isNativePlatform()) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
            queryParams: {
              prompt: "select_account", // Ensures Google forces the account picker cleanly on web
            },
          },
        });
        if (error) throw error;
        return;
      }

      // NATIVE DEVICE PLATFORM (iOS / Android)
      const rawNonce = generateNonce();

      const googleUser = await GoogleAuth.signIn({
        nonce: rawNonce,
      });

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: googleUser.authentication.idToken,
        nonce: rawNonce,
      });

      if (error) throw error;

      if (data?.session) {
        console.log("Login successful!");
        setSession(data.session);
      }
    } catch (error) {
      console.error("Google Login failed:", error.message || error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">
        <div className="auth-header-actions">
          <button
            className="back-btn-styled"
            onClick={() => setView("landing")}
          >
            ← Back
          </button>
        </div>

        <div className="auth-box">
          <div className="badge">SECURE ACCESS</div>
          <h1>PHOTO FLIP</h1>

          {!showOtpInput ? (
            <>
              <p>Sign in to manage your digital archive</p>

              <button
                onClick={handleAppleLogin}
                className="apple-btn"
                disabled={loading}
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
                  alt="Apple"
                  style={{ width: "18px", filter: "brightness(0) invert(1)" }}
                />
                Continue with Apple
              </button>

              <button
                onClick={handleGoogleLogin}
                className="google-btn"
                disabled={loading}
              >
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

              <form onSubmit={handleRequestOtp} className="auth-form">
                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  disabled={loading || !isEmailValid}
                  className={`magic-link-btn ${
                    isEmailValid && !loading ? "btn-active" : ""
                  }`}
                >
                  {loading ? (
                    <span className="spinner-small"></span>
                  ) : (
                    "Send Code to Email"
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <p>
                Enter the 6-digit code sent to <strong>{email}</strong>
              </p>

              <form onSubmit={handleVerifyOtp} className="auth-form">
                <input
                  type="text"
                  placeholder="000000"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  required
                  style={{
                    textAlign: "center",
                    letterSpacing: "8px",
                    fontSize: "28px",
                    fontWeight: "900",
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !isTokenReady}
                  className={`magic-link-btn ${
                    isTokenReady && !loading ? "btn-active" : ""
                  }`}
                >
                  {loading ? (
                    <span className="spinner-small"></span>
                  ) : (
                    "Verify & Log In"
                  )}
                </button>
                <button
                  type="button"
                  className="back-link"
                  onClick={() => setShowOtpInput(false)}
                  style={{
                    background: "none",
                    border: "none",
                    marginTop: "15px",
                    color: "#64748b",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Entered wrong email? Go back
                </button>
              </form>
            </>
          )}
        </div>
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
      <span className="main-text">Gallery</span>
    </div>
  );
}

function FolderButton({ f, activeFolder, setActiveFolder, onDelete, count }) {
  // Added "FOLDER_" prefix so handleDragEnd can identify folder drop targets
  const { isOver, setNodeRef } = useDroppable({ id: `FOLDER_${f}` });

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
        <span className="folder-label">{f}</span>
        {count > 0 && <span className="folder-count-pill">{count}</span>}
      </button>
      <button
        className="delete-folder-btn"
        onPointerDown={(e) => e.stopPropagation()} // Crucial for mobile touch
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Delete folder "${f}"?`)) {
            onDelete(f);
          }
        }}
      >
        ✕
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
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      {isOver && selectedCount > 0 && (
        <span style={{ fontWeight: "bold", fontSize: "14px" }}>
          {selectedCount}
        </span>
      )}
    </div>
  );
}

function ZoomOverlay({ data, item, updateNotes, onClose }) {
  const textareaRef = useRef(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const [localNotes, setLocalNotes] = useState(item?.notes || "");
  const [isSuccessClosing, setIsSuccessClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const updateNotesRef = useRef(updateNotes);
  useEffect(() => {
    updateNotesRef.current = updateNotes;
  }, [updateNotes]);

  const debouncedSave = useMemo(
    () =>
      debounce(async (id, val) => {
        setIsSaving(true);
        if (updateNotesRef.current) {
          await updateNotesRef.current(id, val);
        }
        setIsSaving(false);
      }, 500),
    [],
  );

  // NATIVE PINCH & PAN GESTURE ENGINE
  useEffect(() => {
    const imgEl = imgRef.current;
    const containerEl = containerRef.current;
    if (
      !imgEl ||
      !containerEl ||
      (data?.type !== "img" && data?.type !== "image")
    )
      return;

    // Use a Map to safely track multi-touch pointers across frames
    const activePointers = new Map();
    let prevDiff = -1;
    let scale = 1;
    let pointX = 0;
    let pointY = 0;
    let startX = 0;
    let startY = 0;

    const getDistance = (p1, p2) => {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const applyTransform = () => {
      imgEl.style.transform = `translate3d(${pointX}px, ${pointY}px, 0) scale(${scale})`;
    };

    const handlePointerDown = (e) => {
      // Store current pointer coordinates
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {
        startX = e.clientX - pointX;
        startY = e.clientY - pointY;
      }
    };

    const handlePointerMove = (e) => {
      if (!activePointers.has(e.pointerId)) return;

      // Update pointer location
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pointerList = Array.from(activePointers.values());

      // Two-finger PINCH
      if (pointerList.length === 2) {
        const curDiff = getDistance(pointerList[0], pointerList[1]);

        if (prevDiff > 0) {
          const delta = curDiff - prevDiff;
          const zoomFactor = delta * 0.008;
          scale = Math.min(Math.max(1, scale + zoomFactor), 5);
          applyTransform();
        }
        prevDiff = curDiff;
      }
      // One-finger PAN (only when zoomed in)
      else if (pointerList.length === 1 && scale > 1) {
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        applyTransform();
      }
    };

    const handlePointerUp = (e) => {
      activePointers.delete(e.pointerId);

      if (activePointers.size < 2) {
        prevDiff = -1;
      }

      // Reset single-finger pan anchor point if transitioning back to 1 finger
      if (activePointers.size === 1) {
        const remainingPointer = Array.from(activePointers.values())[0];
        startX = remainingPointer.x - pointX;
        startY = remainingPointer.y - pointY;
      }

      // Snap back if unzoomed
      if (scale <= 1) {
        scale = 1;
        pointX = 0;
        pointY = 0;
        applyTransform();
      }
    };

    // Double-tap to quick zoom / reset
    let lastTap = 0;
    const handleDoubleTap = (e) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        if (scale > 1) {
          scale = 1;
          pointX = 0;
          pointY = 0;
        } else {
          scale = 2.5;
        }
        applyTransform();
      }
      lastTap = now;
    };

    containerEl.addEventListener("pointerdown", handlePointerDown);
    containerEl.addEventListener("pointermove", handlePointerMove);
    containerEl.addEventListener("pointerup", handlePointerUp);
    containerEl.addEventListener("pointercancel", handlePointerUp);
    containerEl.addEventListener("click", handleDoubleTap);

    return () => {
      containerEl.removeEventListener("pointerdown", handlePointerDown);
      containerEl.removeEventListener("pointermove", handlePointerMove);
      containerEl.removeEventListener("pointerup", handlePointerUp);
      containerEl.removeEventListener("pointercancel", handlePointerUp);
      containerEl.removeEventListener("click", handleDoubleTap);
    };
  }, [data]);

  useEffect(() => {
    if (item?.notes !== undefined) setLocalNotes(item.notes);
  }, [item?.notes]);

  useEffect(() => {
    if (
      data &&
      data.type !== "img" &&
      data.type !== "image" &&
      textareaRef.current
    ) {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [data]);

  useEffect(() => {
    return () => {
      if (typeof debouncedSave?.cancel === "function") {
        debouncedSave.cancel();
      }
    };
  }, [debouncedSave]);

  if (!data) return null;

  const executeSaveAndClose = async (e) => {
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    try {
      setIsSaving(true);
      const targetId = data?.id || item?.id;
      if (
        typeof updateNotes === "function" &&
        targetId &&
        data.type !== "img" &&
        data.type !== "image"
      ) {
        await updateNotes(targetId, localNotes);
      }
    } catch (err) {
      console.error("❌ [ZoomOverlay] Error during final save:", err);
    } finally {
      setIsSaving(false);
      if (typeof onClose === "function") onClose();
    }
  };

  const isImageView = data.type === "img" || data.type === "image";

  return createPortal(
    <div
      className="zoom-overlay"
      onClick={executeSaveAndClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none", // Prevent native browser scroll/zoom overlay interference
      }}
    >
      <div className="overlay-backdrop" />

      {isImageView ? (
        <div
          ref={containerRef}
          className="zoomed-image-container"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100vw",
            height: "100vh",
            position: "relative",
            overflow: "hidden",
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Close button - Fixed to viewport with Safe Area padding */}
          <button
            type="button"
            onClick={executeSaveAndClose}
            aria-label="Close"
            style={{
              position: "fixed", // Keep fixed to screen viewport, independent of image transforms
              top: "calc(20px + env(safe-area-inset-top, 0px))", // Protect against iPhone notch/dynamic island
              right: "calc(20px + env(safe-area-inset-right, 0px))",
              zIndex: 100005,
              background: "rgba(0, 0, 0, 0.5)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "50%",
              width: 44, // Minimum 44px tap target size for Apple HIG
              height: 44,
              fontSize: 22,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              touchAction: "manipulation",
            }}
          >
            ✕
          </button>

          <img
            ref={imgRef}
            src={data.url}
            alt=""
            onLoad={() => setIsImageLoaded(true)}
            className="zoomed-image"
            draggable="false"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
              userSelect: "none",
              WebkitUserSelect: "none",
              pointerEvents: "none", // Pass touch events directly to containerRef
              willChange: "transform",
              transformOrigin: "center center",
              opacity: isImageLoaded ? 1 : 0,
              transition: "opacity 0.15s ease-in",
              touchAction: "none",
            }}
          />
        </div>
      ) : (
        <div className="zoomed-notes-box" onClick={(e) => e.stopPropagation()}>
          <div className="zoomed-notes-header">
            <h3>Notes</h3>
            {isSaving && <div className="save-pill">Saving...</div>}
            {isSuccessClosing && (
              <div className="save-pill success">✓ Saved</div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={localNotes}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const val = e.target.value;
              setLocalNotes(val);
              setIsSaving(true);
              debouncedSave(data.id || item?.id, val);
            }}
            placeholder="Write notes here..."
          />

          <button
            type="button"
            className="notes-close-footer"
            onClick={executeSaveAndClose}
            style={{
              backgroundColor: isSuccessClosing ? "#22c55e" : "#64748b",
              cursor: "pointer",
            }}
          >
            {isSuccessClosing ? "✓ Saved" : "Done"}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

const DraggableCard = memo(function DraggableCard({
  item,
  isSelected,
  selectedIds,
  onToggleSelect,
  onFlip,
  onZoom,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: item.flipped, // Disable dragging when flipped
  });

  const longPressTimer = useRef(null);
  const isLongPressActive = useRef(false);
  const tapStartRef = useRef({ x: 0, y: 0 });

  const lastTapRef = useRef(0);
  const flipTimeoutRef = useRef(null);

  // Separate long-press cleanup from flip-timer cleanup
  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const clearFlipTimer = () => {
    if (flipTimeoutRef.current) {
      clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }
  };

  const handlePointerDown = (e) => {
    isLongPressActive.current = false;
    tapStartRef.current = { x: e.clientX, y: e.clientY };

    clearLongPress();

    if (selectedIds.size === 0 && !item.flipped) {
      longPressTimer.current = setTimeout(() => {
        if (
          typeof navigator !== "undefined" &&
          navigator.vibrate &&
          navigator.userActivation?.hasBeenActive
        ) {
          try {
            navigator.vibrate(50);
          } catch {
            void 0;
          }
        }

        onToggleSelect(item.id);
        isLongPressActive.current = true;
      }, 350);
    }
  };

  const handlePointerUp = (e) => {
    // Only cancel long-press here so single-tap flip timers can survive release!
    clearLongPress();

    if (!isLongPressActive.current) {
      const deltaX = Math.abs(e.clientX - tapStartRef.current.x);
      const deltaY = Math.abs(e.clientY - tapStartRef.current.y);

      // Verify tap wasn't a drag gesture
      if (deltaX < 10 && deltaY < 10) {
        if (selectedIds.size > 0) {
          onToggleSelect(item.id);
        } else {
          const now = Date.now();
          const timeSinceLastTap = now - lastTapRef.current;

          if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
            // 🔍 DOUBLE TAP: Clear pending flip and open Zoom Overlay
            clearFlipTimer();
            lastTapRef.current = 0;

            onZoom({
              id: item.id,
              type: "image",
              url: item.displayURL || item.imageURL,
            });
          } else {
            // 🔄 SINGLE TAP: Wait 250ms to verify it's not a double tap, then flip
            lastTapRef.current = now;
            clearFlipTimer();

            flipTimeoutRef.current = setTimeout(() => {
              onFlip(item.id);
              flipTimeoutRef.current = null;
            }, 250);
          }
        }
      }
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : item.flipped ? 10 : 1,
    touchAction: item.flipped ? "auto" : "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-wrapper ${isSelected ? "selected" : ""}`}
    >
      <div className={`card ${item.flipped ? "flipped" : ""}`}>
        {/* FRONT SIDE */}
        <div
          className="card-face card-front"
          {...(!item.flipped ? { ...attributes, ...listeners } : {})}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={clearLongPress}
          onPointerCancel={clearLongPress}
          onClick={(e) => e.stopPropagation()}
        >
          {isSelected && <div className="select-indicator active">✓</div>}
          <img
            src={getSafeImageSrc(item.displayURL || item.imageURL)}
            alt=""
            draggable="false"
            style={{ pointerEvents: "none", userSelect: "none" }}
          />
        </div>

        {/* BACK SIDE */}
        <div
          className="card-face card-back"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onZoom({ id: item.id, type: "notes", url: item.imageURL });
          }}
          style={{
            transform: "rotateY(180deg)",
            padding: "15px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="meta-header"
            style={{ fontSize: "10px", color: "#64748b", marginBottom: "10px" }}
          >
            <span>{item.location_description || "Unknown Location"}</span>
            <span style={{ margin: "0 5px" }}>•</span>
          </div>
          <div className="notes-content" style={{ flex: 1 }}>
            <div className="notes-display">
              <p
                style={{
                  fontFamily: "Georgia, serif",
                  fontStyle: "italic",
                  fontSize: "1.2rem",
                  color: "#1e293b",
                  lineHeight: "1.5",
                }}
              >
                {item.notes || "Tap here to write notes..."}
              </p>
            </div>
          </div>

          <div className="notes-actions">
            <button
              type="button"
              className="flip-back-btn"
              onClick={(e) => {
                e.stopPropagation();
                onFlip(item.id);
              }}
            >
              Tap to Flip Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

const addImageBuffer = (imageUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // 10% buffer on all sides
      const buffer = 0.04;
      canvas.width = img.width * (1 + buffer * 2);
      canvas.height = img.height * (1 + buffer * 2);

      // Match the background to your card color (White)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Center the image
      const x = (canvas.width - img.width) / 2;
      const y = (canvas.height - img.height) / 2;
      ctx.drawImage(img, x, y);

      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => resolve(imageUrl); // Fallback if it fails
    img.src = imageUrl;
  });
};
/* ---------- MAIN APP ---------- */
export default function App() {
  // --- States ---
  const [session, setSession] = useState(null);
  const [view, setView] = useState("landing"); // New View State
  const [items, setItems] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [folders, setFolders] = useState([]);
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
  const [editingItem, setEditingItem] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showTips, setShowTips] = useState(false);
  const [showManageAccount, setShowManageAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const galleryRef = useRef(null);

  const isClosingZoomRef = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Requires mouse movement of 5px before starting drag
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      // Uses distance constraint for touch to prevent navigator.vibrate interventions
      // and allow normal scrolling/clicking without hijacking taps
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const menuRef = useRef(null);

  useEffect(() => {
    const hideSplash = async () => {
      await SplashScreen.hide();
    };

    hideSplash();
  }, []);

  // 1. DIRECT REST LOAD FOLDERS
  const loadFolders = useCallback(async (userId) => {
    if (!userId) return [];

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      let token = supabaseAnonKey;
      try {
        const storageKey = Object.keys(localStorage).find(
          (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
        );
        if (storageKey) {
          const parsed = JSON.parse(localStorage.getItem(storageKey));
          if (parsed?.access_token) token = parsed.access_token;
        }
      } catch (e) {
        console.warn("⚠️ Could not read token for loadFolders");
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/folders?user_id=eq.${userId}&select=name&order=name.asc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`loadFolders failed status ${response.status}`);
      }

      const data = await response.json();
      const folderNames = data.map((f) => f.name);
      console.log("📂 [loadFolders SUCCESS]:", folderNames);
      setFolders(folderNames);
      return folderNames;
    } catch (error) {
      console.error("❌ Error loading folders:", error);
      return [];
    }
  }, []);

  // 2. DIRECT REST SAVE/DELETE FOLDERS
  const saveFolders = async (userId, folderName, isDelete = false) => {
    if (!userId || !folderName) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    let token = supabaseAnonKey;
    try {
      const storageKey = Object.keys(localStorage).find(
        (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
      );
      if (storageKey) {
        const parsed = JSON.parse(localStorage.getItem(storageKey));
        if (parsed?.access_token) token = parsed.access_token;
      }
    } catch (e) {
      console.warn("⚠️ Could not read token for saveFolders");
    }

    try {
      if (isDelete) {
        // DELETE folder via REST
        const response = await fetch(
          `${supabaseUrl}/rest/v1/folders?user_id=eq.${userId}&name=eq.${encodeURIComponent(
            folderName,
          )}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: supabaseAnonKey,
            },
          },
        );

        if (!response.ok)
          throw new Error(`Delete folder failed: ${response.status}`);
        console.log("🗑️ [saveFolders DELETE SUCCESS]:", folderName);
      } else {
        // UPSERT folder via REST
        const response = await fetch(`${supabaseUrl}/rest/v1/folders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation", // 👈 UPSERT configuration
          },
          body: JSON.stringify({ user_id: userId, name: folderName }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Save folder failed ${response.status}: ${errText}`);
        }

        const data = await response.json();
        console.log("✅ [saveFolders SUCCESS]:", data);
      }
    } catch (err) {
      console.error("❌ [saveFolders Exception]:", err);
      throw err;
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await SplashScreen.hide({ fadeOutDuration: 500 });
      } catch (e) {
        console.warn("Splash hide failed", e);
      }
      setIsReady(true);
    };
    initApp();
  }, []);

  const fetchItems = useCallback(async (userId, sessionToken) => {
    if (!userId) {
      console.warn("⚠️ [fetchItems] No userId provided. Aborting fetch.");
      return;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const token = sessionToken || supabaseAnonKey;
      const url = `${supabaseUrl}/rest/v1/items?user_id=eq.${userId}&select=*&order=id.desc`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("❌ [fetchItems HTTP ERROR]:", response.status, errText);
        return;
      }

      const data = await response.json();

      // Format data and construct full public imageURL for DraggableCard
      const formattedItems = data.map((item) => ({
        id: item.id,
        image_path: item.image_path,
        imageURL:
          item.image_path?.startsWith("http") ||
          item.image_path?.startsWith("data:")
            ? item.image_path
            : `${supabaseUrl}/storage/v1/object/public/gallery/${item.image_path}`,
        notes: item.notes || "",
        folder: item.folder || "",
        flipped: item.flipped || false,
        location_description: item.location_description || "",
        created_at: item.created_at,
      }));

      setItems(formattedItems);
    } catch (err) {
      console.error("❌ [fetchItems CRASHED]:", err.message || err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Helper to fetch both items & folders concurrently
    const loadUserData = async (userId, accessToken) => {
      try {
        await Promise.all([
          fetchItems(userId, accessToken),
          loadFolders(userId),
        ]);
      } catch (err) {
        console.error("❌ Error fetching user data:", err);
      }
    };

    // 1. Immediate cold-start check for existing session
    const checkInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user && isMounted) {
          console.log(
            "🟢 [COLD START] Active session found for:",
            session.user.email,
          );
          setSession(session);
          setView("gallery");
          await loadUserData(session.user.id, session.access_token);
        }
      } catch (err) {
        console.error("❌ Initial session check error:", err);
      }
    };

    checkInitialSession();

    // 2. Auth state change listener (TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("📡 Auth Event:", event, "Session:", session?.user?.email);

      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        setSession(null);
        setItems([]);
        setFolders([]);
        setView("landing");
      } else if (session?.user) {
        setSession(session);
        setView("gallery");

        await loadUserData(session.user.id, session.access_token);

        // Clean up ?code= parameter safely without breaking the session
        if (
          typeof window !== "undefined" &&
          window.location.search.includes("code=")
        ) {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchItems, loadFolders]);

  useEffect(() => {
    const galleryEl = galleryRef.current;
    if (!galleryEl) return;
    const handleScroll = () => setShowScrollTop(galleryEl.scrollTop > 300);
    galleryEl.addEventListener("scroll", handleScroll);
    return () => galleryEl.removeEventListener("scroll", handleScroll);
  }, [items]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /** * 1. THE DISPATCHER
   * Use this on your Upload Button: onClick={(e) => handlePrimaryUpload(e)}
   */
  const handlePrimaryUpload = async (e) => {
    const isNative =
      typeof window !== "undefined" &&
      window.Capacitor &&
      window.Capacitor.isNative;
    if (isNative) {
      await handleNativeImport();
    } else {
      await handleUpload(e);
    }
  };

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files);
    const total = files.length;
    if (total === 0) return;

    setUploadProgress({ current: 0, total });
    setIsLoading(true);

    for (let i = 0; i < total; i++) {
      setImportProgress(`Uploading ${i + 1} of ${total}...`);
      await uploadToGallery(files[i]);
      setUploadProgress({ current: i + 1, total });
    }

    setImportProgress("");
    setIsLoading(false);
    event.target.value = null;
  };

  const handleNativeImport = async () => {
    setIsMenuOpen(false);
    try {
      const image = await Camera.pickImages({
        quality: 90,
        width: 1200,
        height: 1200,
        allowEditing: false,
        resultType: CameraResultType.Uri,
      });

      setIsLoading(true);
      const total = image.photos.length;

      for (let i = 0; i < total; i++) {
        setImportProgress(`Importing ${i + 1} of ${total}...`);
        const response = await fetch(image.photos[i].webPath);
        const blob = await response.blob();
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        await uploadToGallery(file);
      }

      setImportProgress("");
      setIsLoading(false);
    } catch (err) {
      console.error("Native Import failed:", err);
      setIsLoading(false);
    }
  };

  const uploadToGallery = async (file) => {
    console.log("🚀 [STEP 1] uploadToGallery called for file:", file.name);

    try {
      // A. Extract EXIF Metadata First from Original File
      let metadataString = "Taken on Unknown Date in Unknown Location.";
      try {
        console.log("📸 [STEP 2] Extracting metadata from original file...");
        const metadataPromise = processPhotoMetadata(file);
        const metadataTimeout = new Promise((resolve) =>
          setTimeout(
            () => resolve("Taken on Unknown Date in Unknown Location."),
            5000,
          ),
        );

        metadataString = await Promise.race([metadataPromise, metadataTimeout]);
        console.log("✅ [STEP 2 SUCCESS] Metadata result:", metadataString);
      } catch (metaErr) {
        console.warn("⚠️ Metadata extraction failed, continuing:", metaErr);
      }

      // B. Client-Side HEIC/JPEG Compression Helper to Prevent 413 Payload Too Large
      let targetFile = file;

      const compressImage = async (
        fileToCompress,
        maxDimension = 3840,
        quality = 0.92,
      ) => {
        return new Promise((resolve) => {
          // If file is already safely under 4.5 MB, skip canvas compression completely
          // This keeps the original file untouched and crystal clear!
          if (fileToCompress.size < 4.5 * 1024 * 1024)
            return resolve(fileToCompress);

          console.log(
            "🗜️ [COMPRESSION] File exceeds 4.5MB, processing via canvas...",
          );
          const img = new Image();
          const url = URL.createObjectURL(fileToCompress);
          img.src = url;
          img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;

            // Only downscale if dimensions exceed 4K
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");

            // Fill canvas with white background before drawing (prevents black background bug on transparent PNGs)
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);

            // Maintain exact mime-type (PNGs stay PNGs, JPEGs stay JPEGs)
            const outputType =
              fileToCompress.type === "image/png" ? "image/png" : "image/jpeg";

            canvas.toBlob(
              (blob) => {
                if (!blob) return resolve(fileToCompress);
                const compressedFile = new File([blob], fileToCompress.name, {
                  type: outputType,
                  lastModified: Date.now(),
                });
                console.log(
                  `✅ [COMPRESSION SUCCESS] Resized (${outputType}) to ${width}x${height} at ${(
                    compressedFile.size /
                    1024 /
                    1024
                  ).toFixed(2)}MB`,
                );
                resolve(compressedFile);
              },
              outputType,
              quality,
            );
          };
          img.onerror = () => resolve(fileToCompress);
        });
      };

      // Handle HEIC conversion if present, otherwise compress large JPEGs/PNGs
      const isHeic =
        file.name.toLowerCase().endsWith(".heic") ||
        file.name.toLowerCase().endsWith(".heif") ||
        file.type === "image/heic" ||
        file.type === "image/heif";

      if (isHeic) {
        if (window.heic2any) {
          try {
            console.log(
              "🔄 [STEP 0] Converting HEIC to JPEG via window.heic2any...",
            );
            const convertedBlob = await window.heic2any({
              blob: file,
              toType: "image/jpeg",
              quality: 0.85,
            });

            const blobResult = Array.isArray(convertedBlob)
              ? convertedBlob[0]
              : convertedBlob;
            const newFileName = file.name.replace(
              /\.(heic|HEIC|heif|HEIF)$/,
              ".jpg",
            );

            targetFile = new File([blobResult], newFileName, {
              type: "image/jpeg",
            });
            console.log(
              "✅ [STEP 0 SUCCESS] Converted HEIC to JPEG:",
              targetFile.name,
            );
          } catch (convErr) {
            console.warn(
              "⚠️ HEIC conversion failed, proceeding with original file:",
              convErr,
            );
          }
        } else {
          console.warn(
            "⚠️ window.heic2any is unavailable. Check script tag in index.html.",
          );
        }
      }

      // Run compression step on final image target
      targetFile = await compressImage(targetFile);

      // C. Check Auth Session
      console.log("🔍 [STEP 3] Checking active user session...");
      let userId = session?.user?.id;
      let accessToken = session?.access_token;

      if (!userId || !accessToken) {
        const { data: authData } = await supabase.auth.getSession();
        userId = authData?.session?.user?.id;
        accessToken = authData?.session?.access_token;
      }

      if (!userId) {
        console.error("❌ [ERROR] No valid user ID found. Aborting upload.");
        alert("Upload failed: User session not found. Please log in again.");
        return;
      }

      console.log("👤 [STEP 4] Uploading under User ID:", userId);

      // D. Target Path & Direct Fetch Upload
      const cleanFileName = targetFile.name
        ? targetFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")
        : "photo.jpg";
      const filePath = `${userId}/${Date.now()}-${cleanFileName}`;

      console.log("📂 [STEP 5] Storage Target Path:", filePath);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const authToken = accessToken || supabaseAnonKey;

      console.log(
        "⏳ [STEP 6] Sending file via direct fetch to Supabase Storage bucket 'gallery'...",
      );

      const uploadUrl = `${supabaseUrl}/storage/v1/object/gallery/${filePath}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          apikey: supabaseAnonKey,
          "Content-Type": targetFile.type || "image/jpeg",
          "x-upsert": "true",
        },
        body: targetFile,
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        console.error(
          "❌ [STEP 6 FAILED] Storage Fetch Error:",
          uploadResponse.status,
          errText,
        );
        alert(`Storage Error (${uploadResponse.status}): ${errText}`);
        return;
      }

      const storageData = await uploadResponse.json();
      console.log(
        "✅ [STEP 6 SUCCESS] File uploaded via direct fetch:",
        storageData,
      );

      // E. Database Row Insert
      console.log(
        "📝 [STEP 7] Inserting metadata row into 'items' table via direct fetch...",
      );

      const dbUrl = `${supabaseUrl}/rest/v1/items`;
      const dbResponse = await fetch(dbUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          image_path: filePath,
          user_id: userId,
          folder: activeFolder === "Select Folder" ? "" : activeFolder,
          location_description: metadataString,
          notes: "",
        }),
      });

      if (!dbResponse.ok) {
        const dbErrText = await dbResponse.text();
        console.error(
          "❌ [STEP 7 FAILED] Database Fetch Error:",
          dbResponse.status,
          dbErrText,
        );
        alert(`Database Error (${dbResponse.status}): ${dbErrText}`);
        return;
      }

      const dbData = await dbResponse.json();
      console.log(
        "🎉 [STEP 7 SUCCESS] Database row created via fetch:",
        dbData,
      );

      // F. Refresh UI State
      console.log("🔄 [STEP 8] Refreshing gallery items...");
      await fetchItems(userId, accessToken);

      console.log("✨ [COMPLETE] Upload flow finished successfully!");
    } catch (err) {
      console.error(
        "💥 [CRITICAL ERROR] uploadToGallery crashed:",
        err.message || err,
      );
      alert(`Upload crashed: ${err.message || err}`);
    }
  };

  const handleFlip = useCallback((id) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const newFlippedState = !i.flipped;

          supabase
            .from("items")
            .update({ flipped: newFlippedState })
            .eq("id", id)
            .then(({ error }) => {
              if (error) console.error("Flip sync error:", error);
            });
          return { ...i, flipped: newFlippedState };
        }
        return i;
      }),
    );
  }, []);

  const updateNotes = useCallback(async (id, newNotes) => {
    console.log(
      "📥 [updateNotes Execution] Item ID:",
      id,
      "Content:",
      newNotes,
    );

    if (!id) {
      console.error("❌ [updateNotes] Aborting: Missing ID!");
      return null;
    }

    // 1. Optimistic Local React State Update
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, notes: newNotes } : item,
      ),
    );

    // Helper function for sending the REST PATCH request
    const sendPatchRequest = async (authToken) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      return await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ notes: newNotes }),
      });
    };

    // 2. Direct non-blocking REST Call to Persist in Supabase
    try {
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Fast path: Grab active token synchronously from localStorage
      let token = supabaseAnonKey;
      try {
        const storageKey = Object.keys(localStorage).find(
          (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
        );
        if (storageKey) {
          const parsed = JSON.parse(localStorage.getItem(storageKey));
          if (parsed?.access_token) {
            token = parsed.access_token;
          }
        }
      } catch (e) {
        console.warn(
          "⚠️ Could not read session token from localStorage, using anon key.",
        );
      }

      let response = await sendPatchRequest(token);

      // Bulletproof Fallback: If 401 (expired token), refresh session safely and retry once
      if (response.status === 401) {
        console.warn(
          "⚠️ [updateNotes] Token expired (401). Attempting session refresh...",
        );
        const { data: sessionData } = await supabase.auth.getSession();
        const refreshedToken = sessionData?.session?.access_token;

        if (refreshedToken) {
          console.log("🔄 [updateNotes] Token refreshed. Retrying request...");
          response = await sendPatchRequest(refreshedToken);
        }
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error("❌ [updateNotes REST ERROR]:", response.status, errText);
        throw new Error(
          `Supabase PATCH failed status ${response.status}: ${errText}`,
        );
      }

      const data = await response.json();
      console.log("✅ [updateNotes REST SUCCESS]:", data);

      if (!data || data.length === 0) {
        console.warn(
          "⚠️ [RLS Warning]: 0 rows updated in Supabase! If notes reset on refresh, verify RLS UPDATE policy on 'items' table.",
        );
      }

      return data;
    } catch (err) {
      console.error("❌ [updateNotes Exception]:", err);
      throw err;
    }
  }, []);

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleEditRequest = async (item) => {
    // Generate buffer for direct inline edit request
    const bufferedUrl = item.imageURL
      ? await addImageBuffer(item.imageURL)
      : item.displayURL;
    setEditingItem({
      ...item,
      displayURL: bufferedUrl,
    });
  };

  const handleSelectEditFromMenu = async (item) => {
    setEditingId(null);
    setSelectedIds(new Set()); // Deselect card when opening editor

    const bufferedUrl = item.imageURL
      ? await addImageBuffer(item.imageURL)
      : item.displayURL;

    setEditingItem({
      ...item,
      displayURL: bufferedUrl,
    });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    // 1. ALWAYS unlock the UI first
    setActiveDragItem(null);

    if (!over || active.id === over.id) return;

    const draggedIds = selectedIds.has(active.id)
      ? Array.from(selectedIds)
      : [active.id];

    const isTrash = over.id === "TRASH_BIN";
    const targetFolder = isTrash
      ? "DELETE"
      : over.id === "Select Folder"
      ? ""
      : over.id.startsWith("FOLDER_")
      ? over.id.replace("FOLDER_", "")
      : over.id;

    // 2. Perform Optimistic Update
    setItems((prev) =>
      isTrash
        ? prev.filter((i) => !draggedIds.includes(i.id))
        : prev.map((i) =>
            draggedIds.includes(i.id) ? { ...i, folder: targetFolder } : i,
          ),
    );
    setSelectedIds(new Set());

    // 3. Handle Database and Storage work in the background
    try {
      if (isTrash) {
        setIsDropping(true);

        const pathsToDelete = items
          .filter((i) => draggedIds.includes(i.id))
          .map((i) => i.image_path);

        if (pathsToDelete.length > 0) {
          const { error: storageError } = await supabase.storage
            .from("gallery")
            .remove(pathsToDelete);

          if (storageError) {
            console.warn("Storage removal warning:", storageError.message);
          }
        }

        const { error: dbError } = await supabase
          .from("items")
          .delete()
          .in("id", draggedIds);

        if (dbError) throw dbError;

        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (e) {
          void 0;
        }

        setTimeout(() => setIsDropping(false), 500);
      } else {
        const { error } = await supabase
          .from("items")
          .update({ folder: targetFolder })
          .in("id", draggedIds);
        if (error) throw error;
      }
    } catch (err) {
      console.error("Database or storage sync failed:", err);
      alert("Changes could not be saved to the server: " + err.message);

      if (session?.user?.id) {
        await fetchItems(session.user.id);
      }
    }
  };

  const handleDragCancel = () => {
    console.log("DEBUG: Drag Cancelled - Cleaning up state");
    setActiveDragItem(null);
    // This ensures that even if the drag fails, the 'isDragging'
    // flags in your cards are reset so you can flip them again.
  };

  const visibleItems = useMemo(() => {
    // We let the helper function handle the "Search vs Folder" logic internally
    return filterItems(items, activeFolder, search);
  }, [items, activeFolder, search]);

  const saveNewFolderInline = async () => {
    const trimmed = newFolderName.trim();

    // If empty, close and reset silently
    if (!trimmed) {
      setNewFolderName("");
      setIsCreatingFolder(false);
      return;
    }

    const isDuplicate = folders.some(
      (f) => f.toLowerCase() === trimmed.toLowerCase(),
    );

    if (isDuplicate) {
      setToastMessage("Folder already exists! 📂");
      setTimeout(() => setToastMessage(""), 2500);
      return;
    }

    if (!session?.user) {
      setNewFolderName("");
      setIsCreatingFolder(false);
      return;
    }

    try {
      // 1. Instantly update UI and clear input
      setFolders((prev) => [...prev, trimmed]);
      setIsCreatingFolder(false);
      setNewFolderName("");

      // 2. Trigger feedback toast immediately
      setToastMessage(`Folder "${trimmed}" created! 📂`);
      setTimeout(() => setToastMessage(""), 2500);

      // 3. Persist to database in background
      await saveFolders(session.user.id, trimmed);
    } catch (error) {
      console.error("Failed to save folder:", error);
      setToastMessage("Could not save folder to server ❌");
      setTimeout(() => setToastMessage(""), 2500);
      // Optional rollback on error
      setFolders((prev) => prev.filter((f) => f !== trimmed));
    }
  };

  const deleteFolder = async (fol) => {
    if (!session?.user) return;

    try {
      // 1. Move all items in this folder to the root gallery (folder = "")
      const { error: updateError } = await supabase
        .from("items")
        .update({ folder: "" })
        .eq("user_id", session.user.id)
        .eq("folder", fol);

      if (updateError) throw updateError;

      // 2. Remove the folder name from your folder storage
      // Assuming saveFolders(userId, name, isDelete) handles the DB delete
      await saveFolders(session.user.id, fol, true);

      // 3. Update local state
      setFolders((prev) => prev.filter((r) => r !== fol));
      setItems((prev) =>
        prev.map((item) =>
          item.folder === fol ? { ...item, folder: "" } : item,
        ),
      );

      // 4. If we were currently viewing that folder, switch to the main gallery
      if (activeFolder === fol) {
        setActiveFolder("Select Folder");
      }

      setToastMessage(`Folder removed. Photos moved to Gallery.`);
      setTimeout(() => setToastMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting folder:", error);
      setToastMessage("Could not delete folder.");
    }
  };

  const getFolderCount = (folderName) => {
    return items.filter((item) => item.folder === folderName).length;
  };

  const handleSignOut = async () => {
    try {
      // 1. Tell Supabase to invalidate the current session/token
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn("⚠️ [SignOut] Supabase sign out warning:", error.message);
      }
    } catch (err) {
      console.error("❌ [SignOut Error]:", err.message || err);
    } finally {
      // 2. Clear all local React state & route back to landing page regardless
      setSession(null);
      setItems([]);
      setFolders([]);
      setSelectedIds(new Set());
      setActiveFolder("Select Folder");
      setEditingItem(null);
      setView("landing");

      console.log("🚪 [SignOut] User successfully logged out and state wiped.");
    }
  };

  // 1. Trigger this from your "Delete Account" button in settings/profile
  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  // 2. Executed when the user clicks "Delete" inside your custom confirmation modal
  const confirmDeleteAccount = async () => {
    setShowDeleteModal(false);
    setIsLoading(true);

    try {
      const user = session?.user;
      if (!user?.id) throw new Error("No active user session found.");

      // Insert into delete_requests to trigger backend cascade
      const { error } = await supabase
        .from("delete_requests")
        .insert([{ id: user.id }]);

      if (error) throw error;

      // Terminate Supabase auth session
      await supabase.auth.signOut();

      alert(
        "Your account and all associated data have been permanently deleted.",
      );
    } catch (err) {
      console.error("❌ Deletion error:", err);
      alert("Error: Could not complete deletion. Please contact support.");
    } finally {
      // Wipe local state & route back to landing screen regardless of outcome
      setSession(null);
      setItems([]);
      setFolders([]);
      setSelectedIds(new Set());
      setActiveFolder("Select Folder");
      setEditingItem(null);
      setView("landing");
      setIsLoading(false);
    }
  };

  /* ---------- VIEW CONTROLLER ---------- */
  if (!isReady) return null;

  if (!session) {
    return view === "auth" ? (
      <Auth setSession={setSession} setView={setView} supabase={supabase} />
    ) : (
      <LandingPage1 onEnter={() => setView("auth")} />
    );
  }

  const handleFilerobotSave = async (savedImageData) => {
    console.log("💾 [v4.8.1 onSave] Data emitted:", savedImageData);

    try {
      const imageBase64 =
        savedImageData?.imageBase64 ||
        savedImageData?.imageCanvas?.toDataURL("image/jpeg", 0.9);

      if (!imageBase64) {
        throw new Error("No base64 image data generated from editor.");
      }

      console.log("📦 Uploading new image to Supabase storage...");

      const response = await fetch(imageBase64);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(editingItem.image_path, blob, {
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      console.log("✅ Upload successful! Updating UI...");

      // Construct fresh HTTP URL with cache buster for future loads
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const cleanPath = editingItem.image_path?.startsWith("http")
        ? editingItem.image_path.split("?")[0]
        : `${supabaseUrl}/storage/v1/object/public/gallery/${editingItem.image_path}`;
      const freshUrl = `${cleanPath}?t=${Date.now()}`;

      setItems((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                displayURL: imageBase64, // ⚡ Instant base64 preview (no CDN delay)
                imageURL: freshUrl, // 💾 Updated storage URL for page reloads
              }
            : item,
        ),
      );

      setEditingItem(null);
      setEditingId(null);
      setSelectedIds(new Set());

      setToastMessage("Image updated! ✨");
      setTimeout(() => setToastMessage(""), 2000);
    } catch (err) {
      console.error("❌ Save failed:", err.message || err);
      alert(`Failed to save image changes: ${err.message || err}`);
    }
  };

  // Debug logs right before rendering the gallery view
  console.log("Current items state in render:", items);
  console.log("Current activeFolder filter:", activeFolder);

  // 3. MAIN GALLERY (HAVE SESSION)
  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => {
          if (!event || !event.active) return;
          const activeId = event.active.id;
          const draggedItem = items.find((i) => i.id === activeId);
          if (draggedItem) setActiveDragItem(draggedItem);
        }}
        onDragEnd={(e) => {
          setActiveDragItem(null);
          handleDragEnd(e);
        }}
        onDragCancel={() => {
          setActiveDragItem(null);
          handleDragCancel();
        }}
      >
        <div className="app">
          <div className="controls">
            <h1 className="app-title">
              <span className="photo-text">Photo</span>{" "}
              <span className="flip-animation">Flip</span>
            </h1>
            <div className="controls-row">
              <label className="upload-main-btn" aria-label="Upload photos">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 28 28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                  <line x1="12" y1="5" x2="12" y2="9"></line>
                  <line x1="10" y1="7" x2="14" y2="7"></line>
                </svg>
                <input
                  type="file"
                  accept="image/jpeg, image/png, image/jpg"
                  multiple
                  hidden
                  onChange={(e) => handlePrimaryUpload(e)}
                />
              </label>

              <div
                className="search-wrapper"
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="key notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search.length > 0 && (
                  <button
                    onClick={() => setSearch("")}
                    className="search-clear-btn"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="menu-container" ref={menuRef}>
                <button
                  className="menu-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                    setShowManageAccount(false);
                  }}
                >
                  •••
                </button>

                {isMenuOpen && (
                  <div className="dropdown-menu">
                    {selectedIds.size === 1 && (
                      <>
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            const selectedItem = items.find((i) =>
                              selectedIds.has(i.id),
                            );
                            if (selectedItem)
                              handleSelectEditFromMenu(selectedItem);
                            setIsMenuOpen(false);
                          }}
                        >
                          <span>📝</span> Edit Photo
                        </button>
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIds(new Set());
                            setIsMenuOpen(false);
                          }}
                        >
                          <span>⚪</span> Deselect
                        </button>
                      </>
                    )}
                    {selectedIds.size > 1 && (
                      <button
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIds(new Set());
                          setIsMenuOpen(false);
                        }}
                      >
                        <span>⚪</span> Deselect All ({selectedIds.size})
                      </button>
                    )}
                    {selectedIds.size === 0 && (
                      <>
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCreatingFolder(true);
                            setIsMenuOpen(false);
                          }}
                        >
                          <span>📂</span> Add Folder
                        </button>
                        {visibleItems.length >= 2 && (
                          <button
                            className="menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIds(
                                new Set(visibleItems.map((i) => i.id)),
                              );
                              setIsMenuOpen(false);
                            }}
                          >
                            <span style={{ color: "#007aff" }}>🔵</span> Select
                            All
                          </button>
                        )}
                        <label className="menu-item">
                          <span>📥</span> Import
                          <input
                            type="file"
                            accept=".zip, image/*"
                            onChange={async (e) => {
                              e.stopPropagation();
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setIsMenuOpen(false);
                              setIsLoading(true);
                              try {
                                if (file.name.toLowerCase().endsWith(".zip")) {
                                  await importGalleryZip(
                                    file,
                                    (current, total) => {
                                      setImportProgress(
                                        `Importing ${current} of ${total}...`,
                                      );
                                    },
                                  );
                                } else {
                                  await uploadToGallery(file);
                                }
                              } catch (err) {
                                console.error("Import failed:", err);
                              } finally {
                                setIsLoading(false);
                                setImportProgress("");
                                e.target.value = "";
                              }
                            }}
                            hidden
                          />
                        </label>
                      </>
                    )}
                    <div
                      style={{
                        height: "1px",
                        background: "#eee",
                        margin: "4px 0",
                      }}
                    />
                    <button
                      className="menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportGalleryZip(items, selectedIds);
                        setIsMenuOpen(false);
                      }}
                    >
                      <span>📤</span> Export{" "}
                      {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
                    </button>
                    <button
                      className="menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTips(true);
                        setIsMenuOpen(false);
                      }}
                    >
                      <span>💡</span> Tips & Gestures
                    </button>
                    {!showManageAccount ? (
                      <button
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowManageAccount(true);
                        }}
                      >
                        <span>⚙️</span> Manage Account
                      </button>
                    ) : (
                      <>
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowManageAccount(false);
                          }}
                        >
                          <span>⬅️</span> Back
                        </button>
                        <button
                          className="menu-item logout-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSignOut();
                            setIsMenuOpen(false);
                            setShowManageAccount(false);
                          }}
                        >
                          <span>🚪</span> Sign Out
                        </button>
                        <button
                          className="menu-item delete-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(false);
                            setShowManageAccount(false);
                            handleDeleteAccount(); // Triggers showDeleteModal(true)
                          }}
                        >
                          <span>🗑️</span> Delete Account
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Account Deletion Confirmation Modal */}
              {showDeleteModal &&
                createPortal(
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 999999,
                      backgroundColor: "rgba(0, 0, 0, 0.75)",
                      backdropFilter: "blur(4px)",
                      WebkitBackdropFilter: "blur(4px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "#1e293b",
                        color: "#f8fafc",
                        borderRadius: "16px",
                        padding: "24px",
                        maxWidth: "400px",
                        width: "100%",
                        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "32px", marginBottom: "12px" }}>
                        ⚠️
                      </div>

                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          marginBottom: "12px",
                          color: "#ef4444",
                        }}
                      >
                        PERMANENT ACCOUNT DELETION
                      </h3>

                      <p
                        style={{
                          fontSize: "14px",
                          lineHeight: "1.5",
                          color: "#cbd5e1",
                          marginBottom: "24px",
                        }}
                      >
                        Are you sure you want to delete your account? All your
                        photos, folders, and metadata will be permanently
                        erased. This cannot be undone.
                      </p>

                      <div style={{ display: "flex", gap: "12px" }}>
                        <button
                          type="button"
                          onClick={() => setShowDeleteModal(false)}
                          style={{
                            flex: 1,
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid #475569",
                            backgroundColor: "#334155",
                            color: "#fff",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={confirmDeleteAccount}
                          style={{
                            flex: 1,
                            padding: "12px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: "#dc2626",
                            color: "#fff",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}
            </div>
          </div>

          <main className="main">
            {isLoading && uploadProgress.total > 0 && (
              <div className="gallery-upload-status">
                <p className="pulse-text">{importProgress}</p>
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

            {visibleItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">{search ? "🔍" : "📸"}</div>
                <h2>{search ? "No Matches Found" : "Let's Get Started!"}</h2>
                <p>
                  {search
                    ? `We couldn't find anything matching "${search}".`
                    : "Tap the upload icon to start adding photos."}
                </p>
              </div>
            ) : (
              <>
                <SortableContext
                  items={visibleItems.map((i) => i.id)}
                  strategy={rectSortingStrategy}
                >
                  <div
                    key={activeFolder + search}
                    className="gallery"
                    ref={galleryRef}
                    onClick={(e) => {
                      if (e.target === galleryRef.current)
                        setSelectedIds(new Set());
                    }}
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
                        updateNotes={updateNotes}
                        onEditRequest={handleEditRequest}
                        onSelectEdit={handleSelectEditFromMenu}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        onDelete={(id) => {
                          handleDragEnd({
                            active: { id },
                            over: { id: "TRASH_BIN" },
                          });
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
                {showScrollTop && (
                  <button
                    className="scroll-to-top visible"
                    onClick={() =>
                      galleryRef.current.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      })
                    }
                  >
                    ↑
                  </button>
                )}
              </>
            )}
          </main>

          <aside className="sidebar">
            {folders.length > 0 && (
              <div className="folder-list-container">
                {folders.map((f) => (
                  <FolderButton
                    key={f}
                    f={f}
                    count={getFolderCount(f)}
                    activeFolder={activeFolder}
                    setActiveFolder={setActiveFolder}
                    onDelete={deleteFolder}
                  />
                ))}
              </div>
            )}
            <div className={`nav-bar-elastic`}>
              <div className="nav-item-wrapper">
                <MainGalleryDropZone
                  activeFolder={activeFolder}
                  setActiveFolder={setActiveFolder}
                />
              </div>
              <div className="nav-item-wrapper">
                <TrashDropZone
                  selectedCount={selectedIds.size}
                  isDropping={isDropping}
                />
              </div>
            </div>
          </aside>

          {toastMessage && (
            <div className="toast-container">
              <div className="toast">{toastMessage}</div>
            </div>
          )}

          {isCreatingFolder && (
            <div
              className="folder-input-overlay"
              onClick={() => {
                saveNewFolderInline();
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveNewFolderInline();
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  className="large-inline-input"
                  autoFocus
                  type="text"
                  maxLength={20}
                  enterKeyHint="done"
                  placeholder="Folder Name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => {
                    saveNewFolderInline();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveNewFolderInline();
                    }
                    if (e.key === "Escape") {
                      setNewFolderName("");
                      setIsCreatingFolder(false);
                    }
                  }}
                />
              </form>
            </div>
          )}

          <DragOverlay
            dropAnimation={null}
            zIndex={10000}
            style={{ pointerEvents: "none" }}
          >
            {activeDragItem ? (
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  backgroundImage: `url(${activeDragItem.imageURL})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  borderRadius: "12px",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                  opacity: 0.9,
                }}
              />
            ) : null}
          </DragOverlay>
        </div>
      </DndContext>

      {zoomData && (
        <ZoomOverlay
          data={zoomData}
          item={items.find((i) => i.id === zoomData.id)}
          updateNotes={updateNotes}
          onClose={() => {
            console.log(
              "🟢 [App] Closing Zoom & Unflipping Card:",
              zoomData.id,
            );

            setItems((prevItems) =>
              prevItems.map((item) =>
                item.id === zoomData.id ? { ...item, flipped: false } : item,
              ),
            );

            setZoomData(null);
          }}
        />
      )}

      {editingItem && (
        <div
          className="editor-overlay"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="editor-wrapper-container">
            <button
              onClick={() => {
                setEditingItem(null);
                setEditingId(null);
              }}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                zIndex: 100000,
                background: "#333",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
              aria-label="Close Editor"
            >
              ✕
            </button>

            <FilerobotImageEditor
              key={editingItem.image_path}
              source={editingItem.displayURL || editingItem.imageURL}
              onBeforeSave={(imageFileInfo) => {
                console.log(
                  "🟡 [Filerobot] onBeforeSave triggered:",
                  imageFileInfo,
                );
                return false;
              }}
              onSave={handleFilerobotSave}
              onClose={(reason) => {
                console.log(
                  "🚪 [v4.8.1 onClose] Triggered with reason:",
                  reason,
                );
                setEditingItem(null);
                setEditingId(null);
              }}
              annotationsCommon={{
                fill: "#ff0000",
              }}
              Text={{ text: "Text..." }}
              Rotate={{ angle: 90, componentType: "slider" }}
              Crop={{
                presetsItems: [
                  {
                    titleKey: "classicTv",
                    descriptionKey: "4:3",
                    ratio: 4 / 3,
                  },
                  {
                    titleKey: "cinematic",
                    descriptionKey: "16:9",
                    ratio: 16 / 9,
                  },
                ],
              }}
              tabsIds={["Adjust", "Annotate", "Filters"]}
              defaultTabId="Adjust"
              defaultToolId="Crop"
              useBackendTranslations={false}
              savingPixelRatio={1}
              previewPixelRatio={1}
              config={{
                loadableImages: true,
                crossOrigin: "anonymous",
              }}
            />
          </div>
        </div>
      )}

      {showTips && <TipsModal onClose={() => setShowTips(false)} />}
    </>
  );
}
