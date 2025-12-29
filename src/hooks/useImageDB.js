import { useEffect, useRef, useCallback } from "react";

const DB_NAME = "imageGalleryDB";
const STORE = "images";
const VERSION = 1;

// Singleton promise to ensure we only ever open the DB once
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null; // Reset so we can try again on failure
      reject(req.error);
    };
  });

  return dbPromise;
}

export function useImageDB() {
  // Use a ref for the cache to persist across re-renders without triggering them
  const urlCache = useRef(new Map());

  // Cleanup: Revoke URLs when the component finally unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      urlCache.current.forEach((url) => URL.revokeObjectURL(url));
      urlCache.current.clear();
    };
  }, []);

  const saveImage = useCallback(async (id, blob) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.put(blob, id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, []);

  const getImageURL = useCallback(async (id) => {
    // 1. Check the local session cache first
    if (urlCache.current.has(id)) {
      return urlCache.current.get(id);
    }

    const db = await openDB();
    const blob = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!blob) return null;

    // 2. Generate a fresh Blob URL for this browser session
    const url = URL.createObjectURL(blob);
    urlCache.current.set(id, url);
    return url;
  }, []);

  const getImageBlob = useCallback(async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }, []);

  const deleteImage = useCallback(async (id) => {
    const db = await openDB();

    // Clean up cache and memory
    if (urlCache.current.has(id)) {
      URL.revokeObjectURL(urlCache.current.get(id));
      urlCache.current.delete(id);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, []);

  return {
    saveImage,
    getImageURL,
    getImageBlob,
    deleteImage,
  };
}
