import { useState, useRef } from "react";
import "./styles.css";

export default function ImageGalleryApp() {
  const fileInputRef = useRef(null);

  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem("imageGalleryItems");
    return saved ? JSON.parse(saved) : [];
  });

  const persist = (next) => {
    setItems(next);
    localStorage.setItem("imageGalleryItems", JSON.stringify(next));
  };

  const handleUpload = (e) => {
    const files = Array.from(e.target.files);

    const newItems = files.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      notes: "",
      flipped: false,
    }));

    persist([...items, ...newItems]);

    // clear file input so filename disappears
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleFlip = (id) => {
    persist(
      items.map((item) =>
        item.id === id ? { ...item, flipped: !item.flipped } : item
      )
    );
  };

  const updateNotes = (id, notes) => {
    persist(items.map((item) => (item.id === id ? { ...item, notes } : item)));
  };

  const clearGallery = () => {
    if (!window.confirm("Clear entire gallery?")) return;
    localStorage.removeItem("imageGalleryItems");
    setItems([]);
  };

  const exportData = () => {
    const data = items.map(({ id, notes }) => ({ id, notes }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "gallery-notes.json";
    link.click();
  };

  return (
    <div className="app">
      <h1>Image Gallery with Notes</h1>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
      />

      <div className="controls">
        <button className="export" onClick={exportData}>
          Export Notes
        </button>
        <button className="clearGallery" onClick={clearGallery}>
          Clear Gallery
        </button>
      </div>

      <div className="gallery">
        {items.map((item) => (
          <div key={item.id} className="card-wrapper">
            <div className={`card ${item.flipped ? "flipped" : ""}`}>
              {/* FRONT */}
              <div
                className="card-face card-front"
                onClick={() => toggleFlip(item.id)}
              >
                <img src={item.url} alt="uploaded" />
              </div>

              {/* BACK */}
              <div className="card-face card-back">
                <div className="notes-area">
                  <textarea
                    placeholder="Write notes here..."
                    value={item.notes}
                    onChange={(e) => updateNotes(item.id, e.target.value)}
                    rows={1}
                  />
                </div>

                <button
                  className="back-button"
                  onClick={(e) => {
                    e.stopPropagation(); // prevent card click
                    toggleFlip(item.id);
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
