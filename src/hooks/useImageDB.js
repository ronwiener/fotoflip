import { useEffect, useRef } from "react";

const DB_NAME = "imageGalleryDB";
const STORE = "images";
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function useImageDB() {
  const dbRef = useRef(null);
  const urlCache = useRef(new Map());

  // Initialize DB on mount
  useEffect(() => {
    let cancelled = false;
    openDB().then((db) => {
      if (!cancelled) dbRef.current = db;
    });

    return () => {
      cancelled = true;
      // Revoke all cached object URLs on cleanup
      urlCache.current.forEach((url) => URL.revokeObjectURL(url));
      urlCache.current.clear();
    };
  }, []);

  // Ensure DB is ready before any transaction
  const waitForDB = () =>
    new Promise((resolve) => {
      if (dbRef.current) return resolve();
      const interval = setInterval(() => {
        if (dbRef.current) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

  const saveImage = async (id, blob) => {
    await waitForDB();
    const tx = dbRef.current.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const getImageURL = async (id) => {
    await waitForDB();

    if (urlCache.current.has(id)) {
      return urlCache.current.get(id);
    }

    const tx = dbRef.current.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);

    const blob = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    urlCache.current.set(id, url);
    return url;
  };

  const getImageBlob = async (id) => {
    await waitForDB();
    const tx = dbRef.current.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);

    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const deleteImage = async (id) => {
    await waitForDB();
    const tx = dbRef.current.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);

    if (urlCache.current.has(id)) {
      URL.revokeObjectURL(urlCache.current.get(id));
      urlCache.current.delete(id);
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  return {
    saveImage,
    getImageURL,
    getImageBlob,
    deleteImage,
  };
}
